import type { Opaque, RequireAtLeastOne } from 'type-fest';

import { ConsentImpl } from './consent';
import type { Consent, ConsentCreateParams, ConsentId, PODConsent } from './consent';
import type { HttpClient } from './http';
import type { IdentityId, IdentityTokenVerifier } from './identity';
import type { Model, Page, PageParams, PODModel, ResourceId } from './model';

export type AppId = Opaque<ResourceId>;

export type PODApp = PODModel & {
    acceptanceText?: string;
    admins: ResourceId[];
    brandingColor?: string;
    category?: string;
    collaborators: ResourceId[];
    consents: PODConsent[];
    extendedDescription?: string;
    homepage: string;
    invitationText?: string;
    inviteOnly: boolean;
    invites?: ResourceId[];
    logo?: string;
    name: string;
    organization: string;
    owner: ResourceId;
    participants: ResourceId[];
    privacyPolicy: string;
    published: boolean;
    rejectionText?: string;
    shortDescription: string;
    termsAndConditions: string;
};

export type AppCreateParams = {
    /** The credentials used to authorize clients acting as this app. */
    identityTokenVerifier: IdentityTokenVerifier;

    /** The name of the app. */
    name: string;

    /** The name of the app publisher's organization. */
    organization: string;

    /** A short description of the app. */
    shortDescription: string;

    /** The homepage URL of the app publisher. */
    homepage: string;

    /** The terms and conditions presented to the user. */
    termsAndConditions: string;

    /** The privacy policy presented to the user. */
    privacyPolicy: string;

    /** If `true`, only invited Identities may  the app. Defaults to `false` */
    inviteOnly?: boolean;

    /**
     * If the app is invite-only, only these identities will be able to join.
     * Has no effect when the app is open participation (i.e. not invite-only.
     */
    invites?: IdentityId[];

    /**
     * Consents taken when a the app is joined.
     */
    consents: ConsentCreateParams[];

    /** An extended description of the app. */
    extendedDescription?: string;

    /**
     * Text describing the category of the app (e.g., health, finance) that can
     * be used to search for the app.
     */
    category?: string;

    /** Text shown to the user when viewing the app's invite page. */
    invitationText?: string;

    /** Text shown to the user after accepting the app's invitation. */
    acceptanceText?: string;

    /** Text shown to the user after rejecting the app's invitation. */
    rejectionText?: string;

    /** A URL pointing to (or containing) the app's logo. */
    logo?: string;

    /** The app's branding color in RGB hex format (e.g. `#ff4212`). */
    brandingColor?: string;
};

export interface App extends Model {
    /** The App's id */
    id: AppId;

    /** The time at which this app was created. */
    createdAt: Date;

    /** The name of the app. */
    name: string;

    /** The name of the app publisher's organization. */
    organization: string;

    /** The app publisher's homepage URL. */
    homepage: string;

    /** A short description of the app. */
    shortDescription: string;

    /** The terms and conditions presented to the user. */
    termsAndConditions: string;

    /** The privacy policy presented to the user. */
    privacyPolicy: string;

    /** Whether this app has been published. */
    published: boolean;

    /** The Identity that owns the App. */
    owner: IdentityId;

    /** If `true`, only invited Identities may join the app. */
    inviteOnly: boolean;

    /** The consents taken upon joining this App. */
    consents: Consent[];

    /** The extended description of the app. */
    extendedDescription?: string;

    /**
     * Text describing the category of the app (e.g., health, finance) that can
     * be used to search for the app.
     */
    category?: string;

    /** Text shown to the user when viewing the app's invite page. */
    invitationText?: string;

    /** Text shown to the user after accepting the app's invitation. */
    acceptanceText?: string;

    /** Text shown to the user after rejecting the app's invitation. */
    rejectionText?: string;

    /** A URL pointing to (or containing) the app's logo. */
    logo?: string;

    /** The app's branding color in RGB hex format (e.g. `#ff4212`). */
    brandingColor?: string;

    /** The set of identities that are currently authorizing this App. */
    participants: IdentityId[];

    /**
     * Updates the app according to the provided `params`.
     * @returns the updated `this`
     */
    update: (params: AppUpdateParams) => Promise<App>;

    /**
     * Creates a new consent that this app will request from users. The new consent
     * will be added to `this.consents`.
     */
    createConsent: (params: ConsentCreateParams) => Promise<Consent>;

    /**
     * Deletes a consent from this app, revoking any access made by granting consent.
     * will be removed from `this.consents`.
     */
    deleteConsent: (id: ConsentId) => Promise<void>;

    /**
     * Deletes the app.
     */
    delete: () => Promise<void>;
}

const APPS_EP = '/apps';

export class AppImpl implements App {
    public id: AppId;
    public acceptanceText?: string;
    public admins: IdentityId[];
    public brandingColor?: string;
    public category?: string;
    public collaborators: IdentityId[];
    public consents: Consent[];
    public createdAt: Date;
    public extendedDescription?: string;
    public homepage: string;
    public invitationText?: string;
    public inviteOnly: boolean;
    public invites: IdentityId[];
    public logo?: string;
    public name: string;
    public organization: string;
    public owner: IdentityId;
    public participants: IdentityId[];
    public privacyPolicy: string;
    public published: boolean;
    public rejectionText?: string;
    public shortDescription: string;
    public termsAndConditions: string;

