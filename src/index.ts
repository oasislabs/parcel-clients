/**
 * See main class {@link Parcel}
 *
 * @category Main
 * @module Parcel
 */
import type { App, AppCreateParams, AppId, AppUpdateParams, ListAppsFilter } from './app.js';
import { AppImpl } from './app.js';
import type { AssetId, EscrowedAsset, EscrowedAssetSearchParams, AccessContext } from './asset.js';
import { AssetImpl } from './asset.js';
import type {
  BackendClientCreateParams,
  BackendClientUpdateParams,
  Client,
  ClientCreateParams,
  ClientId,
  ClientUpdateParams,
  FrontendClientCreateParams,
  FrontendClientUpdateParams,
  ListClientsFilter,
  ServiceClientCreateParams,
  ServiceClientUpdateParams,
} from './client.js';
import { BackendClient, ClientImpl, ClientType, FrontendClient, ServiceClient } from './client.js';
import type { Job, JobId, JobSpec, JobStatus, JobStatusReport } from './compute.js';
import {
  ComputeImpl,
  InputDocumentSpec,
  JobPhase,
  ListJobsFilter,
  OutputDocument,
  OutputDocumentSpec,
} from './compute.js';
import type { Condition } from './condition.js';
import type {
  Database,
  DatabaseCreateParams,
  DatabaseId,
  DatabaseUpdateParams,
  ListDatabasesFilter,
  Query,
  Row,
} from './database.js';
import { DatabaseImpl } from './database.js';
import type {
  AccessEvent,
  Document,
  DocumentId,
  DocumentSearchParams,
  DocumentUpdateParams,
  DocumentUploadParams,
  ListAccessLogFilter,
  Storable,
  Upload,
} from './document.js';
import { DocumentImpl } from './document.js';
import type { Grant, GrantCreateParams, GrantId } from './grant.js';
import { Capabilities, GrantImpl, ListGrantsFilter } from './grant.js';
import type { Config as ClientConfig, Download } from './http.js';
import { ApiError, HttpClient } from './http.js';
import type {
  GrantedPermission,
  Identity,
  IdentityCreateParams,
  IdentityId,
  IdentityUpdateParams,
} from './identity.js';
import { IdentityImpl } from './identity.js';
import type { GetUsageFilter, MeteringQuota, MeteringReport, QuotaUpdateParams } from './meter.js';
import { MeterImpl } from './meter.js';
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
import type {
  EthAddr,
  EthBridge,
  EthBridgeGasParams,
  EthBridgeType,
  Token,
  TokenBalance,
  TokenCreateParams,
  TokenGrantSpec,
  TokenId,
  TokenSearchParams,
  TokenizationReceipt,
  TransferReceipt,
  TransferReceiptId,
} from './tokenization.js';
import { TokenImpl } from './tokenization.js';

export {
  AccessContext,
  AccessEvent,
  ApiError,
  App,
  AppCreateParams,
  AppId,
  AppUpdateParams,
  AssetId,
  BackendClient,
  BackendClientCreateParams,
  BackendClientUpdateParams,
  Capabilities,
  Client,
  ClientCreateParams,
  ClientCredentials,
  ClientId,
  ClientType,
  Condition,
  Database,
  DatabaseCreateParams,
  DatabaseId,
  DatabaseUpdateParams,
  Document,
  DocumentId,
  DocumentUpdateParams,
  DocumentUploadParams,
  Download,
  EscrowedAsset,
  EscrowedAssetSearchParams,
  EthAddr,
  EthBridge,
  EthBridgeGasParams,
  EthBridgeType,
  FrontendClient,
  FrontendClientCreateParams,
  FrontendClientUpdateParams,
  GetUsageFilter,
  Grant,
  GrantCreateParams,
  GrantId,
  GrantedPermission,
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
  JobStatusReport,
  MeteringQuota,
  MeteringReport,
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
  QuotaUpdateParams,
  RefreshingTokenProviderParams,
  RenewingTokenProviderParams,
  Scope,
  SelfIssuedTokenProviderParams,
  ServiceClient,
  ServiceClientCreateParams,
  ServiceClientUpdateParams,
  Storable,
  Token,
  TokenBalance,
  TokenCreateParams,
  TokenGrantSpec,
  TokenId,
  TokenSearchParams,
  TokenSource,
  TokenizationReceipt,
  TransferReceipt,
  TransferReceiptId,
};

/**
 * Example:
 * ```ts
 * import Parcel from '@oasislabs/parcel';
 * const parcel = new Parcel({
 *   clientId: serviceClientId,
 *   privateKey: serviceClientPrivateKey,
 * });
 * console.log(await parcel.searchDocuments());
 * ```
 *
 * @category Main
 */
export class Parcel {
  private currentIdentity?: Identity;
  private readonly client: HttpClient;

