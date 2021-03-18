import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { CustomConsole, LogType, LogMessage } from '@jest/console';
import Parcel, {
  App,
  Client,
  AppCreateParams,
  Identity,
  PublicJWK,
  PrivateJWK,
} from '@oasislabs/parcel';

// We define a console for the spawner with [SPAWNER] prefix and not as cluttered as the default
// jest's console wrapper.
const spwanerConsole = new CustomConsole(
  process.stdout,
  process.stderr,
  (_: LogType, message: LogMessage): string => {
    return `[SPAWNER] ${message}`;
  },
);

const npmPath = join(dirname(process.execPath), 'npm');

if (!process.env.PARCEL_API_URL || !process.env.PARCEL_TOKEN_ENDPOINT) {
  throw new Error(
    'PARCEL_API_URL and PARCEL_TOKEN_ENDPOINT env variables must be defined. Aborting.',
  );
}

// Test_identity_1.
const spawnerCreds = {
  principal: 'IPoxXkdvFsrqzDdU7h3QqSs',
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
let acmeClient: Client;
const acmeClientCreds = {
  clientId: 'C92EAFfH67w4bGkVMjihvkQ',
  privateKey: {
    kid: 'acme-client',
    kty: 'EC',
    alg: 'ES256',
    use: 'sig',
    crv: 'P-256',
    x: 'ej4slEdbZpwYG-4T-WfLHpMBWPf6FItNNGFEHsjdyK4',
    y: 'e4Q4ygapmkxku_olSuc-WhSJaWiNCvuPqIWaOV6P9pE',
    d: '_X2VJCigbOYXOq0ilXATJdh9c2DdaSzZlxXVV6yuCXg',
  },
} as const;

let bobApp: App;
let bobIdentity: Identity;
let bobClient: Client;
const bobClientCreds = {
  clientId: 'CErM9iRkfYdAJ9TCbJvV3gQ',
  privateKey: {
    kid: 'bob-client',
    kty: 'EC',
    alg: 'ES256',
    use: 'sig',
    crv: 'P-256',
    x: 'kbhoJYKyOgY645Y9t-Vewwhke9ZRfLh6_TBevIA6SnQ',
    y: 'SEu0xuCzTH95-q_-FSZc-P6hCSnq6qH00MQ52vOVVpA',
    d: '10sS7lgM_YWxf79x21mWalCkAcZZOmX0ZRE_YwEXcmc',
  },
} as const;

async function getAppFixture(owner: Identity): Promise<AppCreateParams> {
  return {
    admins: [owner.id],
    collaborators: [],
    published: false,
    inviteOnly: true,
    invites: [],
    allowUserUploads: true,

    name: 'test app',
    organization: 'Oasis Labs',
    shortDescription: 'shrt dscrptn',
    homepageUrl: 'https://example.com',
    privacyPolicy: 'https://example.com/privacy',
    termsAndConditions: 'https://example.com/terms',

    invitationText: 'plz give data',
    acceptanceText: 'thanks for the data!',
    rejectionText: '🙁',

    extendedDescription: 'looooong description',
    brandingColor: '#abcdef',
    category: 'testing',
    logoUrl: 'https://logos.gif',

    identityTokenVerifiers: [
      {
        publicKey: await getAuthPublicKey(),
        iss: new URL(process.env.PARCEL_TOKEN_ENDPOINT!).origin,
      },
    ],
  };
}

/**
 * Retrieve public keys from Auth and return the first one.
 * Auth returns the latest key first, and prefers using this key over existing ones.
 * Expects PARCEL_TOKEN_ENDPOINT env variable to be set.
 */
async function getAuthPublicKey(): Promise<PublicJWK> {
  const authServer = new URL(process.env.PARCEL_TOKEN_ENDPOINT!).origin;
  const response = await fetch(`${authServer}/oauth/keys`);
  if (!response.ok) {
    const hint = await response.text();
    throw new Error(`${response.statusText}${hint ? `: ${hint}` : ''}`);
  }

  const { keys }: { keys: PublicJWK[] } = await response.json();

  if (!keys?.[0]) {
    throw new Error(`Oasis Auth public key is not available from ${authServer}`);
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
  spwanerConsole.log(`Created acmeApp, id: ${acmeApp.id}, owner ${acmeApp.owner}`);
  acmeClient = await parcel.createClient(acmeApp.id, {
    name: 'acme-client',
    isScript: true,
    redirectUris: [],
    postLogoutRedirectUris: [],
    canHoldSecrets: true,
    publicKeys: [extractPubKey(acmeClientCreds.privateKey)],
  });
  const parcelAcme = new Parcel(acmeClientCreds);
  acmeIdentity = await parcelAcme.getCurrentIdentity();
  spwanerConsole.log(
    `Created acmeClient, client_id: ${acmeClient.id}, identity: ${acmeIdentity.id}`,
  );

  // Second app and bob-client.
  bobApp = await parcel.createApp(await getAppFixture(spawnerIdentity));
  spwanerConsole.log(`Created bobApp, id: ${bobApp.id}, owner ${bobApp.owner}`);
  bobClient = await parcel.createClient(bobApp.id, {
    name: 'bob-client',
    isScript: true,
    redirectUris: [],
    postLogoutRedirectUris: [],
    canHoldSecrets: true,
    publicKeys: [extractPubKey(bobClientCreds.privateKey)],
  });
  const parcelBob = new Parcel(bobClientCreds);
  bobIdentity = await parcelBob.getCurrentIdentity();
  spwanerConsole.log(`Created bobClient, client_id: ${bobClient.id}, identity: ${bobIdentity.id}`);
}, 10 * 1000);

it(
  'data-upload',
  async () => {
    await runExample('data-upload');
  },
  10 * 1000,
);

it(
  'data-access',
  async () => {
    await runExample('data-access', (data) => {
      // Forward example's output to stdout.
      process.stdout.write(data.toString());

      // Wait for the example until the grant permission is required.
      if (data.includes("ACME was not able to access Bob's data (this was expected):")) {
        spwanerConsole.log(
          `Assigning grant to ${acmeIdentity.id} for documents with tag ${acmeApp.id}`,
        );
        const parcelBob = new Parcel(bobClientCreds);
        void parcelBob.createGrant({
          grantee: acmeIdentity.id,
          condition: { 'document.details.tags': { $any: { $eq: acmeApp.id } } },
        });
      }
    });
  },
  20 * 1000,
);

// Compute examples might need to download docker images, set higher timeout.
it(
  'compute-basic',
  async () => {
    await runExample('compute-basic');
  },
  300 * 1000,
);
it(
  'compute-advanced',
  async () => {
    // Start the example:
    await runExample('compute-advanced');
  },
  300 * 1000,
);

async function runExample(
  name: string,
  customStdoutListener?: (chunk: any) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(npmPath, ['start'], {
      cwd: `examples/${name}`,
      stdio: [null, customStdoutListener ? 'pipe' : 'inherit', 'inherit'],
    })
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
    if (customStdoutListener) {
      child.stdout?.on('data', customStdoutListener);
    }
  });
}
