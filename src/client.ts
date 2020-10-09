import { WriteStream } from 'fs';

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import FormData from 'form-data';
import { PassThrough, Readable, Writable } from 'readable-stream';
import { paramCase } from 'param-case';
import { JsonObject } from 'type-fest';

import { TokenProvider } from './token';

const DEFAULT_API_URL = 'https://api.oasislabs.com/parcel/v1';

export type Config = Partial<{
    apiUrl: string;
    httpClient: AxiosInstance;
}>;

export class Client {
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
        parameters: JsonObject = {},
        axiosConfig?: AxiosRequestConfig,
    ): Promise<T> {
        const kebabCaseParams: JsonObject = {};
        for (const [k, v] of Object.entries(parameters)) {
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
        data: JsonObject | FormData,
        axiosConfig?: AxiosRequestConfig,
    ): Promise<T> {
        return this.axios.post(endpoint, data, axiosConfig).then((r) => r.data);
    }

    public async patch<T>(endpoint: string, parameters: JsonObject): Promise<T> {
        return this.axios.patch(endpoint, parameters).then((r) => r.data);
    }

    public async delete(endpoint: string): Promise<void> {
        return this.axios
            .delete(endpoint, {
                validateStatus: (s) => s === 204,
            })
            .then(() => undefined);
    }

    public download(endpoint: string): Download {
        return 'fetch' in globalThis ? this.downloadBrowser(endpoint) : this.downloadNode(endpoint);
    }

    private downloadBrowser(endpoint: string): Download {
        const abortController = new AbortController();
        const res = this.getHeaders().then(async (headers) => {
            return fetch(`${this.apiUrl}${endpoint}`, {
                method: 'GET',
                headers,
                signal: abortController.signal,
            });
        });
        const dl = new Download({
            read() {
                res.then(async (res) => {
                    if (!res.body) return this.push(null);

                    const rdr = res.body.getReader();
                    let chunk;
                    do {
                        // eslint-disable-next-line no-await-in-loop
                        chunk = await rdr.read(); // Loop iterations are not independent.
                        if (!chunk.value) continue;
                        if (!this.push(chunk.value)) break;
                    } while (!chunk.done);

                    if (chunk.done) this.push(null);
                }).catch((error) => this.destroy(error));
            },
            destroy(error, cb) {
                abortController.abort();
                cb(error);
            },
        });
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
    public async pipeTo(sink: Writable | WriteStream): Promise<void> {
        return new Promise((resolve, reject) => {
            this.on('error', reject).pipe(sink).on('finish', resolve).on('error', reject);
        });
    }
}
