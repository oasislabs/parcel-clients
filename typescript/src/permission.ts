import type { Opaque } from 'type-fest';

import type { AppId } from './app.js';
import { endpointForApp } from './app.js';
import type { Condition } from './condition.js';
import type { HttpClient } from './http.js';
import type { IdentityId } from './identity.js';
import type { Model, Page, PageParams, PODModel, ResourceId } from './model.js';
import { makePage } from './model.js';

export type PermissionId = Opaque<ResourceId, 'PermissionId'>;

export type PODPermission = Readonly<
  PODModel &
    PermissionCreateParams & {
      appId: ResourceId;
    }
>;

export type PermissionCreateParams = {
  /** The Grants to make when the App containing this Permission is joined. */
  grants: GrantSpec[];

  /** The name of this permission. */
  name: string;

  /** The description of this permission seen by users when shown in an app. */
  description: string;

  /** The text seen by users when accepting this permission. */
  allowText: string;

  /** The text seen by users when denying this permission. */
  denyText: string;
};

export class Permission implements Model {
  public readonly id: PermissionId;
  public readonly appId: AppId;
  public readonly createdAt: Date;

  /** The Grants to make when the App containing this Permission is joined. */
  public readonly grants: GrantSpec[];

  public readonly name: string;

  /** The description of this permission seen by users when shown in an app. */
  public readonly description: string;

  /** The text seen by users when accepting this permission. */
  public readonly allowText: string;

  /** The text seen by users when denying this permission. */
  public readonly denyText: string;

  #client: HttpClient;

  public constructor(client: HttpClient, pod: PODPermission) {
    this.#client = client;
    this.id = pod.id as PermissionId;
    this.appId = pod.appId as AppId;
    this.createdAt = new Date(pod.createdAt);
    this.grants = pod.grants;
    this.name = pod.name;
    this.description = pod.description;
    this.allowText = pod.allowText;
    this.denyText = pod.denyText;
  }
}

export namespace PermissionImpl {
  export async function create(
    client: HttpClient,
    appId: AppId,
    params: PermissionCreateParams,
  ): Promise<Permission> {
    const podPermission = await client.create<PODPermission>(endpointForCollection(appId), params);
    return new Permission(client, podPermission);
  }

  export async function list(
    client: HttpClient,
    appId: AppId,
    filter?: PageParams,
  ): Promise<Page<Permission>> {
    const podPage = await client.get<Page<PODPermission>>(endpointForCollection(appId), filter);
    return makePage(Permission, podPage, client);
  }

  export async function get(
    client: HttpClient,
    appId: AppId,
    permissionId: PermissionId,
  ): Promise<Permission> {
    const podPermission = await client.get<PODPermission>(endpointForId(appId, permissionId));
    return new Permission(client, podPermission);
  }

  export async function delete_(
    client: HttpClient,
    appId: AppId,
    permissionId: PermissionId,
  ): Promise<void> {
    return client.delete(endpointForId(appId, permissionId));
  }
}

const endpointForCollection = (appId: AppId) => `${endpointForApp(appId)}/permissions`;
const endpointForId = (appId: AppId, permissionId: PermissionId) =>
  `${endpointForCollection(appId)}/${permissionId}`;

export type GrantSpec = {
  /** The symbolic granter. */
  granter: GranterRef;

  /** The symbolic grantee. */
  grantee?: GranteeRef;

  /** The Grant's condition. @see `Grant.condition`. */
  condition?: Condition;
};

/** `app` represents the app, `participant` represents the joining identity. */
export type GranterRef = 'app' | 'participant';

/**
 * A `ResourceId` causes the grant to be made to a specific Identity,
 * `app` grants to the app, `participant` grants to the joining identity, and
 * `everyone` refers to, well, everyone.
 */
export type GranteeRef = 'app' | 'participant' | 'everyone' | IdentityId;
