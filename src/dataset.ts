import axios, { CancelTokenSource } from 'axios';
import EventEmitter from 'eventemitter3';
import FormData from 'form-data';
import { Readable } from 'readable-stream';
import type { JsonObject, Opaque, RequireAtLeastOne, RequireExactlyOne } from 'type-fest';

import type { AppId } from './app';
import type { HttpClient, Download } from './http';
import type { IdentityId } from './identity';
import type { Model, Page, PageParams, PODModel, ResourceId } from './model';

export type DatasetId = Opaque<ResourceId>;

export type PODDataset = PODModel & {
    id: ResourceId;
    creator: ResourceId;
    owner: ResourceId;
    metadata?: DatasetMetadata;
};

type DatasetMetadata = JsonObject & { tags?: string[] };

export type DatasetUploadParams = {
    /** The initial owner of the Dataset. Leave unset to default to you, the creator. */
    owner?: IdentityId;

    /**
     * Dataset metadata. The well-known value `tags` should be an array of strings if
     * you want to use it with the `dataset.metadata.tags` filter.
     */
    metadata?: DatasetMetadata;

    /**
     * The id of the app for which data is being uploaded. This is for convenience
     * and is equivalent to uploading a dataset with tags that allow access to an
     * app for the owner's currently granted consents.
     */
    forApp?: AppId;
};

export interface Dataset extends Model {
    /** The unique ID of the Dataset. */
    id: DatasetId;

    /** The Identity that created the Dataset. */
    creator: IdentityId;

    /** The time at which this dataset was created. */
    createdAt: Date;

    /** The current owner of the Dataset. */
    owner: IdentityId;

    /**
     * Dataset metadata. The well-known value `tags` must be an array of strings if
     * you want to use it with the `dataset.metadata.tags` filter.
     */
    metadata: DatasetMetadata;

    /**
     * Downloads the private data
     * @returns the decrypted data as a stream
     */
    download: () => Download;

    /**
     * Updates the dataset according to the provided `params`.
     * @returns the updated `this`
     * @throws ParcelError
     */
    update: (params: DatasetUpdateParams) => Promise<Dataset>;

    /**
     * Deletes the dataset.
     * @throws `ParcelError`
     */
    delete: () => Promise<void>;
}

const DATASETS_EP = '/datasets';

export class DatasetImpl implements Dataset {
    public id: DatasetId;
    public createdAt: Date;
    public creator: IdentityId;
    public owner: IdentityId;
    public metadata: DatasetMetadata;

    public constructor(private readonly client: HttpClient, pod: PODDataset) {
        this.id = pod.id as DatasetId;
        this.createdAt = new Date(pod.createdAt);
        this.creator = pod.creator as IdentityId;
        this.owner = pod.owner as IdentityId;
        this.metadata = pod.metadata ?? {};
    }

    public static async get(client: HttpClient, id: DatasetId): Promise<Dataset> {
        return client
            .get<PODDataset>(DatasetImpl.endpointForId(id))
            .then((podDataset) => new DatasetImpl(client, podDataset));
    }

    public static async list(
        client: HttpClient,
        filter?: ListDatasetsFilter & PageParams,
    ): Promise<Page<Dataset>> {
        let tagsFilter;
        if (filter?.tags) {
            const tagsSpec = filter.tags;
            const prefix = Array.isArray(tagsSpec) || tagsSpec.all ? 'all' : 'any';
            const tags = Array.isArray(tagsSpec) ? tagsSpec : tagsSpec.all ?? tagsSpec.any;
            tagsFilter = `${prefix}:${tags.join(',')}`;
        }

        const podPage = await client.get<Page<PODDataset>>(DATASETS_EP, {
            ...filter,
            tags: tagsFilter,
        });
        const results = podPage.results.map((podDataset) => new DatasetImpl(client, podDataset));
        return {
            results,
            nextPageToken: podPage.nextPageToken,
        };
    }

    public static upload(
        client: HttpClient,
        data: Storable,
        parameters?: DatasetUploadParams,
    ): Upload {
        return new Upload(client, data, parameters);
    }

