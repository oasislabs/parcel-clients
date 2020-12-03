import type { Opaque, RequireAtLeastOne } from 'type-fest';

import type { AppId } from './app';
import { ConsentImpl } from './consent';
import type { Consent, ConsentId, PODConsent } from './consent';
import type { HttpClient } from './http';
import type { Model, Page, PageParams, PODModel, ResourceId } from './model';
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
     */
    update: (params: IdentityUpdateParams) => Promise<Identity>;

    /**
     * Deletes the identity.
     */
    delete: () => Promise<void>;

    /**
     * Fetches consents to which this identity has consented.
     * @returns a paginated list of granted consents.
     */
    listGrantedConsents: (
        filter?: ListGrantedConsentsFilter & PageParams,
    ) => Promise<Page<Consent>>;

    /**
     * Gets a granted consent by id. Useful for checking if a consent has been granted.
     * @returns the identified consent if the identity has granted it.
     */
    getGrantedConsent: (id: ConsentId) => Promise<Consent>;
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
        params: IdentityCreateParams,
    ): Promise<Identity> {
        return client
            .post<PODIdentity>(IDENTITIES_EP, params, {
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
        params: IdentityUpdateParams,
    ): Promise<Identity> {
        return client
            .patch<PODIdentity>(IdentityImpl.endpointForId(id), params)
            .then((podIdentity) => new IdentityImpl(client, podIdentity));
    }

    public static async delete(client: HttpClient, id: IdentityId): Promise<void> {
        return client.delete(IdentityImpl.endpointForId(id));
    }

    public static async listGrantedConsents(
        client: HttpClient,
        identityId: IdentityId,
        filter?: ListGrantedConsentsFilter & PageParams,
    ): Promise<Page<Consent>> {
        const podPage = await client.get<Page<PODConsent>>(
            IdentityImpl.endpointForConsents(identityId),
            filter,
        );
        const results = podPage.results.map((podConsent) => new ConsentImpl(client, podConsent));
        return {
            results,
            nextPageToken: podPage.nextPageToken,
        };
    }

    public static async getGrantedConsent(
        client: HttpClient,
        identityId: IdentityId,
        consentId: ConsentId,
    ): Promise<Consent> {
        return client
            .get<PODConsent>(`${IdentityImpl.endpointForConsents(identityId)}/${consentId}`)
            .then((podConsent) => new ConsentImpl(client, podConsent));
    }

    private static endpointForId(id: IdentityId): string {
        return `${IDENTITIES_EP}/${id}`;
    }

    private static endpointForConsents(id: IdentityId): string {
        return `${IdentityImpl.endpointForId(id)}/consents`;
    }

    public async update(params: IdentityUpdateParams): Promise<Identity> {
        Object.assign(this, await IdentityImpl.update(this.client, this.id, params));
        return this;
    }

    public async delete(): Promise<void> {
        return IdentityImpl.delete(this.client, this.id);
    }

    public async listGrantedConsents(
        filter?: ListGrantedConsentsFilter & PageParams,
    ): Promise<Page<Consent>> {
        return IdentityImpl.listGrantedConsents(this.client, this.id, filter);
    }

    public async getGrantedConsent(id: ConsentId): Promise<Consent> {
        return IdentityImpl.getGrantedConsent(this.client, this.id, id);
    }
}

export type IdentityUpdateParams = RequireAtLeastOne<{
    /** The new authentication verification params. */
    tokenVerifier: IdentityTokenVerifier;
}>;

export type IdentityTokenVerifier = IdentityTokenClaims & {
    publicKey: PublicJWK;
};

export type ListGrantedConsentsFilter = Partial<{
    /** Only return consents granted to this app. */
    app: AppId;
}>;
