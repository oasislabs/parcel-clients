import { Consent, ConsentCreateParams, ConsentId, ConsentUpdateParams } from './consent';
import { App, AppCreateParams, AppId, AppImpl, AppUpdateParams, ListAppsFilter } from './app';
import { Client, Config as ClientConfig, Download } from './client';
import {
    Dataset,
    DatasetId,
    DatasetImpl,
    DatasetUpdateParams,
    DatasetUploadParams,
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
import { ClientCredentials, PrivateJWK, PublicJWK, TokenProvider, TokenSource } from './token';

export {
    App,
    AppCreateParams,
    AppId,
    AppUpdateParams,
    ClientCredentials,
    Consent,
    ConsentCreateParams,
    ConsentId,
    ConsentUpdateParams,
    Dataset,
    DatasetId,
    DatasetUpdateParams,
    DatasetUploadParams,
    Grant,
    GrantCreateParams,
    GrantId,
    Identity,
    IdentityCreateParams,
    IdentityId,
    IdentityUpdateParams,
    Page,
    PageParams,
    PrivateJWK,
    PublicJWK,
    Storable,
    TokenSource,
};

export default class Parcel {
    private currentIdentity?: Identity;
    private readonly client: Client;

    public constructor(tokenSource: TokenSource, config?: Config) {
        const tokenProvider = TokenProvider.fromSource(tokenSource);
        this.client = new Client(tokenProvider, {
            apiUrl: config?.apiUrl,
            httpClient: config?.httpClient,
        });
    }

    public get apiUrl() {
        return this.client.apiUrl;
    }

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

export type Config = ClientConfig;