    public constructor(private readonly client: HttpClient, pod: PODApp) {
        this.id = pod.id as AppId;
        this.acceptanceText = pod.acceptanceText;
        this.admins = pod.admins as IdentityId[];
        this.brandingColor = pod.brandingColor;
        this.category = pod.category;
        this.collaborators = pod.collaborators as IdentityId[];
        this.consents = pod.consents.map((podConsent) => new ConsentImpl(client, podConsent));
        this.createdAt = new Date(pod.createdAt);
        this.extendedDescription = pod.extendedDescription;
        this.homepage = pod.homepage;
        this.invitationText = pod.invitationText;
        this.inviteOnly = pod.inviteOnly;
        this.invites = pod.invites as IdentityId[];
        this.logo = pod.logo;
        this.name = pod.name;
        this.organization = pod.organization;
        this.owner = pod.owner as IdentityId;
        this.participants = pod.participants as IdentityId[];
        this.privacyPolicy = pod.privacyPolicy;
        this.published = pod.published;
        this.rejectionText = pod.rejectionText;
        this.shortDescription = pod.shortDescription;
        this.termsAndConditions = pod.termsAndConditions;
    }

    public static async create(client: HttpClient, params: AppCreateParams): Promise<App> {
        return client.create<PODApp>(APPS_EP, params).then((podApp) => new AppImpl(client, podApp));
    }

    public static async get(client: HttpClient, id: AppId): Promise<App> {
        return client
            .get<PODApp>(AppImpl.endpointForId(id))
            .then((podApp) => new AppImpl(client, podApp));
    }

    public static async list(
        client: HttpClient,
        filter?: ListAppsFilter & PageParams,
    ): Promise<Page<App>> {
        const podPage = await client.get<Page<PODApp>>(APPS_EP, filter);
        const results = podPage.results.map((podApp) => new AppImpl(client, podApp));
        return {
            results,
            nextPageToken: podPage.nextPageToken,
        };
    }

    public static async update(
        client: HttpClient,
        id: AppId,
        params: AppUpdateParams,
    ): Promise<App> {
        return client
            .patch<PODApp>(AppImpl.endpointForId(id), params)
            .then((podApp) => new AppImpl(client, podApp));
    }

    public static async delete(client: HttpClient, id: AppId): Promise<void> {
        return client.delete(AppImpl.endpointForId(id));
    }

    /* This method is private because what will inevitably happen is someone will call
     * `parcel.getApp` followed by `parcel.createConsent(app.id, params)` and then be confused
     * when `app.consents` isn't updated. We could use a global to track this, but that feature
     * adds little ergonomicity.
     */
    private static async createConsent(
        client: HttpClient,
        appId: AppId,
        params: ConsentCreateParams,
    ): Promise<Consent> {
        return ConsentImpl.create(client, appId, params);
    }

    private static endpointForId(id: AppId): string {
        return `/apps/${id}`;
    }

    public async update(params: AppUpdateParams): Promise<App> {
        Object.assign(this, await AppImpl.update(this.client, this.id, params));
        return this;
    }

    public async delete(): Promise<void> {
        return this.client.delete(AppImpl.endpointForId(this.id));
    }

    public async createConsent(params: ConsentCreateParams): Promise<Consent> {
        const consent = await AppImpl.createConsent(this.client, this.id, params);
        this.consents.push(consent);
        return consent;
    }

    public async deleteConsent(consentId: ConsentId): Promise<void> {
        await ConsentImpl.delete(this.client, this.id, consentId);
        this.consents = this.consents.filter((c) => c.id !== consentId);
    }
}

export type AppUpdateParams = RequireAtLeastOne<{
    /**
     * Whether this app is active and visible to users. This is a one-shot flag
     * that cannot be reset. The app must be deleted to remove it from publication.
     */
    published: boolean;

    /**
     * If set, changes the participation status of the app.
     * If the App was previously invite-only, all Identities not in the
     * updated set of invites will be removed from the App and have any
     * Consents revoked.
     */
    inviteOnly: boolean;

    /** New Identities to invite. */
    invite: IdentityId[];

    /** Identities to uninvite. */
    uninvite: IdentityId[];

    /** New optional consents that users may accept. */
    newOptionalConsents: ConsentCreateParams[];

    /**
     * Consents to remove from this app.
     * Removed consents will be revoked for everyone.
     */
    removedConsents: ConsentId[];

    /** The new short description of the app. */
    shortDescription: string;

    /** The new extended description of the app. */
    extendedDescription: string;

    /** The new category of the app.  */
    category: string;

    /** The new invitation text. */
    invitationText: string;

    /** The new acceptance text. */
    acceptanceText: string;

    /** The new rejection text. */
    rejectionText: string;

    /** The app's new logo URL. */
    logo: string;

    /** The app's new homepage URL. */
    homepage: string;

    /** The app's new branding color; still as an RGB hex string. */
    brandingColor: string;
}>;

export type ListAppsFilter = Partial<{
    /** Only return Apps created/administered by the provided Identity. */
    creator: IdentityId;

    /** Only return Apps for which the requester has the specified participation status. */
    participation: AppParticipation;
}>;

export type AppParticipation = 'invited' | 'joined';
