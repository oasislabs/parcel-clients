import type { Opaque } from 'type-fest';

import type { AppId } from './app.js';
import { endpointForApp } from './app.js';
import type { HttpClient } from './http.js';
import type { IdentityId } from './identity.js';
import type { Model, Page, PageParams, PODModel, ResourceId, WritableExcluding } from './model.js';
import type { PublicJWK } from './token.js';

export type ClientId = Opaque<ResourceId, 'ClientId'>;

export type PODBaseClient = Readonly<
  PODModel & {
    creator: ResourceId;
    appId: ResourceId;
    name: string;
    type: ClientType;
  }
>;
export type PODFrontendClient = PODBaseClient &
  Readonly<{
    type: ClientType.Frontend;
    redirectUris: string[];
    postLogoutRedirectUris: string[];
  }>;
export type PODBackendClient = PODBaseClient &
  Readonly<{
    type: ClientType.Backend;
    redirectUris: string[];
    postLogoutRedirectUris: string[];
    publicKeys: PublicJWK[];
  }>;
export type PODServiceClient = PODBaseClient &
  Readonly<{
    type: ClientType.Service;
    publicKeys: PublicJWK[];
  }>;
export type PODClient = PODFrontendClient | PODBackendClient | PODServiceClient;

export enum ClientType {
  Frontend = 'frontend',
  Backend = 'backend',
  Service = 'service',
}

class BaseClient implements Model {
  public readonly id: ClientId;
  public readonly createdAt: Date;
  public readonly creator: IdentityId;
  public readonly appId: AppId;
  public readonly name: string;
  public readonly type: ClientType;

  #client: HttpClient;

  public constructor(client: HttpClient, pod: PODBaseClient) {
    this.#client = client;
    this.id = pod.id as ClientId;
    this.createdAt = new Date(pod.createdAt);
    this.creator = pod.creator as IdentityId;
    this.appId = pod.appId as AppId;
    this.name = pod.name;
    this.type = pod.type;
  }

  public async delete(): Promise<void> {
    return this.#client.delete(endpointForId(this.appId, this.id));
  }

  public isFrontend(): this is FrontendClient {
    return this.type === ClientType.Frontend;
  }

  public isBackend(): this is BackendClient {
    return this.type === ClientType.Backend;
  }

  public isService(): this is ServiceClient {
    return this.type === ClientType.Service;
  }
}

function makeClient(
  client: HttpClient,
  pod: PODFrontendClient | PODBackendClient | PODServiceClient,
): Client {
  if (pod.type === ClientType.Frontend) return new FrontendClient(client, pod);
  if (pod.type === ClientType.Backend) return new BackendClient(client, pod);
  if (pod.type === ClientType.Service) return new ServiceClient(client, pod);
  throw new Error(`unrecognized client type`);
}

export class FrontendClient extends BaseClient {
  public readonly type = ClientType.Frontend;
  public readonly redirectUris: string[];
  public readonly postLogoutRedirectUris: string[];

  public constructor(client: HttpClient, pod: PODFrontendClient) {
    super(client, pod);
    this.redirectUris = pod.redirectUris;
    this.postLogoutRedirectUris = pod.postLogoutRedirectUris;
  }
}

type FrontendClientConfig = {
  type: ClientType.Frontend;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
};

export class BackendClient extends BaseClient {
  public readonly type = ClientType.Backend;
  public readonly redirectUris: string[];
  public readonly postLogoutRedirectUris: string[];
  public readonly publicKeys: PublicJWK[];

  public constructor(client: HttpClient, pod: PODBackendClient) {
    super(client, pod);
    this.redirectUris = pod.redirectUris;
    this.postLogoutRedirectUris = pod.postLogoutRedirectUris;
    this.publicKeys = pod.publicKeys;
  }
}

type BackendClientConfig = {
  type: ClientType.Backend;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  publicKeys: PublicJWK[];
};

export class ServiceClient extends BaseClient {
  public readonly type = ClientType.Service;
  public readonly publicKeys: PublicJWK[];

  public constructor(client: HttpClient, pod: PODServiceClient) {
    super(client, pod);
    this.publicKeys = pod.publicKeys!;
  }
}

type ServiceClientConfig = {
  type: ClientType.Service;
  publicKeys: PublicJWK[];
};

export type Client = FrontendClient | BackendClient | ServiceClient;

export namespace ClientImpl {
  export async function create(
    client: HttpClient,
    appId: AppId,
    params: ClientCreateParams,
  ): Promise<Client> {
    const podClient = await client.create<PODClient>(endpointForCollection(appId), params);
    return makeClient(client, podClient);
  }

  export async function get(client: HttpClient, appId: AppId, clientId: ClientId): Promise<Client> {
    const podClient = await client.get<PODClient>(endpointForId(appId, clientId));
    return makeClient(client, podClient);
  }

  export async function list(
    client: HttpClient,
    appId: AppId,
    filter?: ListClientsFilter & PageParams,
  ): Promise<Page<Client>> {
    const podPage = await client.get<Page<PODClient>>(endpointForCollection(appId), filter);
    const results = podPage.results.map((podClient) => makeClient(client, podClient));
    return {
      results,
      nextPageToken: podPage.nextPageToken,
    };
  }

  export async function update(
    client: HttpClient,
    appId: AppId,
    clientId: ClientId,
    params: ClientUpdateParams,
  ): Promise<Client> {
    const podClient = await client.update<PODClient>(endpointForId(appId, clientId), params);
    return makeClient(client, podClient);
  }

  export async function delete_(
    client: HttpClient,
    appId: AppId,
    clientId: ClientId,
  ): Promise<void> {
    return client.delete(endpointForId(appId, clientId));
  }
}

const endpointForCollection = (appId: AppId) => `${endpointForApp(appId)}/clients`;
const endpointForId = (appId: AppId, clientId: ClientId) =>
  `${endpointForCollection(appId)}/${clientId}`;

type BaseClientCreateParams = WritableExcluding<BaseClient, 'creator' | 'appId'>;
export type FrontendClientCreateParams = BaseClientCreateParams & FrontendClientConfig;
export type BackendClientCreateParams = BaseClientCreateParams & BackendClientConfig;
export type ServiceClientCreateParams = BaseClientCreateParams & ServiceClientConfig;
export type ClientCreateParams =
  | FrontendClientCreateParams
  | BackendClientCreateParams
  | ServiceClientCreateParams;

type BaseClientUpdateParams = BaseClientCreateParams;
export type FrontendClientUpdateParams = BaseClientUpdateParams & FrontendClientConfig;
export type BackendClientUpdateParams = BaseClientUpdateParams & BackendClientConfig;
export type ServiceClientUpdateParams = BaseClientUpdateParams & ServiceClientConfig;
export type ClientUpdateParams =
  | FrontendClientUpdateParams
  | BackendClientUpdateParams
  | ServiceClientUpdateParams;

export type ListClientsFilter = Partial<{
  /** Only return clients created by the provided identity. */
  creator: IdentityId;

  /** Only return clients for the provided app. */
  appId: AppId;
}>;
