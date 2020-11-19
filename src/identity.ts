import type { Opaque, RequireAtLeastOne } from 'type-fest';

import type { Client } from './client';
import { containsUpdate } from './model';
import type { Model, PODModel, ResourceId } from './model';
import type { IdentityTokenClaims, PublicJWK } from './token';

export type IdentityId = Opaque<ResourceId>;

export type PODIdentity = PODModel & IdentityCreateParams;

export type IdentityCreateParams = {
    tokenVerifier: IdentityTokenVerifier;
};

export interface Identity extends Model {
    id: IdentityId;

    createTimestamp: number;

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
    public createTimestamp: number;
    public tokenVerifier: IdentityTokenVerifier;

    public constructor(private readonly client: Client, pod: PODIdentity) {
        this.id = pod.id as IdentityId;
        this.createTimestamp = pod.createTimestamp;
        this.tokenVerifier = pod.tokenVerifier;
    }

    public static async create(
        client: Client,
        parameters: IdentityCreateParams,
    ): Promise<Identity> {
        return client
            .post<PODIdentity>(IDENTITIES_EP, parameters, {
                validateStatus: (s) => s === 200 || s === 201,
            })
            .then((podIdentity) => new IdentityImpl(client, podIdentity));
    }

    public static async current(client: Client): Promise<Identity> {
        return client
            .get<PODIdentity>(IDENTITIES_ME)
            .then((podIdentity) => new IdentityImpl(client, podIdentity));
    }

    public static async get(client: Client, id: IdentityId): Promise<Identity> {
        return client
            .get<PODIdentity>(IdentityImpl.endpointForId(id))
            .then((podIdentity) => new IdentityImpl(client, podIdentity));
    }

    public static async update(
        client: Client,
        id: IdentityId,
        parameters: IdentityUpdateParams,
    ): Promise<Identity> {
        if (!containsUpdate(parameters)) {
            return IdentityImpl.get(client, id);
        }

        return client
            .patch<PODIdentity>(IdentityImpl.endpointForId(id), parameters)
            .then((podIdentity) => new IdentityImpl(client, podIdentity));
    }

    public static async delete(client: Client, id: IdentityId): Promise<void> {
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
