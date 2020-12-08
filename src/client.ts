import type { Opaque } from 'type-fest';

import type { AppId } from './app';
import type { HttpClient } from './http';
import type { IdentityId } from './identity';
import type { Model, Page, PageParams, PODModel, ResourceId, WritableExcluding } from './model';
import type { PublicJWK } from './token';

export type ClientId = Opaque<ResourceId>;

export type PODClient = PODModel & {
    creator: ResourceId;
    appId: ResourceId;
    name: string;
    redirectUris: string[];
    postLogoutRedirectUris: string[];
    jsonWebKeys: PublicJWK[];
    audience: string;
    canHoldSecrets: boolean;
    canActOnBehalfOfUsers: boolean;
    isScript: boolean;
};

export class Client implements Model {
    public id: ClientId;
    public createdAt: Date;
    public creator: IdentityId;
    public appId: AppId;
    public name: string;
    public redirectUris: string[];
    public postLogoutRedirectUris: string[];
    public jsonWebKeys: PublicJWK[];
    /** The allowed audience for this client's auth tokens. */
    public audience: string;
    public canHoldSecrets: boolean;
    public canActOnBehalfOfUsers: boolean;
    public isScript: boolean;

    public constructor(private readonly client: HttpClient, pod: PODClient) {
        this.id = pod.id as ClientId;
        this.createdAt = new Date(pod.createdAt);
        this.creator = pod.creator as IdentityId;
        this.appId = pod.appId as AppId;
        this.name = pod.name;
        this.redirectUris = pod.redirectUris;
        this.postLogoutRedirectUris = pod.postLogoutRedirectUris;
        this.jsonWebKeys = pod.jsonWebKeys;
        this.audience = pod.audience;
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
        return client
            .create<PODClient>(endpointForCollection(appId), params)
            .then((podClient) => new Client(client, podClient));
    }

    export async function get(
        client: HttpClient,
        appId: AppId,
        clientId: ClientId,
    ): Promise<Client> {
        return client
            .get<PODClient>(endpointForId(appId, clientId))
            .then((podClient) => new Client(client, podClient));
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
        return client
            .update<PODClient>(endpointForId(appId, clientId), params)
            .then((podClient) => new Client(client, podClient));
    }

    export async function delete_(
        client: HttpClient,
        appId: AppId,
        clientId: ClientId,
    ): Promise<void> {
        return client.delete(endpointForId(appId, clientId));
    }
}

const endpointForCollection = (appId: AppId) => `/apps/${appId}/clients`;
const endpointForId = (appId: AppId, clientId: ClientId) =>
    `${endpointForCollection(appId)}/${clientId}`;

export type ClientCreateParams = ClientUpdateParams;
export type ClientUpdateParams = WritableExcluding<
    Client,
    'creator' | 'appId' | 'audience' | 'canHoldSecrets' | 'canActOnBehalfOfUsers' | 'isScript'
>;

export type ListClientsFilter = Partial<{
    /** Only return clients created by the provided identity. */
    creator: IdentityId;

    /** Only return clients for the provided app. */
    appId: AppId;
}>;
