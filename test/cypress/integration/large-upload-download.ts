/// <reference types="../fixtures/types" />
import type { Parcel, Document } from '../../..'; // eslint-disable-line import/extensions
import { bootstrapParcel } from '../../jest/integration/helpers';

const SIZE_100MB = 100 * 1024 * 1024;

function createLargeFile() {
  return new File(
    Array.from({ length: SIZE_100MB / 1024 }, () => crypto.getRandomValues(new Uint8Array(1024))),
    'large_input',
  );
}

describe('Large file (100MiB)', () => {
  let parcel: Parcel;
  let doc: Document;

  it('bootstrap', async () => {
    parcel = await bootstrapParcel();
  });

  it('upload', { defaultCommandTimeout: 60_000 }, async () => {
    doc = await parcel.uploadDocument(createLargeFile(), null).finished;
    expect(doc.size).to.eq(SIZE_100MB);
  });

  it('download', { defaultCommandTimeout: 60_000 }, async () => {
    const download = doc.download();
    let progress = 0;
    await download.pipeTo(
      new WritableStream({
        write(chunk) {
          progress += chunk.length;
        },
      }),
    );
    expect(progress).to.eq(SIZE_100MB);
  });

  it('delete', async () => {
    await doc.delete();
  });
});
