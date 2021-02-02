import EventEmitter from 'eventemitter3';
import FormData from 'form-data';
import type { Readable } from 'readable-stream';
import type { JsonObject, Opaque, RequireExactlyOne, SetOptional } from 'type-fest';

import type { HttpClient, Download } from './http.js';
import type { IdentityId } from './identity.js';
import type { Model, Page, PageParams, PODModel, ResourceId, WritableExcluding } from './model.js';

export type DatasetId = Opaque<ResourceId>;

export type PODDataset = PODModel & {
  id: ResourceId;
  creator: ResourceId;
  owner: ResourceId;
  size: number;
  details: DatasetDetails;
};

export type PODAccessEvent = {
  createdAt: string;
  dataset: ResourceId;
  accessor: ResourceId;
};

type DatasetDetails = JsonObject & { title?: string; tags?: string[] };

export class Dataset implements Model {
  public id: DatasetId;
  public createdAt: Date;
  public creator: IdentityId;
  public size: number;
  public owner: IdentityId;

  /** Additional, optional information about the dataset. */
  public details: DatasetDetails;

  public constructor(private readonly client: HttpClient, pod: PODDataset) {
    this.id = pod.id as DatasetId;
    this.createdAt = new Date(pod.createdAt);
    this.creator = pod.creator as IdentityId;
    this.owner = pod.owner as IdentityId;
    this.size = pod.size;
    this.details = pod.details;
  }

  /**
   * Downloads the private data referenced by the dataset if the authorized identity
   * has been granted access.
   * @returns the decrypted data as a stream
   */
  public download(): Download {
    return DatasetImpl.download(this.client, this.id);
  }

  public async update(params: DatasetUpdateParams): Promise<Dataset> {
    Object.assign(this, await DatasetImpl.update(this.client, this.id, params));
    return this;
  }

  public async delete(): Promise<void> {
    return DatasetImpl.delete_(this.client, this.id);
  }

  public async history(filter?: ListAccessLogFilter & PageParams): Promise<Page<AccessEvent>> {
    return DatasetImpl.history(this.client, this.id, filter);
  }
}

export namespace DatasetImpl {
  export async function get(client: HttpClient, id: DatasetId): Promise<Dataset> {
    return client
      .get<PODDataset>(endpointForId(id))
      .then((podDataset) => new Dataset(client, podDataset));
  }

  export async function list(
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
    const results = podPage.results.map((podDataset) => new Dataset(client, podDataset));
    return {
      results,
      nextPageToken: podPage.nextPageToken,
    };
  }

  export function upload(client: HttpClient, data: Storable, params?: DatasetUploadParams): Upload {
    return new Upload(client, data, params);
  }

  export function download(client: HttpClient, id: DatasetId): Download {
    return client.download(endpointForId(id) + '/download');
  }

  export async function history(
    client: HttpClient,
    id: DatasetId,
    filter?: ListAccessLogFilter & PageParams,
  ): Promise<Page<AccessEvent>> {
    const podPage = await client.get<Page<PODAccessEvent>>(endpointForId(id) + '/history', {
      ...filter,
      // Dates must be string-ified since request parameters are of type JSONObject
      // and doesn't support Date.
      after: filter?.after?.getTime(),
      before: filter?.before?.getTime(),
    });

    const results = podPage.results.map((podAccessEvent) => {
      return {
        createdAt: new Date(podAccessEvent.createdAt),
        dataset: podAccessEvent.dataset as DatasetId,
        accessor: podAccessEvent.accessor as IdentityId,
      };
    });
    return {
      results,
      nextPageToken: podPage.nextPageToken,
    };
  }

  export async function update(
    client: HttpClient,
    id: DatasetId,
    params: DatasetUpdateParams,
  ): Promise<Dataset> {
    return client
      .update<PODDataset>(endpointForId(id), params)
      .then((podDataset) => new Dataset(client, podDataset));
  }

  export async function delete_(client: HttpClient, id: DatasetId): Promise<void> {
    return client.delete(endpointForId(id));
  }
}

const DATASETS_EP = 'datasets';
const endpointForId = (id: DatasetId) => `${DATASETS_EP}/${id}`;

export type DatasetUpdateParams = WritableExcluding<Dataset, 'creator' | 'size'>;
export type DatasetUploadParams = SetOptional<DatasetUpdateParams, 'owner' | 'details'>;

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

export type AccessEvent = {
  createdAt: Date;
  dataset: DatasetId;
  accessor: IdentityId;
};

export type ListAccessLogFilter = Partial<{
  accessor: IdentityId;
  after: Date;
  before: Date;
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
  private readonly abortController: AbortController;

  constructor(client: HttpClient, data: Storable, params?: DatasetUploadParams) {
    super();

    this.abortController = new AbortController();

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
        } else if ('pipe' in data) {
          throw new TypeError('uploaded data must be a `string`, `Blob`, or `Uint8Array`');
        }

        form.append(name, data);
      }
    };

    if (params) {
      const paramsString = JSON.stringify(params);
      appendPart('metadata', paramsString, 'application/json', paramsString.length);
    }

    appendPart('data', data, 'application/octet-stream', (data as any).length);

    client
      .create<PODDataset>(DATASETS_EP, form, {
        headers: 'getHeaders' in form ? /* node */ form.getHeaders() : undefined,
        signal: this.abortController.signal,
      })
      .then((podDataset) => {
        this.emit('finish', new Dataset(client, podDataset));
      })
      .catch((error: any) => {
        this.emit('error', error);
      });
  }

  /** Aborts the upload. Emits an `abort` event and sets the `aborted` flag. */
  public abort(): void {
    this.abortController.abort();
    this.emit('abort');
  }

  public get aborted(): boolean {
    return this.abortController.signal.aborted;
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
