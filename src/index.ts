import axios from 'axios';
import type { AxiosInstance } from 'axios';

import { Consent, ConsentCreateParams, ConsentId, ConsentUpdateParams } from './consent';
import { App, AppCreateParams, AppId, AppImpl, AppUpdateParams, ListAppsFilter } from './app';
import { Client } from './client';
import {
    Dataset,
    DatasetId,
    DatasetImpl,
    DatasetUpdateParams,
    DatasetUploadParams,
    Download,
    ListDatasetsFilter,
    Storable,
    Upload,
} from './dataset';
import { Grant, GrantCreateParams, GrantId, GrantImpl } from './grant';
import {
    Identity,
    IdentityCreateParams,
    IdentityId,
    IdentityImpl,
    IdentityUpdateParams,
} from './identity';
import { Page, PageParams } from './model';
import {
    ClientJWK,
    ES256JWK,
    HS256JWK,
    RS256JWK,
    StaticTokenProvider,
    TokenProvider,
} from './token';

export {
    App,
    AppCreateParams,
    AppId,
    AppUpdateParams,
    ClientJWK,
    Consent,
    ConsentCreateParams,
    ConsentId,
    ConsentUpdateParams,
    Dataset,
    DatasetId,
    DatasetUpdateParams,
    DatasetUploadParams,
    ES256JWK,
    Grant,
    GrantCreateParams,
    GrantId,
    HS256JWK,
    Identity,
    IdentityCreateParams,
    IdentityId,
    IdentityUpdateParams,
    Page,
    PageParams,
    RS256JWK,
    Storable,
};

export function Parcel(
    tokenSource: string | ClientJWK | TokenProvider,
    config?: ParcelConfig,
): ParcelApi {
    let tokenProvider: TokenProvider;
    if (typeof tokenSource === 'string') {
        tokenProvider = new StaticTokenProvider(tokenSource);
    } else if ((tokenSource as any).getToken) {
        tokenProvider = tokenSource as TokenProvider;
    } else {
        throw new Error('unimplemented');
        // TokenProvider = new RenewingTokenProvider(tokenSource);
    }

    return new ParcelClient(
        new Client(
            config?.httpClient ??
                axios.create({
                    baseURL: config?.apiUrl ?? 'https://api.oasislabs.com/parcel/v1',
                }),
            tokenProvider,
        ),
    );
}

export interface ParcelApi {
    /**
     * You can call this method, but you'll need to call `Parcel` with the
     * new Identity's token to do anything.
     */
    createIdentity: (params: IdentityCreateParams) => Promise<Identity>;

    // GetIdentity: (tokenOrId: string | IdentityId) => Promise<Identity>;
    // ^ prefer to use `Parcel(token)`

    /**
     * @returns the Identtity for the token provided when constructing this client.
     */
    getCurrentIdentity: () => Promise<Identity>;

    /**
     * @returns the connected Identity that was updated in-place.
     */
    updateCurrentIdentity: (update: IdentityUpdateParams) => Promise<Identity>;

    /**
     * Deletes the connected Identity.
     */
    deleteCurrentIdentity: () => Promise<void>;

    /**
     * Uploads a dataset to the gateway. The data is encrypted before being stored
     * in the blob store; the key is entrusted to the runtime.
     * Data is uploaded as a stream; if the upload fails, please try again.
     * @returns a reference to the uploaded dataset.
     */
    uploadDataset: (data: Storable, params?: DatasetUploadParams) => Upload;

    /**
     * Returns the reference to a previously uploaded dataset.
     * This method only returns the public information (and not any private data).
     * Use `parcel.downloadDataset` to download the data.
     */
    getDataset: (id: DatasetId) => Promise<Dataset>;

    listDatasets: (filter?: ListDatasetsFilter & PageParams) => Promise<Page<Dataset>>;

    /**
     * Downloads a decrypted dataset if the requester (i.e. current Identity) has permission.
     * @returns a stream that yields the plaintext data.
     * @throws ParcelError
     */
    downloadDataset: (id: DatasetId) => Download;

    /**
     * Updates the  App` with the provided ID in-place.
     * @returns the updated `Dataset`.
     * @throws ParcelError
     */
    updateDataset: (id: DatasetId, update: DatasetUpdateParams) => Promise<Dataset>;

    /**
     * Deletes the dataset including the data and the on-chain reference.
     * @throws ParcelError
     */
    deleteDataset: (id: DatasetId) => Promise<void>;

    /**
     * Creates a new `App`.
     * @throws ParcelError
     */
    createApp: (params: AppCreateParams) => Promise<App>;

    /**
     * Returns the existing `App` with the requested id.
     * @throws ParcelError
     */
    getApp: (id: AppId) => Promise<App>;