    public static download(client: HttpClient, id: DatasetId): Download {
        return client.download(`${DatasetImpl.endpointForId(id)}/download`);
    }

    public static async update(
        client: HttpClient,
        id: DatasetId,
        parameters: DatasetUpdateParams,
    ): Promise<Dataset> {
        return client
            .patch<PODDataset>(DatasetImpl.endpointForId(id), parameters)
            .then((podDataset) => new DatasetImpl(client, podDataset));
    }

    public static async delete(client: HttpClient, id: DatasetId): Promise<void> {
        return client.delete(DatasetImpl.endpointForId(id));
    }

    private static endpointForId(id: DatasetId): string {
        return `/datasets/${id}`;
    }

    public download(): Download {
        return DatasetImpl.download(this.client, this.id);
    }

    public async update(parameters: DatasetUpdateParams): Promise<Dataset> {
        Object.assign(this, await DatasetImpl.update(this.client, this.id, parameters));
        return this;
    }

    public async delete(): Promise<void> {
        return this.client.delete(DatasetImpl.endpointForId(this.id));
    }
}

export type DatasetUpdateParams = RequireAtLeastOne<{
    /** The ID of the new owner's Identity. */
    owner: IdentityId;
    /**
     * Mappings that will be merged into the existing metadata.
     * A value of `null` represents delete.
     */
    metadata: JsonObject;
}>;

export type Storable = Uint8Array | Readable | Blob | string;

export type ListDatasetsFilter = Partial<{
    creator: IdentityId;
    owner: IdentityId;
    sharedWith: IdentityId;
    tags:
        | string[]
        | RequireExactlyOne<{
              any: string[];
              all: string[];
          }>;
}>;

/**
 * An `Upload` is the result of calling `parcel.uploadDataset`.
 *
 * During upload, emits `progress` events, each with a `ProgressEvent` as its argument.
 *
 * When the dataset has been uploaded, the `finish` event is emitted with the `Dataset`
 * reference as its argument.
 */
export class Upload extends EventEmitter {
    public aborted = false;

    private readonly cancelToken: CancelTokenSource;

    constructor(client: HttpClient, data: Storable, parameters?: DatasetUploadParams) {
        super();
        this.cancelToken = axios.CancelToken.source();
        const form = new FormData();

        const appendPart = (name: string, data: Storable, contentType: string, length?: number) => {
            if (typeof Blob === 'undefined') {
                // If Blob isn't present, we're likely in Node and should use the `form-data` API.
                form.append(name, data, {
                    contentType,
                    knownLength: length,
                });
            } else {
                // If `Blob` eixsts, we're probably in the browser and will pefer to use it.
                if (typeof data === 'string' || data instanceof Uint8Array) {
                    data = new Blob([data], { type: contentType });
                } else if (data instanceof Readable) {
                    throw new TypeError('uploaded data must be a `Blob` or `Uint8Array`');
                }

                form.append(name, data);
            }
        };

        if (parameters) {
            const parametersString = JSON.stringify(parameters);
            appendPart('metadata', parametersString, 'application/json', parametersString.length);
        }

        appendPart('data', data, 'application/octet-stream', (data as any).length);

        client
            .post<PODDataset>(DATASETS_EP, form, {
                headers: form.getHeaders ? /* node */ form.getHeaders() : undefined,
                cancelToken: this.cancelToken.token,
                onUploadProgress: this.emit.bind(this, 'progress'),
                validateStatus: (s) => s === 201 /* Created */,
            })
            .then((podDataset) => {
                this.emit('finish', new DatasetImpl(client, podDataset));
            })
            .catch((error: any) => {
                if (!axios.isCancel(error)) {
                    this.emit('error', error);
                }
            });
    }

    /** Aborts the upload. Emits an `abort` event and sets the `aborted` flag. */
    public abort(): void {
        this.cancelToken.cancel();
        this.aborted = true;
        this.emit('abort');
    }

    /**
     * @returns a `Promise` that resolves when the upload stream has finished.
     */
    public get finished(): Promise<Dataset> {
        return new Promise((resolve, reject) => {
            this.on('finish', resolve);
            this.on('error', reject);
        });
    }
}
