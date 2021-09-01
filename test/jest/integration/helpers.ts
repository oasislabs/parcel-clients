import { JWK } from 'node-jose';
// Note: this file is used by jest/integration and cy/integration.
import { ClientType, Parcel, PrivateJWK, PublicJWK } from '../../..'; // eslint-disable-line import/extensions

const apiUrl = process.env.PARCEL_API_URL ?? 'http://localhost:4242/v1';

export async function generateJWKPair() {
  const keyPair = await JWK.createKey('EC', 'P-256', {
    alg: 'ES256',
    use: 'sig',
  });
  const publicKey = keyPair.toJSON(false) as PublicJWK;
  const privateKey = keyPair.toJSON(true) as PrivateJWK;
  return { publicKey, privateKey };
}

/** Creates a Parcel client using a bootstrap identity. */
export async function bootstrapParcel() {
  const parcel = new Parcel('not required in dev mode when identity creation is unauthenticated', {
    apiUrl,
  });

  const { privateKey, publicKey } = await generateJWKPair();
  const credential = {
    principal: `bootstrap${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)}`,
    privateKey,
  };
  await parcel.createIdentity({
    tokenVerifiers: [
      {
        sub: credential.principal,
        iss: credential.principal,
        publicKey,
      },
    ],
  });
  return new Parcel(credential, { apiUrl });
}

export async function createAppAndClient(parcel: Parcel) {
  const app = await parcel.createApp({
    admins: [],
    allowUserUploads: false,
    collaborators: [],
    homepageUrl: 'https://oasislabs.com',
    identity: {
      tokenVerifiers: [],
    },
    inviteOnly: false,
    invites: [],
    logoUrl: 'https://oasislabs.com',
    name: 'a',
    organization: '',
    privacyPolicy: 'https://oasislabs.com',
    published: true,
    shortDescription: '',
    termsAndConditions: 'https://oasislabs.com',
    acceptanceText: '',
    brandingColor: '',
    category: '',
    extendedDescription: '',
    invitationText: '',
    rejectionText: '',
  });
  const client = await parcel.createClient(app.id, {
    type: ClientType.Frontend,
    name: 'a',
    redirectUris: ['https://oasislabs.com'],
    postLogoutRedirectUris: ['https://oasislabs.com'],
  });
  return { app, client };
}
