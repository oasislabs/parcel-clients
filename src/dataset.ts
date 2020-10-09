import { WriteStream } from 'fs';

import axios, { CancelTokenSource } from 'axios';
import EventEmitter from 'eventemitter3';
import FormData from 'form-data';
import { Readable, Writable } from 'readable-stream';
import { JsonObject, Opaque, RequireAtLeastOne } from 'type-fest';

import { AppId } from './app';
import { Client } from './client';
import { IdentityId } from './identity';
import { Model, Page, PageParams, PODModel, ResourceId, containsUpdate } from './model';

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
     * you want to use it with the `dataset.tags` filter.
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
    public createTimestamp: number;
    public creator: IdentityId;
    public owner: IdentityId;
    public metadata: DatasetMetadata;

    public constructor(private readonly client: Client, pod: PODDataset) {
        this.id = pod.id as DatasetId;
        this.createTimestamp = pod.createTimestamp;
        this.creator = pod.creator as IdentityId;
        this.owner = pod.owner as IdentityId;
        this.metadata = pod.metadata ?? {};
    }

    public static async get(client: Client, id: DatasetId): Promise<Dataset> {
        return client
            .get<PODDataset>(DatasetImpl.endpointForId(id))
            .then((podDataset) => new DatasetImpl(client, podDataset));
    }

    public static async list(
        client: Client,
        filter?: ListDatasetsFilter & PageParams,
    ): Promise<Page<Dataset>> {
        const podPage = await client.get<Page<PODDataset>>(DATASETS_EP, filter);
        const results = podPage.results.map((podDataset) => new DatasetImpl(client, podDataset));
        return {
            results,
            nextPageToken: podPage.nextPageToken,
        };
    }

    public static upload(client: Client, data: Storable, parameters?: DatasetUploadParams): Upload {
        return new Upload(client, data, parameters);
    }

    public static download(client: Client, id: DatasetId): Download {
        return new Download(
            client.get<Readable>(DatasetImpl.endpointForId(id) + '/download', undefined, {
                responseType: 'stream',
            }),
        );
    }

    public static async update(
        client: Client,
        id: DatasetId,
        parameters: DatasetUpdateParams,
    ): Promise<Dataset> {
        if (!containsUpdate(parameters)) {
            return DatasetImpl.get(client, id);
        }

        return client
            .patch<PODDataset>(DatasetImpl.endpointForId(id), parameters)
            .then((podDataset) => new DatasetImpl(client, podDataset));
    }

    public static async delete(client: Client, id: DatasetId): Promise<void> {
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

export type Storable = Uint8Array | Readable;

export type ListDatasetsFilter = { ownedBy: IdentityId } | { sharedWith: IdentityId };

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

    constructor(client: Client, data: Storable, parameters?: DatasetUploadParams) {
        super();
        this.cancelToken = axios.CancelToken.source();
        const form = new FormData();
        if (parameters) {
            const parametersString = JSON.stringify(parameters);
            form.append('metadata', parametersString, {
                contentType: 'application/json',
                knownLength: parametersString.length,
            });
        }

        form.append('data', data, {
            contentType: 'application/octet-stream',
            knownLength: (data as any).length,
        });
        client
            .post<PODDataset>(DATASETS_EP, form, {
                headers: form.getHeaders(),
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

export class Download extends Readable {
    constructor(private readonly downloadResponse: Promise<Readable>) {
        super();
    }

    /** Aborts the download. */
    public abort(): void {
        this.destroy();
        this.downloadResponse.then(Readable.prototype.destroy.call).catch(() => {
            /* The client doesn't care about the response, so we can ignore the error. */
        });
    }

    public _read(): void {
        const errorHandler = (error: any) => this.destroy(error);
        this.downloadResponse
            .then((dl: Readable) => {
                dl.on('error', errorHandler)
                    .on('end', () => this.push(null))
                    .on('readable', () => {
                        let data;
                        while ((data = dl.read())) {
                            this.push(data);
                        }
                    });
            })
            .catch(errorHandler);
    }

    /** Convenience method for piping to a sink and waiting for writing to finish. */
    public async pipeTo(sink: Writable | WriteStream): Promise<void> {
        return new Promise((resolve, reject) => {
            this.on('error', reject).pipe(sink).on('finish', resolve).on('error', reject);
        });
    }
}
