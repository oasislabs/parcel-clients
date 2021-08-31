import type { WriteStream } from 'fs';
import type { Readable, Writable } from 'stream';

import AbortController from 'abort-controller';
import FormData from 'form-data';
import type { BeforeRequestHook, NormalizedOptions, Options as KyOptions } from 'ky';
import ky, { HTTPError } from 'ky';
import { paramCase } from 'param-case';

import type { PODDocument } from './document';
import type { JsonSerializable, Page } from './model.js';
import type { TokenProvider } from './token.js';
import { pipeToPolyfill } from './polyfill.js';

const DEFAULT_API_URL =
  globalThis?.process?.env?.PARCEL_API_URL ?? 'https://api.oasislabs.com/parcel/v1';
const DEFAULT_STORAGE_URL =
  globalThis?.process?.env?.PARCEL_STORAGE_URL ?? 'https://storage.oasislabs.com/v1/parcel';

export type Config = Partial<{
  apiUrl: string;
  storageUrl: string;
  httpClientConfig: KyOptions;
}>;

const DEFAULT_RESPONSE_CODES = new Map([
  ['POST', 200],
  ['PUT', 200],
  ['PATCH', 200],
  ['DELETE', 204],
]);

export class HttpClient {
  public readonly apiUrl: string;
  public readonly storageUrl: string;

  private readonly apiKy: typeof ky;

  public constructor(private readonly tokenProvider: TokenProvider, config?: Config) {
    this.apiUrl = config?.apiUrl?.replace(/\/$/, '') ?? DEFAULT_API_URL;
    if (config?.storageUrl) {
      this.storageUrl = config.storageUrl;
    } else if (config?.apiUrl) {
      const apiUrl = new URL(this.apiUrl);
      if (/local/g.test(apiUrl.host) || /^parcel-(run|gate)way/g.test(apiUrl.host)) {
        this.storageUrl = `${this.apiUrl}/documents`; // Intranet can use the endpoint directly.
      } else {
        const storageHost = apiUrl.host.replace(/^\w+\./, 'storage.');
        this.storageUrl = `${apiUrl.protocol}//${storageHost}/v1/parcel`;
      }
    } else {
      this.storageUrl = DEFAULT_STORAGE_URL;
    }

    this.apiKy = ky.create({
      ...config?.httpClientConfig,

      // Default timeout is 10s, and that might be too short for chain. Upload
      // request should override this.
      timeout: 30_000,

      prefixUrl: this.apiUrl,
      headers: {
        'x-requested-with': '@oasislabs/parcel',
      },
      hooks: {
        beforeRequest: [
          appendAsLastBeforeRequest(dontCloneForAfterResponses()),
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
              (res.url.startsWith(this.apiUrl) || res.url.startsWith(this.storageUrl))
            ) {
              return this.apiKy(res.url, {
                method: req.method,
                prefixUrl: '',
              });
            }

            // Wrap errors, for easier client handling (and maybe better messages).
            if (isApiErrorResponse(res)) {
              throw new ApiError(
                req,
                opts,
                res,
                `Error from ${req.url}: ${(await res.json()).error}`,
              );
            }

            const allowedStatusCodes: number[] = (req as any).allowedStatusCodes ?? [];
            allowedStatusCodes.push(DEFAULT_RESPONSE_CODES.get(req.method) ?? 200);
            if (res.ok && !allowedStatusCodes.includes(res.status)) {
              const endpoint = res.url.replace(this.apiUrl, '');
              throw new ApiError(
                req,
                opts,
                res,
                `${req.method} ${endpoint} returned unexpected status ${
                  res.status
                }. expected: ${allowedStatusCodes.join(' | ')}.`,
              );
            }
          },
        ],
      },
    });
  }

  public async get<T>(
    endpoint: string,
    params: Record<string, string | number | Date | boolean | undefined> = {},
    requestOptions?: KyOptions,
  ): Promise<T> {
    let hasParams = false;
    const kebabCaseParams: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) {
        hasParams = true;
        kebabCaseParams[paramCase(k)] = v instanceof Date ? v.getTime() : v;
      }
    }

    const response = await this.apiKy.get(endpoint, {
      searchParams: hasParams ? kebabCaseParams : undefined,
      ...requestOptions,
    });
    return response.json();
  }

  public async upload(data: FormData, requestOptions?: KyOptions): Promise<PODDocument> {
    return this.create(this.storageUrl, data, {
      prefixUrl: '',
      ...requestOptions,
    });
  }

  /** Convenience method for POSTing and expecting a 201 response */
  public async create<T>(
    endpoint: string,
    data: Record<string, JsonSerializable> | FormData | undefined,
    requestOptions?: KyOptions,
  ): Promise<T> {
    return this.post(endpoint, data, {
      ...requestOptions,
      hooks: {
        beforeRequest: [...(requestOptions?.hooks?.beforeRequest ?? []), addAllowedStatusCode(201)],
      },
    });
  }

  /** Convenience method for POSTing and expecting a 200 response */
  public async search<T>(
    baseEndpoint: string, // Without the `/search` suffix.
    params: Record<string, JsonSerializable> | undefined,
    requestOptions?: KyOptions,
  ): Promise<Page<T>> {
    return this.post<Page<T>>(`${baseEndpoint}/search`, params, requestOptions);
  }

  public async post<T>(
    endpoint: string,
    data: Record<string, JsonSerializable> | FormData | undefined,
    requestOptions?: KyOptions,
  ): Promise<T> {
    const opts = requestOptions ?? {};
    if (data !== undefined) {
      if (
        ('getBuffer' in data && typeof data.getBuffer === 'function') /* form-data polyfill */ ||
        data instanceof FormData
      ) {
        opts.body = data as any;
      } else {
        opts.json = data;
      }
    }

    return (await this.apiKy.post(endpoint, opts)).json();
  }

  public async update<T>(endpoint: string, params: Record<string, JsonSerializable>): Promise<T> {
    return this.put(endpoint, params);
  }

  public async put<T>(endpoint: string, params: Record<string, JsonSerializable>): Promise<T> {
    return (await this.apiKy.put(endpoint, { json: params })).json();
  }

  public async delete(endpoint: string): Promise<void> {
    await this.apiKy.delete(endpoint);
  }

  public download(endpoint: string): Download {
    return new Download(this.apiKy, endpoint);
  }
}

