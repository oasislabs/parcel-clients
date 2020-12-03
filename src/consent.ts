import type { Opaque } from 'type-fest';

import type { AppId } from './app';
import type { Constraints } from './filter';
import type { HttpClient } from './http';
import type { IdentityId } from './identity';
import type { Model, PODModel, ResourceId } from './model';

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

export interface Consent extends Model {
    id: ConsentId;

    appId: AppId;

    /** The time at which this consent was created. */
    createdAt: Date;

    /** The Grants to make when the App containing this Consent is joined. */
    grants: GrantSpec[];

    /** The name of this consent. */
    name: string;

    /** The description of this consent seen by users when shown in an app. */
    description: string;

    /** Whether this Consent is automatically accepted when joining an App. */
    required: boolean;

    /** The text seen by users when accepting this consent. */
    allowText: string;

    /** The text seen by users when denying this consent. */
    denyText: string;
}

export class ConsentImpl implements Consent {
    public id: ConsentId;
    public appId: AppId;
    public createdAt: Date;
    public grants: GrantSpec[];
    public required: boolean;
    public name: string;
    public description: string;
    public allowText: string;
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

    // Do not export these statics. Consents should only be modified through the parent `App`
    // so that the `App` doesn't get out of sync. We focus on the most common case when there's
    // a single `App` object per App.

    public static async create(
        client: HttpClient,
        appId: AppId,
        params: ConsentCreateParams,
    ): Promise<Consent> {
        return client
            .create<PODConsent>(ConsentImpl.endpointForCollection(appId), params)
            .then((podConsent) => new ConsentImpl(client, podConsent));
    }

    public static async get(
        client: HttpClient,
        appId: AppId,
        consentId: ConsentId,
    ): Promise<Consent> {
        return client
            .get<PODConsent>(ConsentImpl.endpointForId(appId, consentId))
            .then((podConsent) => new ConsentImpl(client, podConsent));
    }

    public static async delete(
        client: HttpClient,
        appId: AppId,
        consentId: ConsentId,
    ): Promise<void> {
        return client.delete(ConsentImpl.endpointForId(appId, consentId));
    }

    private static endpointForCollection(appId: AppId): string {
        return `/apps/${appId}/consents`;
    }

    private static endpointForId(appId: AppId, consentId: ConsentId): string {
        return `${ConsentImpl.endpointForCollection(appId)}/${consentId}`;
    }
}

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
