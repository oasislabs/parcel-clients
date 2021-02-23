// The following code is inlined from `ky-universal` because it uses ES modules and
// top-level await, which are not currently well supported by tools like Jest.

import AbortController from 'abort-controller';
import FormData from 'form-data';
import fetch, { Headers, Request as RequestPF, Response as ResponsePF } from 'node-fetch';
// @ts-expect-error: The package isn't ESM-compatible.
// eslint-disable-next-line import/extensions
import * as webStreams from 'web-streams-polyfill/dist/ponyfill.es2018.js';

globalThis.fetch =
  globalThis.fetch ??
  (async (url: any, options) => fetch(url, { highWaterMark: 1e7 /* 10 MB */, ...options } as any));
globalThis.Headers = globalThis.Headers ?? Headers;
globalThis.Request = globalThis.Request ?? RequestPF;
globalThis.Response = globalThis.Response ?? ResponsePF;
globalThis.AbortController = globalThis.AbortController ?? AbortController;
globalThis.FormData = globalThis.FormData ?? FormData;
globalThis.ReadableStream = globalThis.ReadableStream ?? webStreams.ReadableStream;
globalThis.WritableStream = globalThis.WritableStream ?? webStreams.WritableStream;

const ReadableStreamPF = webStreams.ReadableStream as typeof globalThis.ReadableStream;

export { ReadableStreamPF };
