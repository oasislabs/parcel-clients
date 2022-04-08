// The following code is inlined from `ky-universal` because it uses ES modules and
// top-level await, which are not currently well supported by tools like Jest.

import type { Writable } from 'stream';
import type { WriteStream } from 'fs';
import {
  createReadableStreamWrapper,
  createWritableStreamWrapper,
} from '@mattiasbuelens/web-streams-adapter';
import * as webStreams from 'web-streams-polyfill/dist/ponyfill.es2018.js';

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
