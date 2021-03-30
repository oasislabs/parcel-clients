import EventEmitter from 'eventemitter3';
import FormData from 'form-data';
import type { Readable } from 'readable-stream';
import type { Opaque, RequireExactlyOne, SetOptional } from 'type-fest';

import type { JobId } from './compute.js';
import type { HttpClient, Download } from './http.js';
import type { IdentityId } from './identity.js';
import type { Model, Page, PageParams, PODModel, ResourceId, WritableExcluding } from './model.js';
import { makePage } from './model.js';

export type DocumentId = Opaque<ResourceId, 'DocumentId'>;

export type PODDocument = Readonly<
  PODModel & {
    creator: ResourceId;
    owner: ResourceId;
    size: number;
    details: DocumentDetails;
    originatingJob?: JobId;
  }
>;

export type PODAccessEvent = Readonly<{
  createdAt: string;
  document: ResourceId;
  accessor: ResourceId;
}>;

type DocumentDetails = { title?: string; tags?: string[] };

export class Document implements Model {
  public readonly id: DocumentId;
  public readonly createdAt: Date;
  public readonly creator: IdentityId;
  public readonly size: number;
  public readonly owner: IdentityId;

  /** Additional, optional information about the document. */
  public readonly details: DocumentDetails;
  public readonly originatingJob?: JobId;

  public constructor(private readonly client: HttpClient, pod: PODDocument) {
    this.id = pod.id as DocumentId;
    this.createdAt = new Date(pod.createdAt);
    this.creator = pod.creator as IdentityId;
    this.owner = pod.owner as IdentityId;
    this.size = pod.size;
    this.details = pod.details;
    this.originatingJob = pod.originatingJob;
  }

  /**
   * Downloads the private data referenced by the document if the authorized identity
   * has been granted access.
   * @returns the decrypted data as a stream
   */
  public download(): Download {
    return DocumentImpl.download(this.client, this.id);
  }

  public async update(params: DocumentUpdateParams): Promise<Document> {
    Object.assign(this, await DocumentImpl.update(this.client, this.id, params));
    return this;
  }

  public async delete(): Promise<void> {
    return DocumentImpl.delete_(this.client, this.id);
  }

  public async history(filter?: ListAccessLogFilter & PageParams): Promise<Page<AccessEvent>> {
    return DocumentImpl.history(this.client, this.id, filter);
  }
}

export namespace DocumentImpl {
  export async function get(client: HttpClient, id: DocumentId): Promise<Document> {
    const podDocument = await client.get<PODDocument>(endpointForId(id));
    return new Document(client, podDocument);
  }

  export async function list(
    client: HttpClient,
    filter?: ListDocumentsFilter & PageParams,
  ): Promise<Page<Document>> {
    let tagsFilter;
    if (filter?.tags) {
      const tagsSpec = filter.tags;
      const prefix = Array.isArray(tagsSpec) || tagsSpec.all ? 'all' : 'any';
      const tags = Array.isArray(tagsSpec) ? tagsSpec : tagsSpec.all ?? tagsSpec.any;
      tagsFilter = `${prefix}:${tags.join(',')}`;
    }

    const podPage = await client.get<Page<PODDocument>>(DOCUMENTS_EP, {
      ...filter,
      tags: tagsFilter,
    });
    return makePage(Document, podPage, client);
  }

  export function upload(
    client: HttpClient,
    data: Storable,
    params?: DocumentUploadParams,
  ): Upload {
    return new Upload(client, data, params);
  }

  export function download(client: HttpClient, id: DocumentId): Download {
    return client.download(endpointForId(id) + '/download');
  }

  export async function history(
    client: HttpClient,
    id: DocumentId,
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
        document: podAccessEvent.document as DocumentId,
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
    id: DocumentId,
    params: DocumentUpdateParams,
  ): Promise<Document> {
    const podDocument = await client.update<PODDocument>(endpointForId(id), params);
    return new Document(client, podDocument);
  }

  export async function delete_(client: HttpClient, id: DocumentId): Promise<void> {
    return client.delete(endpointForId(id));
  }
}

const DOCUMENTS_EP = 'documents';
const endpointForId = (id: DocumentId) => `${DOCUMENTS_EP}/${id}`;

export type DocumentUpdateParams = WritableExcluding<
  Document,
  'creator' | 'size' | 'originatingJob'
>;
export type DocumentUploadParams = SetOptional<DocumentUpdateParams, 'owner' | 'details'>;

export type Storable = Uint8Array | Readable | Blob | string;

export type ListDocumentsFilter = Partial<{
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
  document: DocumentId;
  accessor: IdentityId;
};

export type ListAccessLogFilter = Partial<{
  accessor: IdentityId;
  after: Date;
  before: Date;
}>;

/**
 * An `Upload` is the result of calling `parcel.uploadDocument`.
 *
 * During upload, emits `progress` events, each with a `ProgressEvent` as its argument.
 *
 * When the document has been uploaded, the `finish` event is emitted with the `Document`
 * reference as its argument.
 */
export class Upload extends EventEmitter {
  private readonly abortController: AbortController;

  constructor(client: HttpClient, data: Storable, params?: DocumentUploadParams) {
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
      .create<PODDocument>(DOCUMENTS_EP, form, {
        headers: 'getHeaders' in form ? /* node */ form.getHeaders() : undefined,
        signal: this.abortController.signal,
        timeout: false,
      })
      // eslint-disable-next-line promise/prefer-await-to-then
      .then((podDocument) => {
        this.emit('finish', new Document(client, podDocument));
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
  public get finished(): Promise<Document> {
    return new Promise((resolve, reject) => {
      this.on('finish', resolve);
      this.on('error', reject);
    });
  }
}
