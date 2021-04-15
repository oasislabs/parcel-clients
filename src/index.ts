import type { App, AppCreateParams, AppId, AppUpdateParams, ListAppsFilter } from './app.js';
import { AppImpl } from './app.js';
import type {
  Client,
  ClientCreateParams,
  ClientId,
  ClientUpdateParams,
  ListClientsFilter,
} from './client.js';
import type { Job, JobId, JobSpec, JobStatus } from './compute.js';
import {
  ComputeImpl,
  InputDocumentSpec,
  JobPhase,
  OutputDocument,
  OutputDocumentSpec,
} from './compute.js';
import { ClientImpl } from './client.js';
import type {
  AccessEvent,
  Document,
  DocumentId,
  DocumentUpdateParams,
  DocumentUploadParams,
  ListAccessLogFilter,
  ListDocumentsFilter,
  Storable,
  Upload,
} from './document.js';
import { DocumentImpl } from './document.js';
import type { Grant, GrantCreateParams, GrantId } from './grant.js';
import { Capabilities, GrantImpl, ListGrantsFilter } from './grant.js';
import type { Config as ClientConfig, Download } from './http.js';
import { ApiError, HttpClient } from './http.js';
import type {
  Identity,
  IdentityCreateParams,
  IdentityId,
  IdentityUpdateParams,
} from './identity.js';
import { IdentityImpl } from './identity.js';
import type { Page, PageParams } from './model.js';
import type { Permission, PermissionCreateParams, PermissionId } from './permission.js';
import { PermissionImpl } from './permission.js';
import type {
  ClientCredentials,
  PrivateJWK,
  PublicJWK,
  RefreshingTokenProviderParams,
  RenewingTokenProviderParams,
  Scope,
  SelfIssuedTokenProviderParams,
  TokenSource,
} from './token.js';
import { TokenProvider, PARCEL_RUNTIME_AUD } from './token.js';

export {
  AccessEvent,
  ApiError,
  App,
  AppCreateParams,
  AppId,
  AppUpdateParams,
  Capabilities,
  Client,
  ClientCreateParams,
  ClientCredentials,
  ClientId,
  Document,
  DocumentId,
  DocumentUpdateParams,
  DocumentUploadParams,
  Download,
  Grant,
  GrantCreateParams,
  GrantId,
  Identity,
  IdentityCreateParams,
  IdentityId,
  IdentityUpdateParams,
  InputDocumentSpec,
  Job,
  JobId,
  JobPhase,
  JobSpec,
  JobStatus,
  OutputDocument,
  OutputDocumentSpec,
  PARCEL_RUNTIME_AUD,
  Page,
  PageParams,
  Permission,
  PermissionCreateParams,
  PermissionId,
  PrivateJWK,
  PublicJWK,
  RefreshingTokenProviderParams,
  RenewingTokenProviderParams,
  Scope,
  SelfIssuedTokenProviderParams,
  Storable,
  TokenSource,
};

export default class Parcel {
  private currentIdentity?: Identity;
  private readonly client: HttpClient;

  public constructor(tokenSource: TokenSource, config?: Config) {
    const tokenProvider = TokenProvider.fromSource(tokenSource);
    this.client = new HttpClient(tokenProvider, {
      apiUrl: config?.apiUrl,
      httpClientConfig: config?.httpClientConfig,
    });
  }

  public get apiUrl() {
    return this.client.apiUrl;
  }

  public async createIdentity(params: IdentityCreateParams): Promise<Identity> {
    return IdentityImpl.create(this.client, params);
  }

  public async getCurrentIdentity(): Promise<Identity> {
    if (!this.currentIdentity) {
      this.currentIdentity = await IdentityImpl.current(this.client);
    }

    return this.currentIdentity;
  }

  public uploadDocument(data: Storable, params: DocumentUploadParams | undefined | null): Upload {
    return DocumentImpl.upload(this.client, data, params);
  }

  public async getDocument(id: DocumentId): Promise<Document> {
    return DocumentImpl.get(this.client, id);
  }

  public async listDocuments(filter?: ListDocumentsFilter & PageParams): Promise<Page<Document>> {
    return DocumentImpl.list(this.client, filter);
  }

  public downloadDocument(id: DocumentId): Download {
    return DocumentImpl.download(this.client, id);
  }

