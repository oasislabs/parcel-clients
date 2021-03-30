import type { WriteStream } from 'fs';

import AbortController from 'abort-controller';
import FormData from 'form-data';
import type { BeforeRequestHook, NormalizedOptions, Options as KyOptions } from 'ky';
import ky from 'ky';
import { paramCase } from 'param-case';
import type { Readable, Writable } from 'stream';
import type { JsonObject } from 'type-fest';

import type { TokenProvider } from './token.js';
import { ReadableStreamPF } from './polyfill.js';

const DEFAULT_API_URL =
  globalThis?.process?.env?.PARCEL_API_URL ?? 'https://api.oasislabs.com/parcel/v1';

export type Config = Partial<{
  apiUrl: string;
  httpClientConfig: KyOptions;
}>;

const EXPECTED_RESPONSE_CODES = new Map([
  ['POST', 201],
  ['PUT', 200],
  ['PATCH', 200],
  ['DELETE', 204],
]);

export class HttpClient {
  public readonly apiUrl: string;

  private readonly ky: typeof ky;

  public constructor(private readonly tokenProvider: TokenProvider, config?: Config) {
    this.apiUrl = config?.apiUrl?.replace(/\/$/, '') ?? DEFAULT_API_URL;
    this.ky = ky
      .create({
        // Default timeout is 10s, and that might be too short for chain. Upload
        // request should override this.
        timeout: 30_000,
        ...config?.httpClientConfig,
      })
      .extend({
        prefixUrl: this.apiUrl,
        headers: {
          'x-requested-with': '@oasislabs/parcel',
        },
        hooks: {
          beforeRequest: [
            async (req) => {
              req.headers.set('authorization', `Bearer ${await this.tokenProvider.getToken()}`);
            },
          ],
          afterResponse: [
            async (req, opts, res) => {
              // The `authorization` header is not re-sent by the browser, so redirects fail,
              // and must be retried manually.
              if (
                res.redirected &&
                (res.status === 401 || res.status === 403) &&
                res.url.startsWith(this.apiUrl)
              ) {
                return this.ky(res.url, {
                  method: req.method,
                  prefixUrl: '',
                });
              }

              // Wrap errors, for easier client handling (and maybe better messages).
              if (isApiErrorResponse(res)) {
                throw new ApiError(req, opts, res, (await res.json()).error);
              }

              const expectedStatus: number =
                (req as any).expectedStatus ?? EXPECTED_RESPONSE_CODES.get(req.method);
              if (res.ok && expectedStatus && res.status !== expectedStatus) {
                const endpoint = res.url.replace(this.apiUrl, '');
                throw new ApiError(
                  req,
                  opts,
                  res,
                  `${req.method} ${endpoint} returned unexpected status ${expectedStatus}. expected: ${res.status}.`,
                );
              }
            },
          ],
        },
      });
  }

  public async get<T>(
    endpoint: string,
    params: Record<string, string | number | boolean | undefined> = {},
    requestOptions?: KyOptions,
  ): Promise<T> {
    let hasParams = false;
    const kebabCaseParams: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) {
        hasParams = true;
        kebabCaseParams[paramCase(k)] = v;
      }
    }

    return this.ky
      .get(endpoint, {
        searchParams: hasParams ? kebabCaseParams : undefined,
        ...requestOptions,
      })
      .json();
  }

  /** Convenience method for POSTing and expecting a 201 response */
  public async create<T>(
    endpoint: string,
    data: JsonObject | FormData,
    requestOptions?: KyOptions,
  ): Promise<T> {
    return this.post(endpoint, data, requestOptions);
  }

  public async post<T>(
    endpoint: string,
    data: JsonObject | FormData | undefined,
    requestOptions?: KyOptions,
  ): Promise<T> {
    const opts = requestOptions ?? {};
    if (data !== undefined) {
      if ('getBuffer' in data && typeof data.getBuffer === 'function') {
        opts.body = data.getBuffer(); // It's the polyfill.
      } else if (data instanceof FormData) {
        opts.body = data as any;
      } else {
        opts.json = data;
      }
    }

    return this.ky.post(endpoint, opts).json();
  }

  public async update<T>(endpoint: string, params: JsonObject): Promise<T> {
    return this.put(endpoint, params);
  }

  public async put<T>(endpoint: string, params: JsonObject): Promise<T> {
    return this.ky.put(endpoint, { json: params }).json();
  }

  public async delete(endpoint: string): Promise<void> {
    await this.ky.delete(endpoint);
  }

  public download(endpoint: string): Download {
    return new Download(this.ky, endpoint);
  }
}

