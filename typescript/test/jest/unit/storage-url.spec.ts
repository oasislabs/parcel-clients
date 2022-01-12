import { Parcel } from '@oasislabs/parcel';

describe('Parcel should correctly infer storageUrl', () => {
  test.each([
    ['https://api.oasislabs.com/parcel/v1', 'https://storage.oasislabs.com/v1/parcel'],
    [undefined, 'https://storage.oasislabs.com/v1/parcel'],
    [
      'https://api.oasiscloud-staging.net/parcel/v1',
      'https://storage.oasiscloud-staging.net/v1/parcel',
    ],
    [
      'https://api.sandbox.oasislabs.com/parcel/v1',
      'https://storage.sandbox.oasislabs.com/v1/parcel',
    ],
    [
      'https://api.sandbox.oasiscloud-staging.net/parcel/v1',
      'https://storage.sandbox.oasiscloud-staging.net/v1/parcel',
    ],
    ['http://localhost:4242/v1', 'http://localhost:4242/v1/documents'],
    ['http://parcel-gateway:4242/v1', 'http://parcel-gateway:4242/v1/documents'],
  ])('new Parcel({apiUrl: %s}).client.storageUrl', (apiUrl, expectedStorageUrl) => {
    const parcel = new Parcel('', { apiUrl });
    // eslint-disable-next-line @typescript-eslint/dot-notation
    expect(parcel['client'].storageUrl).toBe(expectedStorageUrl);
  });
});

describe('Parcel cannot correctly infer storageUrl', () => {
  test.each([
    ['http://parcel-dev.oasislabs:9003/v1', 'http://parcel-dev.oasislabs:9003/v1/parcel'],
    ['http://dev.oasislabs:9003/v1', 'http://storage.oasislabs:9003/v1/parcel'],
    ['http://127.0.0.1/v1', 'http://storage.0.0.1/v1/parcel'],
    ['http://10.0.0.1/v1', 'http://storage.0.0.1/v1/parcel'],
  ])('new Parcel({apiUrl: %s}).client.storageUrl', (apiUrl, expectedStorageUrl) => {
    const parcel = new Parcel('', { apiUrl });
    // eslint-disable-next-line @typescript-eslint/dot-notation
    expect(parcel['client'].storageUrl).toBe(expectedStorageUrl);
  });
});
