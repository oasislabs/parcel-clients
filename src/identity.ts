import type { Opaque } from 'type-fest';

import type { AppId } from './app';
import { Consent } from './consent';
import type { ConsentId, PODConsent } from './consent';
import type { HttpClient } from './http';
import type { Model, Page, PageParams, PODModel, ResourceId, Writable } from './model';
import type { IdentityTokenClaims, PublicJWK } from './token';

export type IdentityId = Opaque<ResourceId>;

export type PODIdentity = PODModel & IdentityCreateParams;

const IDENTITIES_EP = '/identities';
const IDENTITIES_ME = `${IDENTITIES_EP}/me`;
const endpointForId = (id: IdentityId) => `${IDENTITIES_EP}/${id}`;
const endpointForConsents = (id: IdentityId) => `${endpointForId(id)}/consents`;
const endpointForConsent = (identityId: IdentityId, consentId: ConsentId) =>
    `${endpointForConsents(identityId)}/${consentId}`;

export class Identity implements Model {
    public id: IdentityId;
    public createdAt: Date;
    public tokenVerifiers: IdentityTokenVerifier[];

    public constructor(private readonly client: HttpClient, pod: PODIdentity) {
        this.id = pod.id as IdentityId;
        this.createdAt = new Date(pod.createdAt);
        this.tokenVerifiers = pod.tokenVerifiers;
    }

    public async update(params: IdentityUpdateParams): Promise<Identity> {
        Object.assign(this, await IdentityImpl.update(this.client, this.id, params));
        return this;
    }

    public async delete(): Promise<void> {
        return IdentityImpl.delete_(this.client, this.id);
    }

    public async grantConsent(id: ConsentId): Promise<void> {
        return IdentityImpl.grantConsent(this.client, this.id, id);
    }

    /** Fetches consents to which this identity has consented.  */
    public async listGrantedConsents(
        filter?: ListGrantedConsentsFilter & PageParams,
    ): Promise<Page<Consent>> {
        return IdentityImpl.listGrantedConsents(this.client, this.id, filter);
    }

    /** * Gets a granted consent by id. Useful for checking if a consent has been granted. */
    public async getGrantedConsent(id: ConsentId): Promise<Consent> {
        return IdentityImpl.getGrantedConsent(this.client, this.id, id);
    }

    public async revokeConsent(id: ConsentId): Promise<void> {
        return IdentityImpl.revokeConsent(this.client, this.id, id);
    }
}

export namespace IdentityImpl {
    export async function create(
        client: HttpClient,
        params: IdentityCreateParams,
    ): Promise<Identity> {
        return client
            .post<PODIdentity>(IDENTITIES_EP, params, {
                validateStatus: (s) => s === 200 || s === 201,
            })
            .then((podIdentity) => new Identity(client, podIdentity));
    }

    export async function current(client: HttpClient): Promise<Identity> {
        return client
            .get<PODIdentity>(IDENTITIES_ME)
            .then((podIdentity) => new Identity(client, podIdentity));
    }

    export async function get(client: HttpClient, id: IdentityId): Promise<Identity> {
        return client
            .get<PODIdentity>(endpointForId(id))
            .then((podIdentity) => new Identity(client, podIdentity));
    }

    export async function update(
        client: HttpClient,
        id: IdentityId,
        params: IdentityUpdateParams,
    ): Promise<Identity> {
        return client
            .update<PODIdentity>(endpointForId(id), params)
            .then((podIdentity) => new Identity(client, podIdentity));
    }

    export async function delete_(client: HttpClient, id: IdentityId): Promise<void> {
        return client.delete(endpointForId(id));
    }

    export async function grantConsent(
        client: HttpClient,
        identityId: IdentityId,
        consentId: ConsentId,
    ): Promise<void> {
        await client.post(endpointForConsent(identityId, consentId), undefined);
    }

    export async function listGrantedConsents(
        client: HttpClient,
        identityId: IdentityId,
        filter?: ListGrantedConsentsFilter & PageParams,
    ): Promise<Page<Consent>> {
        const podPage = await client.get<Page<PODConsent>>(endpointForConsents(identityId), filter);
        const results = podPage.results.map((podConsent) => new Consent(client, podConsent));
        return {
            results,
            nextPageToken: podPage.nextPageToken,
        };
    }

    export async function getGrantedConsent(
        client: HttpClient,
        identityId: IdentityId,
        consentId: ConsentId,
    ): Promise<Consent> {
        return client
            .get<PODConsent>(endpointForConsent(identityId, consentId))
            .then((podConsent) => new Consent(client, podConsent));
    }

    export async function revokeConsent(
        client: HttpClient,
        identityId: IdentityId,
        consentId: ConsentId,
    ): Promise<void> {
        await client.delete(endpointForConsent(identityId, consentId));
    }
}

export type IdentityCreateParams = IdentityUpdateParams;
export type IdentityUpdateParams = Writable<Identity>;

export type IdentityTokenVerifier = IdentityTokenClaims & {
    publicKey: PublicJWK;
};

export type ListGrantedConsentsFilter = Partial<{
    /** Only return consents granted to this app. */
    app: AppId;
}>;
