import type { Opaque } from 'type-fest';

import type { AppId } from './app';
import type { Constraints } from './filter';
import type { HttpClient } from './http';
import type { IdentityId } from './identity';
import type { Model, Page, PageParams, PODModel, ResourceId } from './model';

export type ConsentId = Opaque<ResourceId>;

export type PODConsent = PODModel &
    ConsentCreateParams & {
        appId: ResourceId;
    };

export type ConsentCreateParams = {
    /** The Grants to make when the App containing this Consent is joined. */
    grants: GrantSpec[];

    /** The name of this consent. */
    name: string;

    /** The description of this consent seen by users when shown in an app. */
    description: string;

    /** Whether this Consent is automatically accepted when joining an App. */
    required?: boolean;

    /** The text seen by users when accepting this consent. */
    allowText: string;

    /** The text seen by users when denying this consent. */
    denyText: string;
};

export class Consent implements Model {
    public id: ConsentId;
    public appId: AppId;
    public createdAt: Date;
    /** The Grants to make when the App containing this Consent is joined. */
    public grants: GrantSpec[];
    /** Whether this Consent is automatically accepted when joining an App. */
    public required: boolean;
    public name: string;
    /** The description of this consent seen by users when shown in an app. */
    public description: string;
    /** The text seen by users when accepting this consent. */
    public allowText: string;
    /** The text seen by users when denying this consent. */
    public denyText: string;

    public constructor(private readonly client: HttpClient, pod: PODConsent) {
        this.id = pod.id as ConsentId;
        this.appId = pod.appId as AppId;
        this.createdAt = new Date(pod.createdAt);
        this.grants = pod.grants;
        this.required = pod.required ?? false;
        this.name = pod.name;
        this.description = pod.description;
        this.allowText = pod.allowText;
        this.denyText = pod.denyText;
    }
}

export namespace ConsentImpl {
    export async function create(
        client: HttpClient,
        appId: AppId,
        params: ConsentCreateParams,
    ): Promise<Consent> {
        return client
            .create<PODConsent>(endpointForCollection(appId), params)
            .then((podConsent) => new Consent(client, podConsent));
    }

    export async function list(
        client: HttpClient,
        appId: AppId,
        filter?: PageParams,
    ): Promise<Page<Consent>> {
        const podPage = await client.get<Page<PODConsent>>(endpointForCollection(appId), filter);
        const results = podPage.results.map((podConsent) => new Consent(client, podConsent));
        return {
            results,
            nextPageToken: podPage.nextPageToken,
        };
    }

    export async function get(
        client: HttpClient,
        appId: AppId,
        consentId: ConsentId,
    ): Promise<Consent> {
        return client
            .get<PODConsent>(endpointForId(appId, consentId))
            .then((podConsent) => new Consent(client, podConsent));
    }

    export async function delete_(
        client: HttpClient,
        appId: AppId,
        consentId: ConsentId,
    ): Promise<void> {
        return client.delete(endpointForId(appId, consentId));
    }
}

const endpointForCollection = (appId: AppId) => `/apps/${appId}/consents`;
const endpointForId = (appId: AppId, consentId: ConsentId) =>
    `${endpointForCollection(appId)}/${consentId}`;

export type GrantSpec = {
    /** The symbolic granter. */
    granter: GranterRef;

    /** The symbolic grantee */
    grantee?: GranteeRef;

    /** The Grant's filter. @see `Grant.filter`. */
    filter?: Constraints;
};

/** `app` represents the app, `participant` represents the joining identity. */
export type GranterRef = 'app' | 'participant';

/**
 * A `ResourceId` causes the grant to be made to a specific Identity,
 * `app` grants to the app, `participant` grants to the joining identity, and
 * `everyone` refers to, well, everyone.
 */
export type GranteeRef = 'app' | 'participant' | 'everyone' | IdentityId;
