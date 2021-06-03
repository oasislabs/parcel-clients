import fs from 'fs';

import crypto from 'crypto';
import type { Parcel, Document } from '@oasislabs/parcel';
import { bootstrapParcel } from './helpers';

async function createLargeFile() {
  await fs.promises.writeFile('/tmp/large_input', '');
  for (let i = 0; i < 100; i++) {
    await fs.promises.appendFile('/tmp/large_input', crypto.randomBytes(1024 * 1024));
  }
}

describe('Large file (100MiB)', () => {
  let parcel: Parcel;
  let doc: Document;

  it('bootstrap', async () => {
    await createLargeFile();
    parcel = await bootstrapParcel();
  });

  it('upload', async () => {
    const readStream = fs.createReadStream('/tmp/large_input');
    doc = await parcel.uploadDocument(readStream, null).finished;
  }, 30_000);

  it('download', async () => {
    const writeStream = fs.createWriteStream('/tmp/large_output');
    const download = doc.download();
    await download.pipeTo(writeStream);
  }, 30_000);
});
