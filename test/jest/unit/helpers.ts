import nock from 'nock';
import type { JsonObject } from 'type-fest';

import Parcel from '@oasislabs/parcel';

export const API_BASE_URL = 'https://api.oasislabs.com/parcel/v1';
export const STORAGE_URL = 'https://storage.oasislabs.com/v1/parcel';

export function nockIt(testName: string, test: (scope: nock.Scope) => Promise<void>): void {
  it(testName, async () => {
    const scope = parcelNock(API_BASE_URL);
    await test(scope);
    scope.done();
  });
}

export function parcelNock(url: string): nock.Scope {
  return nock(url)
    .defaultReplyHeaders({
      'content-type': 'application/json',
    })
    .replyContentLength()
    .matchHeader(
      'authorization',
      /^Bearer [\w-=]+\.[\w-=]+\.?[\w-.+/=]*$/, // JWT regex
    );
}

export function clone<T = JsonObject>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

const API_TOKEN =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJwYXJjZWwiLCJpc3MiOiJhdXRoLm9hc2lzbGFicy5jb20ifQ.foQOs-KXhOP6Vlwfs1sYqW1whbG-QW29Ex4Xa_mNNXaT4T2xtCwghhYGurkVUYSlo4cRxoaQYKo_foC2KysaDQ';

export function makeParcel(): Parcel {
  return new Parcel(API_TOKEN, {
    apiUrl: API_BASE_URL,
    storageUrl: STORAGE_URL,
  });
}
