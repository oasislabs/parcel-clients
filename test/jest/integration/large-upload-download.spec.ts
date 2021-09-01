import fs from 'fs';

import crypto from 'crypto';
import type { Document, Parcel } from '../../..'; // eslint-disable-line import/extensions
import { bootstrapParcel } from './helpers';

const SIZE_100MB = 100 * 1024 * 1024;

async function createLargeFile() {
  await fs.promises.writeFile('/tmp/large_input', '');
  for (let i = 0; i < SIZE_100MB / 1024 / 1024; i++) {
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
    expect(doc.size).toBe(SIZE_100MB);
  }, 30_000);

  it('download', async () => {
    const writeStream = fs.createWriteStream('/tmp/large_output');
    const download = doc.download();
    await download.pipeTo(writeStream);
    expect(writeStream.bytesWritten).toBe(SIZE_100MB);
  }, 30_000);

  it('delete', async () => {
    await doc.delete();
  });
});
