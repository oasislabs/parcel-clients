import type { Opaque, RequireAtLeastOne } from 'type-fest';

import type { HttpClient } from './http';
import type { Model, PODModel, ResourceId } from './model';
import type { IdentityTokenClaims, PublicJWK } from './token';

export type IdentityId = Opaque<ResourceId>;

export type PODIdentity = PODModel & IdentityCreateParams;

export type IdentityCreateParams = {
    tokenVerifier: IdentityTokenVerifier;
};

export interface Identity extends Model {
    id: IdentityId;

    /** The time at which this identity was created. */
    createdAt: Date;

    tokenVerifier: IdentityTokenVerifier;

    /**
     * Updates the identity according to the provided `params`.
     * @returns the updated `this`
     * @throws `ParcelError`
     */
    update: (params: IdentityUpdateParams) => Promise<Identity>;

    /**
     * Deletes the identity.
     * @throws `ParcelError`
     */
    delete: () => Promise<void>;
}

const IDENTITIES_EP = '/identities';
const IDENTITIES_ME = `${IDENTITIES_EP}/me`;

export class IdentityImpl implements Identity {
    public id: IdentityId;
    public createdAt: Date;
    public tokenVerifier: IdentityTokenVerifier;

    public constructor(private readonly client: HttpClient, pod: PODIdentity) {
        this.id = pod.id as IdentityId;
        this.createdAt = new Date(pod.createdAt);
        this.tokenVerifier = pod.tokenVerifier;
    }

    public static async create(
        client: HttpClient,
        parameters: IdentityCreateParams,
    ): Promise<Identity> {
        return client
            .post<PODIdentity>(IDENTITIES_EP, parameters, {
                validateStatus: (s) => s === 200 || s === 201,
            })
            .then((podIdentity) => new IdentityImpl(client, podIdentity));
    }

    public static async current(client: HttpClient): Promise<Identity> {
        return client
            .get<PODIdentity>(IDENTITIES_ME)
            .then((podIdentity) => new IdentityImpl(client, podIdentity));
    }

    public static async get(client: HttpClient, id: IdentityId): Promise<Identity> {
        return client
            .get<PODIdentity>(IdentityImpl.endpointForId(id))
            .then((podIdentity) => new IdentityImpl(client, podIdentity));
    }

    public static async update(
        client: HttpClient,
        id: IdentityId,
        parameters: IdentityUpdateParams,
    ): Promise<Identity> {
        return client
            .patch<PODIdentity>(IdentityImpl.endpointForId(id), parameters)
            .then((podIdentity) => new IdentityImpl(client, podIdentity));
    }

    public static async delete(client: HttpClient, id: IdentityId): Promise<void> {
        return client.delete(IdentityImpl.endpointForId(id));
    }

    private static endpointForId(id: IdentityId): string {
        return `${IDENTITIES_EP}/${id}`;
    }

    public async update(parameters: IdentityUpdateParams): Promise<Identity> {
        Object.assign(this, await IdentityImpl.update(this.client, this.id, parameters));
        return this;
    }

    public async delete(): Promise<void> {
        return IdentityImpl.delete(this.client, this.id);
    }
}

export type IdentityUpdateParams = RequireAtLeastOne<{
    /** The new authentication verification parameters. */
    tokenVerifier: IdentityTokenVerifier;
}>;

export type IdentityTokenVerifier = IdentityTokenClaims & {
    publicKey: PublicJWK;
};