  public async getDocumentHistory(
    id: DocumentId,
    filter?: ListAccessLogFilter & PageParams,
  ): Promise<Page<AccessEvent>> {
    return DocumentImpl.history(this.client, id, filter);
  }

  public async updateDocument(id: DocumentId, update: DocumentUpdateParams): Promise<Document> {
    return DocumentImpl.update(this.client, id, update);
  }

  public async deleteDocument(id: DocumentId): Promise<void> {
    return DocumentImpl.delete_(this.client, id);
  }

  public async createApp(params: AppCreateParams): Promise<App> {
    return AppImpl.create(this.client, params);
  }

  public async getApp(id: AppId): Promise<App> {
    return AppImpl.get(this.client, id);
  }

  public async listApps(filter?: ListAppsFilter & PageParams): Promise<Page<App>> {
    return AppImpl.list(this.client, filter);
  }

  public async updateApp(id: AppId, update: AppUpdateParams): Promise<App> {
    return AppImpl.update(this.client, id, update);
  }

  public async deleteApp(id: AppId): Promise<void> {
    return AppImpl.delete_(this.client, id);
  }

  public async createPermission(appId: AppId, params: PermissionCreateParams): Promise<Permission> {
    return PermissionImpl.create(this.client, appId, params);
  }

  public async listPermissions(appId: AppId, filter?: PageParams): Promise<Page<Permission>> {
    return PermissionImpl.list(this.client, appId, filter);
  }

  public async deletePermission(appId: AppId, permissionId: PermissionId): Promise<void> {
    return PermissionImpl.delete_(this.client, appId, permissionId);
  }

  public async createClient(appId: AppId, params: ClientCreateParams): Promise<Client> {
    return ClientImpl.create(this.client, appId, params);
  }

  public async getClient(appId: AppId, clientId: ClientId): Promise<Client> {
    return ClientImpl.get(this.client, appId, clientId);
  }

  public async listClients(
    appId: AppId,
    filter?: ListClientsFilter & PageParams,
  ): Promise<Page<Client>> {
    return ClientImpl.list(this.client, appId, filter);
  }

  public async updateClient(
    appId: AppId,
    clientId: ClientId,
    update: ClientUpdateParams,
  ): Promise<Client> {
    return ClientImpl.update(this.client, appId, clientId, update);
  }

  public async deleteClient(appId: AppId, clientId: ClientId): Promise<void> {
    return ClientImpl.delete_(this.client, appId, clientId);
  }

  public async createGrant(params: GrantCreateParams): Promise<Grant> {
    return GrantImpl.create(this.client, params);
  }

  public async getGrant(id: GrantId): Promise<Grant> {
    return GrantImpl.get(this.client, id);
  }

  public async listGrants(filter?: ListGrantsFilter & PageParams): Promise<Page<Grant>> {
    return GrantImpl.list(this.client, filter);
  }

  public async deleteGrant(id: GrantId): Promise<void> {
    return GrantImpl.delete_(this.client, id);
  }

  /**
   * Enqueues a new job.
   * @param spec Specification for the job to enqueue.
   * @result Job The new job, including a newly-assigned ID.
   */
  public async submitJob(spec: JobSpec): Promise<Job> {
    return ComputeImpl.submitJob(this.client, spec);
  }

  /**
   * Lists all known jobs owned by the current user. The dispatcher keeps track of jobs for at most 24h after they complete.
   * @param filter Controls pagination.
   * @result Job Lists known jobs. Includes recently completed jobs.
   */
  public async listJobs(filter: PageParams = {}): Promise<Page<Job>> {
    return ComputeImpl.listJobs(this.client, filter);
  }

  /**
   * Returns the full description of a known job, including its status.
   */
  public async getJob(jobId: JobId): Promise<Job> {
    return ComputeImpl.getJob(this.client, jobId);
  }

  /**
   * Schedules the job for eventual termination/deletion. The job will be terminated at some point in the future on a best-effort basis.
   * It is not an error to request to terminate an already-terminated or non-existing job.
   * @param jobId The unique identifier of the job.
   */
  public async terminateJob(jobId: JobId): Promise<void> {
    return ComputeImpl.terminateJob(this.client, jobId);
  }
}

export type Config = ClientConfig;