  public constructor(tokenSource: TokenSource, config?: Config) {
    const tokenProvider = TokenProvider.fromSource(tokenSource);
    this.client = new HttpClient(tokenProvider, {
      apiUrl: config?.apiUrl,
      storageUrl: config?.storageUrl,
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

  public async createDatabase(params: DatabaseCreateParams): Promise<Database> {
    return DatabaseImpl.create(this.client, params);
  }

  public async getDatabase(id: DatabaseId): Promise<Database> {
    return DatabaseImpl.get(this.client, id);
  }

  public async updateDatabase(id: DatabaseId, params: DatabaseUpdateParams): Promise<Database> {
    return DatabaseImpl.update(this.client, id, params);
  }

  public async queryDatabase(id: DatabaseId, params: Query): Promise<Row[]> {
    return DatabaseImpl.query(this.client, id, params);
  }

  public async listDatabases(params: ListDatabasesFilter & PageParams): Promise<Page<Database>> {
    return DatabaseImpl.list(this.client, params);
  }

  public async deleteDatabase(id: DatabaseId): Promise<void> {
    return DatabaseImpl.delete_(this.client, id);
  }

  public uploadDocument(data: Storable, params: DocumentUploadParams | undefined | null): Upload {
    return DocumentImpl.upload(this.client, data, params);
  }

  public async getDocument(id: DocumentId): Promise<Document> {
    return DocumentImpl.get(this.client, id);
  }

  public async searchDocuments(
    params?: DocumentSearchParams & PageParams,
  ): Promise<Page<Document>> {
    return DocumentImpl.search(this.client, params);
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
   * Lists all known jobs visible to the current user.
   * @param filter Controls pagination.
   * @result Job Lists known jobs. Includes recently completed jobs.
   */
  public async listJobs(filter: ListJobsFilter & PageParams = {}): Promise<Page<Job>> {
    return ComputeImpl.listJobs(this.client, filter);
  }

  /**
   * Returns the full description of a known job, including its status.
   */
  public async getJob(jobId: JobId): Promise<Job> {
    return ComputeImpl.getJob(this.client, jobId);
  }

  /**
   * Returns the status of the job. This method is faster than `getJob()` and throws if the
   * job status is unknown. This makes it well suited for status polling.
   */
  public async getJobStatus(jobId: JobId): Promise<JobStatusReport> {
    return ComputeImpl.getJobStatus(this.client, jobId);
  }

  /**
   * Schedules the job for eventual termination/deletion. The job will be terminated at some point in the future on a best-effort basis.
   * It is not an error to request to terminate an already-terminated or non-existing job.
   * @param jobId The unique identifier of the job.
   */
  public async terminateJob(jobId: JobId): Promise<void> {
    return ComputeImpl.terminateJob(this.client, jobId);
  }

  /**
   * Gets a metering report for your API usage.
   * @param filter Controls API usage window.
   */
  public async getUsage(filter?: GetUsageFilter): Promise<MeteringReport> {
    return MeterImpl.getUsage(this.client, filter);
  }

  /**
   * Gets your monthly API usage quota limits.
   */
  public async getQuota(): Promise<MeteringQuota> {
    return MeterImpl.getQuota(this.client);
  }

  /**
   * Updates your monthly API usage quota limits.
   * @param params Specifies monthly quota limits to enforce until you change them again.
   */
  public async setQuota(params: QuotaUpdateParams): Promise<MeteringQuota> {
    return MeterImpl.setQuota(this.client, params);
  }

  // Tokenization

  /** Returns the amount of the token held by the identity. */
  public async getTokenBalance(identityId: IdentityId, tokenId: TokenId): Promise<TokenBalance> {
    return IdentityImpl.getTokenBalance(this.client, identityId, tokenId);
  }

  /** Mints a new token. */
  public async mintToken(params: TokenCreateParams): Promise<Token> {
    return TokenImpl.mint(this.client, params);
  }

  /** Returns information about a token. */
  public async getToken(tokenId: TokenId): Promise<Token> {
    return TokenImpl.get(this.client, tokenId);
  }

  public async searchTokens(filter?: TokenSearchParams & PageParams): Promise<Page<Token>> {
    return TokenImpl.search(this.client, filter);
  }

  /** Returns information about an asset held by the escrow identity. */
  public async searchEscrowedAssets(
    filter?: EscrowedAssetSearchParams & PageParams,
  ): Promise<Page<EscrowedAsset>> {
    return AssetImpl.search(this.client, filter);
  }

  /** Returns information about an asset held by the escrow identity. */
  public async getEscrowedAsset(assetId: AssetId): Promise<EscrowedAsset> {
    return AssetImpl.get(this.client, assetId);
  }

  public async transferToken(
    tokenId: TokenId,
    amount: number,
    recipient: IdentityId,
  ): Promise<TransferReceipt> {
    return TokenImpl.transfer(this.client, tokenId, amount, recipient);
  }

  public async getTransferReceipt(recieptId: TransferReceiptId): Promise<TransferReceipt> {
    return TokenImpl.getTransferReceipt(this.client, recieptId);
  }
}

export default Parcel;
export type Config = ClientConfig;
