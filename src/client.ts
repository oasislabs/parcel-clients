import type { Except, Opaque } from 'type-fest';

import type { AppId } from './app.js';
import { endpointForId as endpointForApp } from './app.js';
import type { HttpClient } from './http.js';
import type { IdentityId } from './identity.js';
import type { Model, Page, PageParams, PODModel, ResourceId, WritableExcluding } from './model.js';
import type { PublicJWK } from './token.js';

export type ClientId = Opaque<ResourceId, 'ClientId'>;

export type PODClient = Readonly<
  PODModel & {
    creator: ResourceId;
    appId: ResourceId;
    name: string;
    redirectUris: string[];
    postLogoutRedirectUris: string[];
    publicKeys: PublicJWK[];
    canHoldSecrets: boolean;
    canActOnBehalfOfUsers: boolean;
    isScript: boolean;
  }
>;

export class Client implements Model {
  public readonly id: ClientId;
  public readonly createdAt: Date;
  public readonly creator: IdentityId;
  public readonly appId: AppId;
  public readonly name: string;
  public readonly redirectUris: string[];
  public readonly postLogoutRedirectUris: string[];
  public readonly publicKeys: PublicJWK[];
  public readonly canHoldSecrets: boolean;
  public readonly canActOnBehalfOfUsers: boolean;
  public readonly isScript: boolean;

  public constructor(private readonly client: HttpClient, pod: PODClient) {
    this.id = pod.id as ClientId;
    this.createdAt = new Date(pod.createdAt);
    this.creator = pod.creator as IdentityId;
    this.appId = pod.appId as AppId;
    this.name = pod.name;
    this.redirectUris = pod.redirectUris;
    this.postLogoutRedirectUris = pod.postLogoutRedirectUris;
    this.publicKeys = pod.publicKeys;
    this.canHoldSecrets = pod.canHoldSecrets;
    this.canActOnBehalfOfUsers = pod.canActOnBehalfOfUsers;
    this.isScript = pod.isScript;
  }

  public async update(params: ClientUpdateParams): Promise<Client> {
    Object.assign(this, await ClientImpl.update(this.client, this.appId, this.id, params));
    return this;
  }

  public async delete(): Promise<void> {
    return this.client.delete(endpointForId(this.appId, this.id));
  }
}

export namespace ClientImpl {
  export async function create(
    client: HttpClient,
    appId: AppId,
    params: ClientCreateParams,
  ): Promise<Client> {
    const podClient = await client.create<PODClient>(endpointForCollection(appId), params);
    return new Client(client, podClient);
  }

  export async function get(client: HttpClient, appId: AppId, clientId: ClientId): Promise<Client> {
    const podClient = await client.get<PODClient>(endpointForId(appId, clientId));
    return new Client(client, podClient);
  }

  export async function list(
    client: HttpClient,
    appId: AppId,
    filter?: ListClientsFilter & PageParams,
  ): Promise<Page<Client>> {
    const podPage = await client.get<Page<PODClient>>(endpointForCollection(appId), filter);
    const results = podPage.results.map((podClient) => new Client(client, podClient));
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
    return new Client(client, podClient);
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

export type ClientCreateParams = WritableExcluding<
  Client,
  'creator' | 'appId' | 'canActOnBehalfOfUsers'
>;
export type ClientUpdateParams = Except<ClientCreateParams, 'canHoldSecrets' | 'isScript'>;

export type ListClientsFilter = Partial<{
  /** Only return clients created by the provided identity. */
  creator: IdentityId;

  /** Only return clients for the provided app. */
  appId: AppId;
}>;
