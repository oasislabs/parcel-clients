import type { ReadStream } from 'fs';

import EventEmitter from 'eventemitter3';
import FormData from 'form-data';
import type { Readable } from 'readable-stream';
import type { Opaque, SetOptional } from 'type-fest';

import type { AppId } from './app.js';
import type { AccessContext } from './asset.js';
import type { JobId } from './compute.js';
import type { Condition } from './condition.js';
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
  public readonly details: DocumentDetails;

  /** Additional, optional information about the document. */
  public readonly originatingJob?: JobId;

  #client: HttpClient;

  public constructor(client: HttpClient, pod: PODDocument) {
    this.#client = client;
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
   * @returns the decrypted data as a pipeable stream and AsyncIterable
   */
  public download(): Download {
    return DocumentImpl.download(this.#client, this.id);
  }

  public async update(params: DocumentUpdateParams): Promise<Document> {
    Object.assign(this, await DocumentImpl.update(this.#client, this.id, params));
    return this;
  }

  public async delete(): Promise<void> {
    return DocumentImpl.delete_(this.#client, this.id);
  }

  public async history(filter?: ListAccessLogFilter & PageParams): Promise<Page<AccessEvent>> {
    return DocumentImpl.history(this.#client, this.id, filter);
  }
}

export namespace DocumentImpl {
  export async function get(client: HttpClient, id: DocumentId): Promise<Document> {
    const podDocument = await client.get<PODDocument>(endpointForId(id));
    return new Document(client, podDocument);
  }

  export async function search(
    client: HttpClient,
    params?: DocumentSearchParams & PageParams,
  ): Promise<Page<Document>> {
    const podPage = await client.search<PODDocument>(DOCUMENTS_EP, params);
    return makePage(Document, podPage, client);
  }

  export function upload(
    client: HttpClient,
    data: Storable,
    params: DocumentUploadParams | undefined | null,
  ): Upload {
    return new Upload(client, data, params ?? undefined);
  }

  export function download(client: HttpClient, id: DocumentId): Download {
    return client.download(endpointForId(id) + '/download');
  }

  export async function history(
    client: HttpClient,
    id: DocumentId,
    filter?: ListAccessLogFilter & PageParams,
  ): Promise<Page<AccessEvent>> {
    const podPage = await client.get<Page<PODAccessEvent>>(endpointForId(id) + '/history', filter);

    const results = podPage.results.map((podAccessEvent) => ({
      createdAt: new Date(podAccessEvent.createdAt),
      document: podAccessEvent.document as DocumentId,
      accessor: podAccessEvent.accessor as IdentityId,
    }));
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
export type DocumentUploadParams = SetOptional<DocumentUpdateParams, 'owner' | 'details'> & {
  toApp: AppId | undefined;
};

export type Storable = Uint8Array | Readable | ReadStream | Blob | string;

/**
 * A very flexible document search interface.
 *
 * ## Examples:
 *
 * ### Search for documents you own
 *
 * ```
 * {
 *   selectedByCondition: { 'document.owner': { $eq: (await parcel.getCurrentIdentity()).id } },
 * }
 * ```
 *
 * ### Search for documents shared with you
 *
 * ```
 * let me = (await parcel.getCurrentIdentity()).id;
 * {
 *   selectedByCondition: { 'document.owner': { $ne: me } },
 *   accessibleInContext: { accessor: me },
 * }
 * ```
 *
 * ### Search for documents with tags
 *
 * ```
 * {
 *   selectedByCondition: {
 *     'document.tags': { $intersects: ['csv', 'json'] }
 *   },
 * }
 * ```
 *
 */
export type DocumentSearchParams = {
  /**
   * Searches for documents that would be selected if a grant with the
   * specified condition were created. Use this field for simulating a grant.
   *
   * If `accessibleInContext` is also specified, this field selects documents
   * both accessible in the context and selected by the condition (i.e. existing
   * conditions apply).
   */
  selectedByCondition?: Condition;

  /**
   * Searches for documents that can be accessed in the provided context.
   * This field allows you to discover documents that you can access either
   * yourself, or from a job.
   */
  accessibleInContext?: AccessContext;
};

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

  constructor(client: HttpClient, data: Storable, sdkParams?: DocumentUploadParams) {
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
        // If `Blob` exists, we're probably in the browser and will prefer to use it.
        if (typeof data === 'string' || data instanceof Uint8Array) {
          data = new Blob([data], { type: contentType });
        } else if ('pipe' in data) {
          throw new TypeError('uploaded data must of type `Storable`');
        }

        form.append(name, data);
      }
    };

    if (sdkParams) {
      const { toApp, ...parcelParams } = sdkParams;
      if (toApp) {
        parcelParams.details = {
          ...parcelParams.details,
          tags: [...(parcelParams?.details?.tags ?? []), `to-app-${toApp}`],
        };
      }

      const paramsString = JSON.stringify(parcelParams);
      appendPart('metadata', paramsString, 'application/json', paramsString.length);
    }

    appendPart('data', data, 'application/octet-stream', (data as any).length);

    client
      .upload(form, {
        headers: 'getHeaders' in form ? /* node */ form.getHeaders() : undefined,
        signal: this.abortController.signal,
        timeout: false,
      })
      // eslint-disable-next-line promise/prefer-await-to-then
      .then((podDocument) => {
        this.emit('finish', new Document(client, podDocument));
      })
      // eslint-disable-next-line promise/prefer-await-to-then
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
