import type { Opaque, RequireAtLeastOne } from 'type-fest';

import type { AppId } from './app';
import type { HttpClient } from './http';
import type { IdentityId } from './identity';
import type { Model, Page, PageParams, PODModel, ResourceId } from './model';
import type { PublicJWK } from './token';

export type ClientId = Opaque<ResourceId>;

export type PODClient = PODModel & {
    creator: ResourceId;
    appId: ResourceId;
    name: string;
    redirectUris: string[];
    postLogoutRedirectUris: string[];
    jsonWebKeys: string[];
    audience: string;
    canHoldSecrets: boolean;
    canActOnBehalfOfUsers: boolean;
    isScript: boolean;
};

export type ClientCreateParams = {
    /** The name of this client. */
    name: string;

    /** The client's set of allowed redirect URIs. */
    redirectUris: string[];

    /** The client's set of allowed post-logout redirect URIs. */
    postLogoutRedirectUris: string[];

    /** The set of registered (public) JSON web keys for this client. */
    jsonWebKeys: PublicJWK[];

    /** The allowed audience for this client. */
    audience: string;

    /** Whether or not this client can hold secrets. */
    canHoldSecrets: boolean;

    /** Whether or not this client is a script. */
    isScript: boolean;
};

export interface Client extends Model {
    /** The client's id. */
    id: ClientId;

    /** The creator of this client. */
    creator: IdentityId;

    /** The id of this client's parent app. */
    appId: AppId;

    /** The name of this client. */
    name: string;

    /** The client's set of allowed redirect URIs. */
    redirectUris: string[];

    /** The client's set of allowed post-logout redirect URIs. */
    postLogoutRedirectUris: string[];

    /** The set of registered (public) JSON web keys for this client. */
    jsonWebKeys: PublicJWK[];

    /** The allowed audience for this client. */
    audience: string;

    /** Whether or not this client can hold secrets. */
    canHoldSecrets: boolean;

    /** Whether or not this client can act on behalf of users. */
    canActOnBehalfOfUsers: boolean;

    /** Whether or not this client is a script. */
    isScript: boolean;

    /**
     * Updates the client according to the provided `params`.
     * @returns the updated `this`
     * @throws `ParcelError`
     */
    update: (params: ClientUpdateParams) => Promise<Client>;

    /**
     * Deletes the client.
     * @throws `ParcelError`
     */
    delete: () => Promise<void>;
}

const CLIENTS_EP = '/clients';

export class ClientImpl implements Client {
    public id: ClientId;
    public createdAt: Date;
    public creator: IdentityId;
    public appId: AppId;
    public name: string;
    public redirectUris: string[];
    public postLogoutRedirectUris: string[];
    public jsonWebKeys: PublicJWK[];
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
        this.jsonWebKeys = pod.jsonWebKeys.map((k) => JSON.parse(k));
        this.audience = pod.audience;
        this.canHoldSecrets = pod.canHoldSecrets;
        this.canActOnBehalfOfUsers = pod.canActOnBehalfOfUsers;
        this.isScript = pod.isScript;
    }

    public static async create(
        client: HttpClient,
        appId: AppId,
        parameters: ClientCreateParams,
    ): Promise<Client> {
        return client
            .create<PODClient>(`/apps/${appId}${CLIENTS_EP}`, parameters)
            .then((podClient) => new ClientImpl(client, podClient));
    }

    public static async get(client: HttpClient, appId: AppId, clientId: ClientId): Promise<Client> {
        return client
            .get<PODClient>(ClientImpl.endpointForId(appId, clientId))
            .then((podClient) => new ClientImpl(client, podClient));
    }

    public static async list(
        client: HttpClient,
        appId: AppId,
        filter?: ListClientsFilter & PageParams,
    ): Promise<Page<Client>> {
        const podPage = await client.get<Page<PODClient>>(`/apps/${appId}${CLIENTS_EP}`, filter);
        const results = podPage.results.map((podClient) => new ClientImpl(client, podClient));
        return {
            results,
            nextPageToken: podPage.nextPageToken,
        };
    }

    public static async update(
        client: HttpClient,
        appId: AppId,
        clientId: ClientId,
        parameters: ClientUpdateParams,
    ): Promise<Client> {
        return client
            .patch<PODClient>(ClientImpl.endpointForId(appId, clientId), parameters)
            .then((podClient) => new ClientImpl(client, podClient));
    }

    public static async delete(
        client: HttpClient,
        appId: AppId,
        clientId: ClientId,
    ): Promise<void> {
        return client.delete(ClientImpl.endpointForId(appId, clientId));
    }

    private static endpointForId(appId: AppId, clientId: ClientId): string {
        return `/apps/${appId}/clients/${clientId}`;
    }

    public async update(parameters: ClientUpdateParams): Promise<Client> {
        Object.assign(this, await ClientImpl.update(this.client, this.appId, this.id, parameters));
        return this;
    }

    public async delete(): Promise<void> {
        return this.client.delete(ClientImpl.endpointForId(this.appId, this.id));
    }
}

export type ClientUpdateParams = RequireAtLeastOne<{
    /** A list of redirect URIs to add to this client. */
    newRedirectUris: string[];

    /** A list of redirect URIs to remove from this client. */
    removedRedirectUris: string[];

    /** A list of post-logout redirect URIs to add to this client. */
    newPostLogoutRedirectUris: string[];

    /** A list of post-logout redirect URIs to remove from this client. */
    removedPostLogoutRedirectUris: string[];

    /** A list of JSON web keys to add to this client. */
    newJsonWebKeys: string[];

    /** A list of JSON web keys to remove from this client. */
    removedJsonWebKeys: string[];
}>;

export type ListClientsFilter = Partial<{
    /** Only return clients created by the provided identity. */
    creator: IdentityId;

    /** Only return clients for the provided app. */
    appId: AppId;
}>;