    /**
     * Returns a paginated list of `App`s that satisfy the provided filter.
     * @throws ParcelError
     */
    listApps: (filter?: ListAppsFilter & PageParams) => Promise<Page<App>>;

    /**
     * Updates the  App` with the provided ID in-place.
     * @returns the updated App.
     * @throws ParcelError
     */
    updateApp: (id: AppId, update: AppUpdateParams) => Promise<App>;

    /**
     * Authorized the App, granting all required Consents and provided optional ones.
     * @throws ParcelError
     */
    authorizeApp: (id: AppId, optionalConsents?: ConsentId[]) => Promise<void>;

    /**
     * Updates the consents that the connected identity has authorized to the specified app.
     * @throws ParcelError
     */
    updateAppConsent: (id: AppId, update: ConsentUpdateParams) => Promise<void>;

    /**
     * A convenience method for `updateAppConsent` that removes all consents.
     * @throws ParcelError
     */
    deauthorizeApp: (id: AppId) => Promise<void>;

    /**
     * Deletes the `App`, revoking any Grants made by consenting Identities.
     * @throws ParcelError
     */
    deleteApp: (id: AppId) => Promise<void>;

    /**
     * Creates a grant from the connected identity to another.
     * @throws ParcelError
     */
    createGrant: (params: GrantCreateParams) => Promise<Grant>;

    /**
     * Returns the existing `Grant` with the requested id.
     * @throws ParcelError
     */
    getGrant: (id: GrantId) => Promise<Grant>;

    /**
     * Deletes the specified `Grant`, revoking its granting ability.
     * @throws ParcelError
     */
    deleteGrant: (id: GrantId) => Promise<void>;
}

class ParcelClient implements ParcelApi {
    private currentIdentity?: Identity;

    public constructor(private readonly client: Client) {}

    public async createIdentity(parameters: IdentityCreateParams): Promise<Identity> {
        return IdentityImpl.create(this.client, parameters);
    }

    public async getCurrentIdentity(): Promise<Identity> {
        if (!this.currentIdentity) {
            this.currentIdentity = await IdentityImpl.current(this.client);
        }

        return this.currentIdentity;
    }

    public async updateCurrentIdentity(update: IdentityUpdateParams): Promise<Identity> {
        this.currentIdentity = await IdentityImpl.updateCurrent(this.client, update);
        return this.currentIdentity;
    }

    public async deleteCurrentIdentity(): Promise<void> {
        return IdentityImpl.deleteCurrent(this.client);
    }

    public uploadDataset(data: Storable, parameters?: DatasetUploadParams): Upload {
        return DatasetImpl.upload(this.client, data, parameters);
    }

    public async getDataset(id: DatasetId): Promise<Dataset> {
        return DatasetImpl.get(this.client, id);
    }

    public async listDatasets(filter?: ListDatasetsFilter & PageParams): Promise<Page<Dataset>> {
        return DatasetImpl.list(this.client, filter);
    }

    public downloadDataset(id: DatasetId): Download {
        return DatasetImpl.download(this.client, id);
    }

    public async updateDataset(id: DatasetId, update: DatasetUpdateParams): Promise<Dataset> {
        return DatasetImpl.update(this.client, id, update);
    }

    public async deleteDataset(id: DatasetId): Promise<void> {
        return DatasetImpl.delete(this.client, id);
    }

    public async createApp(parameters: AppCreateParams): Promise<App> {
        return AppImpl.create(this.client, parameters);
    }

    public async getApp(id: AppId): Promise<App> {
        return AppImpl.get(this.client, id);
    }

    public async listApps(filter?: ListAppsFilter & PageParams): Promise<Page<App>> {
        return AppImpl.list(this.client, filter);
    }

    public async updateApp(id: AppId, update: AppUpdateParams): Promise<App> {
        return AppImpl.update(this.client, id, update);
    }

    public async deleteApp(id: AppId): Promise<void> {
        return AppImpl.delete(this.client, id);
    }

    public async authorizeApp(id: AppId, optionalConsents?: ConsentId[]): Promise<void> {
        return AppImpl.authorize(this.client, id, optionalConsents);
    }

    public async updateAppConsent(id: AppId, update: ConsentUpdateParams): Promise<void> {
        return AppImpl.updateConsent(this.client, id, update);
    }

    public async deauthorizeApp(id: AppId): Promise<void> {
        return AppImpl.deauthorize(this.client, id);
    }

    public async createGrant(parameters: GrantCreateParams): Promise<Grant> {
        return GrantImpl.create(this.client, parameters);
    }

    public async getGrant(id: GrantId): Promise<Grant> {
        return GrantImpl.get(this.client, id);
    }

    public async deleteGrant(id: GrantId): Promise<void> {
        return GrantImpl.delete(this.client, id);
    }
}

export interface ParcelConfig {
    apiUrl?: string;

    httpClient?: AxiosInstance;
}
