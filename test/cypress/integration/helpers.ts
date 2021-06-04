// eslint-disable-next-line import/extensions
import Parcel, { PrivateJWK, PublicJWK } from '../../..';
import { JWK } from 'node-jose';

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
