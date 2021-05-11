import { ChildProcess, spawn, execSync } from 'child_process';
import { dirname, join } from 'path';
import { CustomConsole, LogType, LogMessage } from '@jest/console';
import Parcel, {
  App,
  Client,
  AppCreateParams,
  Identity,
  PublicJWK,
  PrivateJWK,
  RenewingTokenProviderParams,
} from '@oasislabs/parcel';

// We define a console for the spawner with [SPAWNER] prefix and not as cluttered as the default
// jest's console wrapper.
const spawnerConsole = new CustomConsole(
  process.stdout,
  process.stderr,
  (_: LogType, message: LogMessage): string => {
    return `[SPAWNER] ${message}`;
  },
);

const npmPath = join(dirname(process.execPath), 'npm');
const npxPath = join(dirname(process.execPath), 'npx');

if (!process.env.PARCEL_API_URL || !process.env.PARCEL_AUTH_URL) {
  throw new Error('PARCEL_API_URL and PARCEL_AUTH_URL env variables must be defined. Aborting.');
}

// Test_identity_1.
const spawnerCreds = {
  principal: 'ISmEcSerfVhSspezb44dwLD',
  privateKey: {
    kty: 'EC',
    alg: 'ES256',
    use: 'sig',
    crv: 'P-256',
    kid: 'DcI1bh_7WW9YujsR3h7dik2rQmYNQPSB3dXV-AJsxgc',
    x: 'v8c_cPZJndQLe51QhGApDPhT4C6OqteK3e0Ttd1CbxE',
    y: 'Cbvi7oyrCfX5iDPiFUiJPtpiGbypB5UoxJviXtBXfNQ',
    d: '9ssmJBm_mDIKpxdB2He-zIMeclYtDGQcBv2glEH7r5k',
  },
} as const;

let acmeApp: App;
let acmeIdentity: Identity;
let acmeServiceClient: Client;
let acmeFrontendClient: Client;
const acmeServiceClientPrivateKey = {
  kid: 'acme-service-client',
  kty: 'EC',
  alg: 'ES256',
  use: 'sig',
  crv: 'P-256',
  x: 'ej4slEdbZpwYG-4T-WfLHpMBWPf6FItNNGFEHsjdyK4',
  y: 'e4Q4ygapmkxku_olSuc-WhSJaWiNCvuPqIWaOV6P9pE',
  d: '_X2VJCigbOYXOq0ilXATJdh9c2DdaSzZlxXVV6yuCXg',
} as const;
let acmeBackendClient: Client;
const acmeBackendClientPrivateKey = {
  kid: 'acme-backend-client',
  use: 'sig',
  kty: 'EC',
  crv: 'P-256',
  alg: 'ES256',
  x: 'mqlepd4Gr5L4zEauL2V-3x46cvXFTP10LY4AfOyCjd4',
  y: 'iTMKFMDJVqDDf-Tbt3fVxVs4F84_6nSpMji9uDCE3hY',
  d: 'SjSlVeiDxJ9wFBLIky2WSoUTI3NBJgm2YpbxBpfPQr0',
} as const;

let bobApp: App;
let bobIdentity: Identity;
let bobServiceClient: Client;
const bobServiceClientPrivateKey = {
  kid: 'bob-service-client',
  kty: 'EC',
  alg: 'ES256',
  use: 'sig',
  crv: 'P-256',
  x: 'kbhoJYKyOgY645Y9t-Vewwhke9ZRfLh6_TBevIA6SnQ',
  y: 'SEu0xuCzTH95-q_-FSZc-P6hCSnq6qH00MQ52vOVVpA',
  d: '10sS7lgM_YWxf79x21mWalCkAcZZOmX0ZRE_YwEXcmc',
} as const;

async function getAppFixture(owner: Identity): Promise<AppCreateParams> {
  return {
    admins: [owner.id],
    collaborators: [],
    published: false,
    inviteOnly: true,
    invites: [],
    allowUserUploads: true,

    name: 'Rate Your S@ndwich',
    organization: 'ACME ltd.',
    shortDescription: 'Sharing and rating of food recipes',
    homepageUrl: 'https://example.com',
    privacyPolicy: 'https://example.com/privacy',
    termsAndConditions: 'https://example.com/terms',

    invitationText: 'Allow recording of sandwich creation',
    acceptanceText:
      'Great! By allowing video recording of your sandwich creation, we will automagically compose a recipe for you!',
    rejectionText:
      'No problem. You will still be able to use Rate your S@andwich, but you will need to type the recipe for your sandwich manually.',

    extendedDescription:
      'Rate your S@andwich can make a video recording of yourself while making a sandwich. Then, with our smart deep hamster AI we will compose a recipe including a list of all the ingredients you used.',
    brandingColor: '#abcdef',
    category: 'food',
    logoUrl: 'http://localhost:4050/images/Egg_Sandwich.jpg',

    identity: {
      tokenVerifiers: [
        {
          publicKey: await getAuthPublicKey(),
          iss: process.env.PARCEL_AUTH_URL,
        },
      ],
    },
  };
}

