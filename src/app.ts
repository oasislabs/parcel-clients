import type { Except, Opaque } from 'type-fest';

import type { HttpClient } from './http.js';
import type { IdentityId, IdentityCreateParams, IdentityUpdateParams } from './identity.js';
import { Identity, IdentityImpl } from './identity.js';
import type { Model, Page, PageParams, PODModel, ResourceId, WritableExcluding } from './model.js';
import { makePage } from './model.js';
import { Permission, PermissionImpl } from './permission.js';
import type { PermissionCreateParams, PermissionId } from './permission.js';

export type AppId = Opaque<ResourceId, 'AppId'>;

export type PODApp = Readonly<
  PODModel & {
    acceptanceText?: string;
    admins: ResourceId[];
    allowUserUploads: boolean;
    brandingColor?: string;
    category?: string;
    collaborators: ResourceId[];
    extendedDescription?: string;
    homepageUrl: string;
    invitationText?: string;
    inviteOnly: boolean;
    invites?: ResourceId[];
    logoUrl: string;
    name: string;
    organization: string;
    owner: ResourceId;
    participants: ResourceId[];
    published: boolean;
    rejectionText?: string;
    shortDescription: string;
    termsAndConditions: string;
    privacyPolicy: string;
  }
>;

export class App implements Model {
  public readonly id: AppId;
  public readonly createdAt: Date;

  /** The Identity that created the app. */
  public readonly owner: IdentityId;
  public readonly admins: IdentityId[];
  /** Identities that can view participation of the app and modify un-privileged fields. */
  public readonly collaborators: IdentityId[];

  /** Whether this app has been published. Permissions may not be modified after publishing, */
  public readonly published: boolean;
  /** If `true`, only invited Identities may participate in the app. */
  public readonly inviteOnly: boolean;
  /** Identities invited to participate in this app. */
  public readonly invites: IdentityId[];
  /** The set of identities that are currently authorizing this app. */
  public readonly participants: IdentityId[];
  /** Allow non-admin users to upload documents. */
  public readonly allowUserUploads: boolean;

  public readonly name: string;
  /** The name of the app publisher's organization. */
  public readonly organization: string;
  public readonly shortDescription: string;
  /** The app publisher's homepage URL. */
  public readonly homepageUrl: string;
  /** A URL pointing to (or containing) the app's logo. */
  public readonly logoUrl: string;
  /** The privacy policy presented to the user when joining the app. */
  public readonly privacyPolicy: string;
  /** The terms and conditions presented to the user when joining the app. */
  public readonly termsAndConditions: string;

  /** Text shown to the user when viewing the app's invite page. */
  public readonly invitationText?: string;
  /** Text shown to the user after accepting the app's invitation. */
  public readonly acceptanceText?: string;
  /** Text shown to the user after rejecting the app's invitation. */
  public readonly rejectionText?: string;

  public readonly extendedDescription?: string;
  /** The app's branding color in RGB hex format (e.g. `#ff4212`). */
  public readonly brandingColor?: string;
  /**
   * Text describing the category of the app (e.g., health, finance) that can
   * be used to search for the app.
   */
  public readonly category?: string;

  #client: HttpClient;

  public constructor(client: HttpClient, pod: PODApp) {
    this.#client = client;
    this.acceptanceText = pod.acceptanceText;
    this.admins = pod.admins as IdentityId[];
    this.allowUserUploads = pod.allowUserUploads;
    this.brandingColor = pod.brandingColor;
    this.category = pod.category;
    this.collaborators = pod.collaborators as IdentityId[];
    this.createdAt = new Date(pod.createdAt);
    this.owner = pod.owner as IdentityId;
    this.extendedDescription = pod.extendedDescription;
    this.homepageUrl = pod.homepageUrl;
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
    this.logoUrl = pod.logoUrl;
  }

  public async getIdentity(): Promise<Identity> {
    return IdentityImpl.get(this.#client, this.id);
  }

  public async update(params: AppUpdateParams): Promise<App> {
    Object.assign(this, await AppImpl.update(this.#client, this.id, params));
    return this;
  }

  public async updateIdentity(params: IdentityUpdateParams): Promise<Identity> {
    return IdentityImpl.update(this.#client, this.id, params);
  }

  public async delete(): Promise<void> {
    return AppImpl.delete_(this.#client, this.id);
  }

  /**
   * Creates a new permission that this app will request from users. The new permission
   * will be added to `this.permissions`.
   */
  public async createPermission(params: PermissionCreateParams): Promise<Permission> {
    return PermissionImpl.create(this.#client, this.id, params);
  }

  /**
   * Returns the permissions associated with this app.
   */
  public async listPermissions(filter?: PageParams): Promise<Page<Permission>> {
    return PermissionImpl.list(this.#client, this.id, filter);
  }

  /**
   * Deletes a permission from this app, revoking any access made by granting permission.
   * will be removed from `this.permissions`.
   */
  public async deletePermission(permissionId: PermissionId): Promise<void> {
    return PermissionImpl.delete_(this.#client, this.id, permissionId);
  }
}

export namespace AppImpl {
  export async function create(client: HttpClient, params: AppCreateParams): Promise<App> {
    const podApp = await client.create<PODApp>(APPS_EP, params);
    return new App(client, podApp);
  }

  export async function get(client: HttpClient, id: AppId): Promise<App> {
    const podApp = await client.get<PODApp>(endpointForId(id));
    return new App(client, podApp);
  }

  export async function list(
    client: HttpClient,
    filter?: ListAppsFilter & PageParams,
  ): Promise<Page<App>> {
    const podPage = await client.get<Page<PODApp>>(APPS_EP, filter);
    return makePage(App, podPage, client);
  }

  export async function update(
    client: HttpClient,
    id: AppId,
    params: AppUpdateParams,
  ): Promise<App> {
    const podApp = await client.update<PODApp>(endpointForId(id), params);
    return new App(client, podApp);
  }

  export async function delete_(client: HttpClient, id: AppId): Promise<void> {
    return client.delete(endpointForId(id));
  }
}

export const APPS_EP = 'apps';
const endpointForId = (id: AppId) => `${APPS_EP}/${id}`;
export { endpointForId as endpointForApp };

export type AppCreateParams = Except<AppUpdateParams, 'owner'> & {
  /** The credentials used to authorize clients acting as this app. */
  identity: IdentityCreateParams;
};

export type AppUpdateParams = WritableExcluding<App, 'participants'>;

export type ListAppsFilter = Partial<{
  /** Only return Apps owned by the provided Identity. */
  owner: IdentityId;

  /** Only return Apps for which the requester has the specified participation status. */
  participation: AppParticipation;
}>;

export type AppParticipation = 'invited' | 'joined';
