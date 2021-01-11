import { AppImpl } from './app';
import type { App, AppCreateParams, AppId, AppUpdateParams, ListAppsFilter } from './app';
import { ClientImpl } from './client';
import type {
  Client,
  ClientCreateParams,
  ClientId,
  ClientUpdateParams,
  ListClientsFilter,
} from './client';
import { ConsentImpl } from './consent';
import type { Consent, ConsentCreateParams, ConsentId } from './consent';
import { DatasetImpl } from './dataset';
import type {
  AccessEvent,
  Dataset,
  DatasetId,
  DatasetUpdateParams,
  DatasetUploadParams,
  ListAccessLogFilter,
  ListDatasetsFilter,
  Storable,
  Upload,
} from './dataset';
import { ComputeImpl } from './compute';
import type { Job, JobId, JobSpec, JobStatus } from './compute';
import { GrantImpl } from './grant';
import type { Grant, GrantCreateParams, GrantId } from './grant';
import { HttpClient } from './http';
import type { Config as ClientConfig, Download } from './http';
import { IdentityImpl } from './identity';
import type { Identity, IdentityCreateParams, IdentityId, IdentityUpdateParams } from './identity';
import type { Page, PageParams } from './model';
import { TokenProvider } from './token';
import type { ClientCredentials, PrivateJWK, PublicJWK, TokenSource } from './token';

export {
  App,
  AppCreateParams,
  AppId,
  AppUpdateParams,
  Client,
  ClientCredentials,
  Consent,
  ConsentCreateParams,
  ConsentId,
  Dataset,
  DatasetId,
  DatasetUpdateParams,
  DatasetUploadParams,
  Grant,
  GrantCreateParams,
  GrantId,
  Identity,
  IdentityCreateParams,
  IdentityId,
  IdentityUpdateParams,
  Job,
  JobId,
  JobSpec,
  JobStatus,
  Page,
  PageParams,
  PrivateJWK,
  PublicJWK,
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
      httpClient: config?.httpClient,
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

  public uploadDataset(data: Storable, params?: DatasetUploadParams): Upload {
    return DatasetImpl.upload(this.client, data, params);
  }

  public async getDataset(id: DatasetId): Promise<Dataset> {
    return DatasetImpl.get(this.client, id);
  }

  public async listDatasets(filter?: ListDatasetsFilter & PageParams): Promise<Page<Dataset>> {
    return DatasetImpl.list(this.client, filter);
  }

  public downloadDataset(id: DatasetId): Download {
    return DatasetImpl.download(this.client, id);
  }

  public async getDatasetHistory(
    id: DatasetId,
    filter?: ListAccessLogFilter & PageParams,
  ): Promise<Page<AccessEvent>> {
    return DatasetImpl.history(this.client, id, filter);
  }

  public async updateDataset(id: DatasetId, update: DatasetUpdateParams): Promise<Dataset> {
    return DatasetImpl.update(this.client, id, update);
  }

  public async deleteDataset(id: DatasetId): Promise<void> {
    return DatasetImpl.delete_(this.client, id);
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

  public async createConsent(appId: AppId, params: ConsentCreateParams): Promise<Consent> {
    return ConsentImpl.create(this.client, appId, params);
  }

  public async listConsents(appId: AppId, filter: PageParams): Promise<Page<Consent>> {
    return ConsentImpl.list(this.client, appId, filter);
  }

  public async deleteConsent(appId: AppId, consentId: ConsentId): Promise<void> {
    return ConsentImpl.delete_(this.client, appId, consentId);
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
