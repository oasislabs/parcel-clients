import type { Opaque, RequireAtLeastOne } from 'type-fest';

import type { Client } from './client';
import { containsUpdate } from './model';
import type { Model, PODModel, ResourceId } from './model';
import type { OidcTokenClaims, PublicJWK } from './token';

export type IdentityId = Opaque<ResourceId>;

export type PODIdentity = PODModel & IdentityCreateParams;

export type IdentityCreateParams = {
    idp: IdentityProvider;
};

export interface Identity extends Model {
    id: IdentityId;

    createTimestamp: number;

    idp: IdentityProvider;

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
    public idp: IdentityProvider;

    public constructor(private readonly client: Client, pod: PODIdentity) {
        this.id = pod.id as IdentityId;
        this.createTimestamp = pod.createTimestamp;
        this.idp = pod.idp;
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

    public static async updateCurrent(
        client: Client,
        parameters: IdentityUpdateParams,
    ): Promise<Identity> {
        if (!containsUpdate(parameters)) {
            return IdentityImpl.current(client);
        }

        return client
            .patch<PODIdentity>(IDENTITIES_ME, parameters)
            .then((podIdentity) => new IdentityImpl(client, podIdentity));
    }

    public static async deleteCurrent(client: Client): Promise<void> {
        return client.delete(IDENTITIES_ME);
    }

    public async update(parameters: IdentityUpdateParams): Promise<Identity> {
        Object.assign(this, await IdentityImpl.updateCurrent(this.client, parameters));
        return this;
    }

    public async delete(): Promise<void> {
        return IdentityImpl.deleteCurrent(this.client);
    }
}

export type IdentityUpdateParams = RequireAtLeastOne<{
    /** The new authentication verification parameters. */
    idp: IdentityProvider;
}>;

export type IdentityProvider = OidcTokenClaims & {
    publicKey: PublicJWK;
};