/**
 * Retrieve public keys from Auth and return the first one.
 * Auth returns the latest key first, and prefers using this key over existing ones.
 * Expects PARCEL_AUTH_URL env variable to be set.
 */
async function getAuthPublicKey(): Promise<PublicJWK> {
  const response = await fetch(`${process.env.PARCEL_AUTH_URL}/.well-known/jwks.json`);
  if (!response.ok) {
    const hint = await response.text();
    throw new Error(`${response.statusText}${hint ? `: ${hint}` : ''}`);
  }

  const { keys }: { keys: PublicJWK[] } = await response.json();

  if (!keys?.[0]) {
    throw new Error(`Oasis Auth public key is not available from ${process.env.PARCEL_AUTH_URL}`);
  }

  return keys[0];
}

/**
 * Extract and return the public key given the private key.
 */
function extractPubKey(privKey: PrivateJWK) {
  const { d, ...pubKey } = privKey;
  return pubKey;
}

/**
 * Simulate what a developer following our tutorials is expected to do: Create two apps and a
 * server-type OAuth client for each app.
 */
beforeAll(async () => {
  const parcel = new Parcel(spawnerCreds);
  const spawnerIdentity = await parcel.getCurrentIdentity();

  // First app and acme-client.
  acmeApp = await parcel.createApp(await getAppFixture(spawnerIdentity));
  spawnerConsole.log(`Created acmeApp, id: ${acmeApp.id}, owner ${acmeApp.owner}`);
  acmeServiceClient = await parcel.createClient(acmeApp.id, {
    name: 'acme-service-client',
    isScript: true,
    redirectUris: [],
    postLogoutRedirectUris: [],
    canHoldSecrets: true,
    publicKeys: [extractPubKey(acmeServiceClientPrivateKey)],
  });
  const parcelAcme = new Parcel({
    clientId: acmeServiceClient.id,
    privateKey: acmeServiceClientPrivateKey,
  } as RenewingTokenProviderParams);
  acmeIdentity = await parcelAcme.getCurrentIdentity();
  spawnerConsole.log(
    `Created acmeServiceClient, client_id: ${acmeServiceClient.id}, identity: ${acmeIdentity.id}`,
  );
  acmeFrontendClient = await parcel.createClient(acmeApp.id, {
    name: 'acme-frontend-client',
    isScript: false,
    redirectUris: ['http://localhost:4050/callback'],
    postLogoutRedirectUris: [],
    canHoldSecrets: false,
    publicKeys: [],
  });
  spawnerConsole.log(`Created acmeFrontendClient, client_id: ${acmeFrontendClient.id}`);

  acmeBackendClient = await parcel.createClient(acmeApp.id, {
    name: 'acme-backend-client',
    isScript: false,
    redirectUris: ['http://localhost:4050/callback'],
    postLogoutRedirectUris: [],
    canHoldSecrets: true,
    publicKeys: [extractPubKey(acmeBackendClientPrivateKey)],
  });
  spawnerConsole.log(`Created acmeBackendClient, client_id: ${acmeBackendClient.id}`);

  // Second app and bob-client.
  bobApp = await parcel.createApp(await getAppFixture(spawnerIdentity));
  spawnerConsole.log(`Created bobApp, id: ${bobApp.id}, owner ${bobApp.owner}`);
  bobServiceClient = await parcel.createClient(bobApp.id, {
    name: 'bob-service-client',
    isScript: true,
    redirectUris: [],
    postLogoutRedirectUris: [],
    canHoldSecrets: true,
    publicKeys: [extractPubKey(bobServiceClientPrivateKey)],
  });
  const parcelBob = new Parcel({
    clientId: bobServiceClient.id,
    privateKey: bobServiceClientPrivateKey,
  } as RenewingTokenProviderParams);
  bobIdentity = await parcelBob.getCurrentIdentity();
  spawnerConsole.log(
    `Created bobServiceClient, client_id: ${bobServiceClient.id}, identity: ${bobIdentity.id}`,
  );
}, 15 * 1000);

