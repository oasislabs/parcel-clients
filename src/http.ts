import type { WriteStream } from 'fs';

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import type FormData from 'form-data';
import { PassThrough, Readable, Writable } from 'readable-stream';
import { paramCase } from 'param-case';
import type { JsonObject } from 'type-fest';

import { version as packageVersion, name as packageName } from '../package.json';
import type { TokenProvider } from './token';

const DEFAULT_API_URL = 'https://api.oasislabs.com/parcel/v1';

export type Config = Partial<{
  apiUrl: string;
  httpClient: AxiosInstance;
}>;

export class HttpClient {
  public readonly apiUrl: string;

  private readonly axios: AxiosInstance;

  public constructor(private readonly tokenProvider: TokenProvider, config?: Config) {
    this.apiUrl = config?.apiUrl?.replace(/\/$/, '') ?? DEFAULT_API_URL;
    this.axios =
      config?.httpClient ??
      axios.create({
        baseURL: this.apiUrl,
      });

    this.axios.interceptors.request.use(async (config) => {
      return {
        ...config,
        headers: {
          ...(await this.getHeaders()),
          ...config.headers,
        },
      };
    });
  }

  public async get<T>(
    endpoint: string,
    params: JsonObject = {},
    axiosConfig?: AxiosRequestConfig,
  ): Promise<T> {
    const kebabCaseParams: JsonObject = {};
    for (const [k, v] of Object.entries(params)) {
      kebabCaseParams[paramCase(k)] = v;
    }

    return this.axios
      .get(endpoint, Object.assign({ params: kebabCaseParams }, axiosConfig))
      .then((r) => r.data);
  }

  /** Convenience method for POSTing and expecting a 201 response */
  public async create<T>(endpoint: string, data: JsonObject): Promise<T> {
    return this.post(endpoint, data, {
      validateStatus: (s) => s === 201,
    });
  }

  public async post<T>(
    endpoint: string,
    data: JsonObject | FormData | undefined,
    axiosConfig?: AxiosRequestConfig,
  ): Promise<T> {
    return this.axios.post(endpoint, data, axiosConfig).then((r) => r.data);
  }

  public async update<T>(endpoint: string, params: JsonObject): Promise<T> {
    return this.put(endpoint, params);
  }

  public async put<T>(endpoint: string, params: JsonObject): Promise<T> {
    return this.axios.put(endpoint, params).then((r) => r.data);
  }

  public async delete(endpoint: string): Promise<void> {
    return this.axios
      .delete(endpoint, {
        validateStatus: (s) => s === 204,
      })
      .then(() => undefined);
  }

  public download(endpoint: string): Download {
    /* istanbul ignore if */
    return 'fetch' in globalThis ? this.downloadBrowser(endpoint) : this.downloadNode(endpoint);
  }

  /* istanbul ignore next */
  // This is tested using Cypress, which produces bogus line numbers.
  private downloadBrowser(endpoint: string): Download {
    const abortController = new AbortController();
    const res = this.getHeaders().then(async (headers) => {
      const res = await fetch(`${this.apiUrl}${endpoint}`, {
        method: 'GET',
        headers,
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errorMessage: string = (await res.json()).error;
        const error = new Error(`failed to fetch dataset: ${errorMessage}`);
        (error as any).response = res;
        throw error;
      }

      return res;
    });
    const reader = res.then((res) => {
      if (!res.body) return null;
      return res.body.getReader();
    });
    const dl = new (class extends Download {
      public _read(): void {
        reader
          .then(async (rdr) => {
            if (!rdr) return this.push(null);

            let chunk;
            do {
              // eslint-disable-next-line no-await-in-loop
              chunk = await rdr.read(); // Loop iterations are not independent.
              if (!chunk.value) continue;
              if (!this.push(chunk.value)) break;
            } while (!chunk.done);

            if (chunk.done) this.push(null);
          })
          .catch((error: any) => this.destroy(error));
      }

      public _destroy(error: Error, cb: (error?: Error) => void): void {
        abortController.abort();
        void res.then((res) => res.body?.cancel());
        cb(error);
      }
    })();
    res.catch((error) => dl.destroy(error));
    return dl;
  }

  private downloadNode(endpoint: string): Download {
    const cancelToken = axios.CancelToken.source();
    const pt: Download = Object.assign(new PassThrough(), {
      pipeTo: Download.prototype.pipeTo,
      destroy: (error: any) => {
        cancelToken.cancel();
        PassThrough.prototype.destroy.call(pt, error);
      },
    });
    this.axios
      .get(endpoint, {
        responseType: 'stream',
        cancelToken: cancelToken.token,
      })
      .then((res) => {
        res.data?.on('error', (error: Error) => pt.destroy(error)).pipe(pt);
      })
      .catch((error: Error) => pt.destroy(error));
    return pt;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    return {
      authorization: `Bearer ${await this.tokenProvider.getToken()}`,
      'user-agent': `${packageName}/${packageVersion}`,
    };
  }
}

/**
 * A `Download` is the result of calling `parcel.downloadDataset` or `dataset.download()`.
 *
 * The downloaded data can be read using the Node `stream.Readable` interface, or by
 * calling `await downlad.pipeTo(sink)`.
 *
 * The download may be aborted by calling `download.destroy()`, as with any `Readable`.
 */
export class Download extends Readable {
  /** Convenience method for piping to a sink and waiting for writing to finish. */
  public async pipeTo(sink: Writable | WriteStream | WritableStream): Promise<void> {
    /* istanbul ignore if */ // This is tested using Cypress.
    if ('getWriter' in sink) {
      const writer = sink.getWriter();
      return new Promise((resolve, reject) => {
        this.on('error', reject)
          .on('data', (chunk) => {
            void writer.ready.then(async () => writer.write(chunk)).catch(reject);
          })
          .on('end', () => {
            writer.ready
              .then(async () => writer.close())
              .then(resolve)
              .catch(reject);
          });
      });
    }

    return new Promise((resolve, reject) => {
      this.on('error', reject).pipe(sink).on('finish', resolve).on('error', reject);
    });
  }
}
