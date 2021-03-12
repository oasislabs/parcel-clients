import { spawn } from 'child_process';
import { dirname, join } from 'path';

import Parcel, { AppCreateParams, IdentityId, PublicJWK } from '@oasislabs/parcel';

const npmPath = join(dirname(process.execPath), 'npm');

if (!process.env.PARCEL_API_URL || !process.env.PARCEL_TOKEN_ENDPOINT) {
  throw new Error(
    'PARCEL_API_URL and PARCEL_TOKEN_ENDPOINT env variables must be defined. Aborting.',
  );
}

// Test_identity_1.
const wrapperCreds = {
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

async function getAppFixture(owner: IdentityId): Promise<AppCreateParams> {
  return {
    admins: [owner],
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

let parcel: Parcel;

// Simulates what a developer following our tutorials is expected to do: Create an app and two OAuth
// clients for it.
beforeAll(async () => {
  parcel = new Parcel(wrapperCreds);
  const spawnerIdentity = await parcel.getCurrentIdentity();

  const app = await parcel.createApp(await getAppFixture(spawnerIdentity.id));
  // Example-client-1 aka ACME Inc.
  await parcel.createClient(app.id, {
    name: 'example-client-1',
    isScript: true,
    redirectUris: [],
    postLogoutRedirectUris: [],
    canHoldSecrets: true,
    publicKeys: [
      {
        kid: 'example-client-1',
        use: 'sig',
        kty: 'EC',
        crv: 'P-256',
        alg: 'ES256',
        x: 'ej4slEdbZpwYG-4T-WfLHpMBWPf6FItNNGFEHsjdyK4',
        y: 'e4Q4ygapmkxku_olSuc-WhSJaWiNCvuPqIWaOV6P9pE',
      },
    ],
  });
  // Example-client-2 aka Bob.
  await parcel.createClient(app.id, {
    name: 'example-client-2',
    isScript: true,
    redirectUris: [],
    postLogoutRedirectUris: [],
    canHoldSecrets: true,
    publicKeys: [
      {
        kid: 'example-client-2',
        use: 'sig',
        kty: 'EC',
        crv: 'P-256',
        alg: 'ES256',
        x: 'kbhoJYKyOgY645Y9t-Vewwhke9ZRfLh6_TBevIA6SnQ',
        y: 'SEu0xuCzTH95-q_-FSZc-P6hCSnq6qH00MQ52vOVVpA',
      },
    ],
  });
});

it(
  'data-upload',
  async () => {
    await runExample('data-upload');
  },
  10 * 1000,
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

async function runExample(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    spawn(npmPath, ['start'], {
      cwd: `examples/${name}`,
      stdio: [null, 'inherit', 'inherit'],
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
  });
}