it(
  'data-upload',
  async () => {
    await runExamplePromisified('data-upload');
  },
  10 * 1000,
);

it(
  'data-access',
  async () => {
    await runExamplePromisified('data-access', (data) => {
      // Forward example's output to stdout.
      process.stdout.write(data.toString());

      // Wait for the example until the grant permission is required.
      if (data.includes("ACME was not able to access Bob's data (this was expected):")) {
        spawnerConsole.log(
          `Assigning grant to ${acmeIdentity.id} for documents with tag ${acmeApp.id}`,
        );
        const parcelBob = new Parcel({
          clientId: bobServiceClient.id,
          privateKey: bobServiceClientPrivateKey,
        } as RenewingTokenProviderParams);
        void parcelBob.createGrant({
          grantee: acmeIdentity.id,
          condition: { 'document.tags': { $contains: `to-app-${acmeApp.id}` } },
        });
      }
    });
  },
  20 * 1000,
);
it(
  'grants-advanced',
  async () => {
    await runExamplePromisified('grants-advanced');
  },
  20 * 1000,
);

it(
  'login-with-oasis-frontend',
  async () => {
    await runCypressTest('login-with-oasis-frontend');
  },
  100 * 1000,
);

it(
  'login-with-oasis-backend',
  async () => {
    await runCypressTest('login-with-oasis-backend');
  },
  100 * 1000,
);

// Compute examples might need to download docker images, set higher timeout.
it(
  'compute-basic',
  async () => {
    await runExamplePromisified('compute-basic');
  },
  300 * 1000,
);
it(
  'compute-advanced',
  async () => {
    // Start the example:
    await runExamplePromisified('compute-advanced');
  },
  300 * 1000,
);

async function runCypressTest(exampleName: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const example = runExample(exampleName, async (data) => {
      // Forward example's output to stdout.
      process.stdout.write(data.toString());

      // Wait for Express used in the example to start listening.
      if (data.includes('listening at http://localhost:4050')) {
        try {
          // Launch a frontend test.
          const cypressCmd = `${npxPath} cypress run --config '{"baseUrl":"http://localhost:4050","integrationFolder":"test/examples","testFiles":["login-with-oasis.spec.js"],"chromeWebSecurity":false,"video":true,"videosFolder":"cypress/videos/${exampleName}"}'`;
          execSync(cypressCmd, { stdio: 'inherit' });
        } finally {
          // XXX: npm start spawns a sub-subprocess and nodejs doesn't support killing it out of the
          // box. Writing 0x03 to stdin (ctrl+C) also doesn't work. Kill it by calling external kill
          // command and obtain the correct child process.
          // Perhaps we could use start-server-and-test library instead?
          const killCmd = `/bin/kill -SIGINT $(pgrep -P $(pgrep -P ${example.pid}))`;
          execSync(killCmd, { stdio: 'inherit' });
        }
      }
    });
    example.on('close', (signal) => {
      if (signal === 130) {
        // 130 is the expected return code caused by the interrupt.
        resolve();
      } else {
        reject(new Error(`example exited with code ${signal}`));
      }
    });
  });
}

async function runExamplePromisified(
  name: string,
  customStdoutListener?: (chunk: any) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    runExample(name, customStdoutListener)
      .on('close', (signal) => {
        if (signal === 0) {
          resolve();
        } else {
          reject(new Error(`example exited with code ${signal}`));
        }
      })
      .on('disconnect', () => {
        reject(new Error('example disconnected'));
      })
      .on('error', (error) => {
        reject(new Error(`example exited with error ${JSON.stringify(error)}`));
      });
  });
}

function runExample(name: string, customStdoutListener?: (chunk: any) => void): ChildProcess {
  const child = spawn(npmPath, ['start'], {
    cwd: `examples/${name}`,
    stdio: ['inherit', customStdoutListener ? 'pipe' : 'inherit', 'inherit'],
    env: {
      ACME_APP_ID: acmeApp.id,
      ACME_SERVICE_CLIENT_ID: acmeServiceClient.id,
      ACME_FRONTEND_CLIENT_ID: acmeFrontendClient.id,
      ACME_BACKEND_CLIENT_ID: acmeBackendClient.id,
      BOB_IDENTITY_ID: bobIdentity.id,
      BOB_SERVICE_CLIENT_ID: bobServiceClient.id,
      ...process.env,
    },
  });
  if (customStdoutListener) {
    child.stdout?.on('data', customStdoutListener);
  }

  return child;
}