/** A beforeRequest hook that attaches context to the Request, for displaying in errors. */
function attachContext(context: string): BeforeRequestHook {
  return (req) => {
    (req as any).context = context;
  };
}

export function setExpectedStatus(status: number): BeforeRequestHook {
  return (req) => {
    (req as any).expectedStatus = status;
  };
}

/**
 * A `Download` is the result of calling `parcel.downloadDocument` or `document.download()`.
 *
 * The downloaded data can be read using the Node `stream.Readable` interface, or by
 * calling `await downlad.pipeTo(sink)`.
 *
 * The download may be aborted by calling `download.destroy()`, as with any `Readable`.
 */
export class Download implements AsyncIterable<Uint8Array> {
  private res?: Promise<Response>;
  private readonly abortController: AbortController;

  public constructor(private readonly client: typeof ky, private readonly endpoint: string) {
    this.abortController = new AbortController();
  }

  public async *[Symbol.asyncIterator]() {
    const body = (await this.makeRequest())?.body;
    if (!body) return;

    /* istanbul ignore else: tested using Cypress */
    if ((body as any).getReader === undefined) {
      // https://github.com/node-fetch/node-fetch/issues/930
      const bodyReadable = (body as any) as Readable;
      yield* bodyReadable;
    } else {
      const rdr = body.getReader();
      let chunk;
      do {
        chunk = await rdr.read();
        if (chunk.value) yield chunk.value;
      } while (!chunk.done);
    }
  }

  public abort(): void {
    this.abortController.abort();
  }

  public get aborted(): boolean {
    return this.abortController.signal.aborted;
  }

  /**
   * Convenience method for piping to a sink and waiting for writing to finish.
   * This method must not be used alongside `getStream` or `AsyncIterable`.
   */
  public async pipeTo(sink: Writable | WriteStream | WritableStream): Promise<void> {
    if ('getWriter' in sink) {
      const { body } = await this.makeRequest();
      if (!body) return;
      if (body.pipeTo) {
        return body.pipeTo(sink);
      }

      // Firefox's native ReadableStream is missing pipeTo.
      (body as any)._readableStreamController = null; // https://github.com/MattiasBuelens/web-streams-polyfill/blob/36c08de/src/lib/readable-stream.ts#L407
      return ReadableStreamPF.prototype.pipeTo.call(body, sink);
    }

    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    const { Readable } = await import('stream'); // This only happens in the browser.
    return new Promise((resolve, reject) => {
      Readable.from(this, { objectMode: false })
        .on('error', reject)
        .pipe(sink)
        .on('error', reject)
        .on('finish', resolve);
    });
  }

  /**
   * Lazily make the request. Helps avoid unhandled promise rejections when the request
   * fails before a pipe or iterator handler is attached.
   */
  // This funciton returns double promise to make both xo and TS happy. V8 doesn't care.
  private async makeRequest(): Promise<Response> {
    if (!this.res) {
      this.res = this.client.get(this.endpoint, {
        signal: this.abortController.signal,
        hooks: {
          beforeRequest: [attachContext('document download')],
        },
      });
    }

    return this.res;
  }
}

export class ApiError extends ky.HTTPError {
  public readonly message: string;

  public constructor(
    request: Request,
    options: NormalizedOptions,
    response: Response,
    message: string, // Workaround for https://github.com/sindresorhus/ky/issues/148.
  ) {
    super(response, request, options);
    this.name = 'ApiError';

    const { context }: { context: string } = request as any;
    if (context) {
      message = `error in ${context}: ${message}`;
    }

    this.message = message;
  }

  public static async fromHTTPError(error: ky.HTTPError): Promise<ApiError> {
    const res = error.response;
    return new ApiError(error.request, error.options, res, (await res.json()).error);
  }
}

function isApiErrorResponse(response: Response): boolean {
  return !response.ok && response.headers.get('content-type') === 'application/json';
}
