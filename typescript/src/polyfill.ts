// The following code is inlined from `ky-universal` because it uses ES modules and
// top-level await, which are not currently well supported by tools like Jest.

import type { Writable } from 'stream';
import type { WriteStream } from 'fs';
import {
  createReadableStreamWrapper,
  createWritableStreamWrapper,
} from '@mattiasbuelens/web-streams-adapter';
import AbortController from 'abort-controller';
import FormData from 'form-data';
import fetch, { Headers, Request as RequestPF, Response as ResponsePF } from 'node-fetch';
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
const toReadableStreamPF = createReadableStreamWrapper(webStreams.ReadableStream) as unknown as (
  r: globalThis.ReadableStream,
) => webStreams.ReadableStream;

const toWritableStreamPF = createWritableStreamWrapper(webStreams.WritableStream) as unknown as (
  w: globalThis.WritableStream,
) => webStreams.WritableStream;

export async function pipeToPolyfill(
  body: ReadableStream,
  sink: Writable | WriteStream | WritableStream,
) {
  const readablePF = toReadableStreamPF(body);
  const writablePF = toWritableStreamPF(sink as webStreams.WritableStream);
  return readablePF.pipeTo(writablePF);
}
