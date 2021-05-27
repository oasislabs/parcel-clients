import Parcel, { PrivateJWK, PublicJWK, Document } from '@oasislabs/parcel';
import fs from 'fs';
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
async function bootstrapParcel() {
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

async function createLargeFile() {
  await fs.promises.writeFile('/tmp/large_input', 'a', 'utf-8');
  for (let i = 0; i < 100; i++) {
    await fs.promises.appendFile('/tmp/large_input', 'a'.repeat(1024 * 1024), 'utf-8');
  }
}

describe('Large file (100MiB)', () => {
  let parcel: Parcel;
  let doc: Document;

  beforeAll(async () => {
    parcel = await bootstrapParcel();
    await createLargeFile();
  });

  it('Upload', async () => {
    const readStream = fs.createReadStream('/tmp/large_input');
    doc = await parcel.uploadDocument(readStream, null).finished;
  }, 30_000);

  it('Download', async () => {
    const writeStream = fs.createWriteStream('/tmp/large_output');
    const download = doc.download();
    await download.pipeTo(writeStream);
  }, 30_000);
});