declare module 'ky' {
  // Mark methods readonly too to prevent hooks from modifying `response`
  export type Response = Readonly<globalThis.Response>;
}

/**
 * Workaround to fix `afterResponse` breaking >20MB file downloads.
 *
 * Ky clones the response when using afterResponse. Cloning causes requests to
 * stop requesting data after 2x highWaterMark (we use 10 MB) unless all clones
 * consume data at the same time. This workaround uses beforeRequest hook to
 * skip ky's fetch call + afterResponse handling, and reimplements both.
 *
 * WARNING: Use caution if modifying response.json or response.body in hooks. In
 * vanilla ky every hook receives its own clone of the response; with this
 * workaround, the same response object is passed to all hooks, so changes
 * propagate (somewhat mitigated by readonly fields on Response). In addition,
 * response.body can only be read once.
 *
 * Related issues:
 * - https://github.com/node-fetch/node-fetch#custom-highwatermark
 * - https://github.com/sindresorhus/ky-universal/issues/8
 * - https://github.com/sindresorhus/ky/issues/135
 * - https://github.com/node-fetch/node-fetch/issues/386
 *
 * TODO: remove if fixed by https://github.com/sindresorhus/ky/pull/356
 */
export function dontCloneForAfterResponses(): BeforeRequestHook {
  return async (req, opts: NormalizedOptions & KyOptions) => {
    if (!opts.hooks?.afterResponse?.length) return;

    const { afterResponse } = opts.hooks;
    opts.hooks.afterResponse = [];

    let response = await opts.fetch!(req.clone());
    // https://github.com/sindresorhus/ky/blob/5f3c3158af5c7efbb6a1cfd9e5f16fc71dd26e36/source/core/Ky.ts#L112-L123
    for (const hook of afterResponse) {
      const modifiedResponse = await hook(req, opts, response);
      if (modifiedResponse instanceof globalThis.Response) {
        response = modifiedResponse;
      }
    }

    return response;
  };
}

/** Attaches a hook to end of hooks.beforeRequest (incl. after one-off hooks specified in the call to fetch(), e.g. setExpectedStatus) */
export function appendAsLastBeforeRequest(hookToSchedule: BeforeRequestHook): BeforeRequestHook {
  return (req, opts: NormalizedOptions & KyOptions) => {
    if (!opts.hooks) opts.hooks = {};
    if (!opts.hooks.beforeRequest) opts.hooks.beforeRequest = [];

    opts.hooks.beforeRequest.push(hookToSchedule);
  };
}

/** A beforeRequest hook that attaches context to the Request, for displaying in errors. */
function attachContext(context: string): BeforeRequestHook {
  return (req) => {
    (req as any).context = context;
  };
}

export function addAllowedStatusCode(status: number): BeforeRequestHook {
  return (req: any) => {
    req.allowedStatusCodes = req.allowedStatusCodes ?? [];
    req.allowedStatusCodes.push(status);
  };
}

/**
 * A `Download` is the result of calling `parcel.downloadDocument` or `document.download()`.
 *
 * The downloaded data can be read using async iterable `for await (const chunk of download)`,
 * or by calling `await download.pipeTo(sink)`.
 *
 * The download may be aborted by calling `download.destroy()`, as with any `Readable`.
 */
export class Download implements AsyncIterable<Uint8Array> {
  private res?: Promise<Response>;
  private readonly abortController: AbortController;

  public constructor(private readonly client: typeof ky, private readonly endpoint: string) {
    this.abortController = new AbortController();
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
    const body = (await this.makeRequest())?.body;
    if (!body) return;

    /* istanbul ignore else: tested using Cypress */
    if ((body as any).getReader === undefined) {
      // https://github.com/node-fetch/node-fetch/issues/930
      const bodyReadable = body as any as Readable;
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
      return pipeToPolyfill(body, sink);
    }

    // eslint-disable-next-line node/no-unsupported-features/es-syntax
    const { Readable } = (await import('stream')).default; // This only happens in node.
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
  // This function returns double promise to make both xo and TS happy. V8 doesn't care.
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

export class ApiError extends HTTPError {
  name = 'ApiError';
  public readonly message: string;

  public constructor(
    /** @see attachContext */
    request: Request & { context?: string },
    options: NormalizedOptions,
    response: Response,
    message: string, // Workaround for https://github.com/sindresorhus/ky/issues/148.
  ) {
    super(response, request, options);
    this.message = request.context ? `error in ${request.context}: ${message}` : message;
  }

  public static async fromHTTPError(error: HTTPError): Promise<ApiError> {
    const res = error.response;
    return new ApiError(error.request, error.options, res, (await res.json()).error);
  }
}

function isApiErrorResponse(response: Response): boolean {
  const isJson = response.headers.get('content-type')?.startsWith('application/json') ?? false;
  return !response.ok && isJson;
}
