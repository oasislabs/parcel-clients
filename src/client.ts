import { AxiosInstance, AxiosRequestConfig } from 'axios';
import FormData from 'form-data';
import { paramCase } from 'param-case';
import { JsonObject } from 'type-fest';

import { TokenProvider } from './token';

export class Client {
    public constructor(
        private readonly axios: AxiosInstance,
        private readonly tokenProvider: TokenProvider,
    ) {
        axios.interceptors.request.use(async (config) => {
            config.headers = config.headers ?? {};
            config.headers.authorization = `Bearer ${await tokenProvider.getToken()}`;
            return config;
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
}
