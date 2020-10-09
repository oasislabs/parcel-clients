import { Client } from './client';
import {
    Consent,
    ConsentCreateParams,
    ConsentId,
    ConsentImpl,
    ConsentUpdateParams,
    PODConsent,
} from './consent';
import { IdentityId } from './identity';
import { AtLeastOne, Model, Page, PageParams, PODModel, ResourceId, containsUpdate } from './model';

export type AppId = ResourceId & { readonly __tag: unique symbol };

export type PODApp = PODModel & {
    acceptanceText?: string;
    brandingColor?: string;
    category?: string;
    consents: PODConsent[];
    creator: ResourceId;
    extendedDescription?: string;
    homepage: string;
    invitationText?: string;
    inviteOnly: boolean;
    invites?: ResourceId[];
    name: string;
    organization: string;
    participants: ResourceId[];
    privacyPolicy: string;
    published: boolean;
    rejectionText?: string;
    shortDescription: string;
    termsAndConditions: string;
    logo?: string;
};

export type AppCreateParams = {
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

    /** The Identity that created the App. */
    creator: IdentityId;

    /** If `true`, only invited Identities may  the app. */
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
     * Authorizes this App and applies the required consents, as well as any
     * optional ones.
     */
    authorize: (optionalConsents?: ConsentId[]) => Promise<void>;

    /**
     * Updates the optional consents made to this App.
     */
    updateConsent: (update: ConsentUpdateParams) => Promise<void>;

    deauthorize: () => Promise<void>;

    /**
     * Updates the app according to the provided `params`.
     * @returns the updated `this`
     * @throws `ParcelError`
     */
    update: (params: AppUpdateParams) => Promise<App>;

    /**
     * Deletes the app.
     * @throws `ParcelError`
     */
    delete: () => Promise<void>;
}

const APPS_EP = '/apps';

export class AppImpl implements App {
    public acceptanceText?: string;
    public brandingColor?: string;
    public category?: string;
    public consents: Consent[];
    public createTimestamp: number;
    public creator: IdentityId;
    public extendedDescription?: string;
    public homepage: string;
    public id: AppId;
    public invites: IdentityId[];
    public invitationText?: string;
    public inviteOnly: boolean;
    public name: string;
    public organization: string;
    public participants: IdentityId[];
    public privacyPolicy: string;
    public published: boolean;
    public rejectionText?: string;
    public shortDescription: string;
    public termsAndConditions: string;
    public logo?: string;

    public constructor(private readonly client: Client, pod: PODApp) {
        this.acceptanceText = pod.acceptanceText;
        this.brandingColor = pod.brandingColor;
        this.category = pod.category;
        this.consents = pod.consents.map((podConsent) => new ConsentImpl(client, podConsent));
        this.createTimestamp = pod.createTimestamp;
        this.creator = pod.creator as IdentityId;
        this.extendedDescription = pod.extendedDescription;
        this.homepage = pod.homepage;
        this.id = pod.id as AppId;
        this.invites = pod.invites as IdentityId[];
        this.invitationText = pod.invitationText;
        this.inviteOnly = pod.inviteOnly;
        this.name = pod.name;
        this.organization = pod.organization;
        this.participants = pod.participants as IdentityId[];
        this.privacyPolicy = pod.privacyPolicy;
        this.published = pod.published;
        this.rejectionText = pod.rejectionText;
        this.shortDescription = pod.shortDescription;
        this.termsAndConditions = pod.termsAndConditions;
        this.logo = pod.logo;
    }

    public static async create(client: Client, parameters: AppCreateParams): Promise<App> {
        return client
            .create<PODApp>(APPS_EP, parameters)
            .then((podApp) => new AppImpl(client, podApp));
    }

    public static async get(client: Client, id: AppId): Promise<App> {
        return client
            .get<PODApp>(AppImpl.endpointForId(id))
            .then((podApp) => new AppImpl(client, podApp));
    }

    public static async list(
        client: Client,
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
        client: Client,
        id: AppId,
        parameters: AppUpdateParams,
    ): Promise<App> {
        if (!containsUpdate(parameters)) {
            return AppImpl.get(client, id);
        }

        return client
            .patch<PODApp>(AppImpl.endpointForId(id), parameters)
            .then((podApp) => new AppImpl(client, podApp));
    }

    public static async delete(client: Client, id: AppId): Promise<void> {
        return client.delete(AppImpl.endpointForId(id));
    }

    public static async updateConsent(
        client: Client,
        id: AppId,
        parameters: ConsentUpdateParams,
    ): Promise<void> {
        await client.patch<void>(AppImpl.consentEndpointForId(id), parameters);
    }

    public static async authorize(
        client: Client,
        id: AppId,
        optionalConsents?: ConsentId[],
    ): Promise<void> {
        await client.post<void>(AppImpl.consentEndpointForId(id), {
            consents: optionalConsents,
        });
    }

    public static async deauthorize(client: Client, id: AppId): Promise<void> {
        await client.delete(AppImpl.consentEndpointForId(id));
    }

    private static endpointForId(id: AppId): string {
        return `/apps/${id}`;
    }

    private static consentEndpointForId(id: AppId): string {
        return `${AppImpl.endpointForId(id)}/consent`;
    }

    public async update(parameters: AppUpdateParams): Promise<App> {
        Object.assign(this, await AppImpl.update(this.client, this.id, parameters));
        return this;
    }

    public async authorize(optionalConsents?: ConsentId[]): Promise<void> {
        return AppImpl.authorize(this.client, this.id, optionalConsents);
    }

    public async deauthorize(): Promise<void> {
        return AppImpl.deauthorize(this.client, this.id);
    }

    public async updateConsent(parameters: ConsentUpdateParams): Promise<void> {
        if (!containsUpdate(parameters)) {
            return;
        }

        return AppImpl.updateConsent(this.client, this.id, parameters);
    }

    public async delete(): Promise<void> {
        return this.client.delete(AppImpl.endpointForId(this.id));
    }
}

export type AppUpdateParams = AtLeastOne<{
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

export type ListAppsFilter = {
    /** Only return Apps created/administered by the provided Identity. */
    creator?: IdentityId;

    /** Only return Apps for which the requester has the specified participation status. */
    requesterParticipation?: AppParticipation;
};

export type AppParticipation = 'invited' | 'joined';
