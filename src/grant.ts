import type { Opaque } from 'type-fest';

import type { Condition } from './condition.js';
import type { HttpClient } from './http.js';
import type { IdentityId } from './identity.js';
import type { Model, Page, PageParams, PODModel, ResourceId } from './model.js';
import { makePage } from './model.js';
import type { PermissionId } from './permission.js';

export type GrantId = Opaque<ResourceId, 'GrantId'>;

export type PODGrant = Readonly<
  PODModel & {
    granter: ResourceId;
    grantee?: ResourceId;
    permission?: ResourceId;
    condition?: Condition;
    capabilities: string;
    delegating?: ResourceId;
  }
>;

export type GrantCreateParams = {
  /**
   * The singular Identity to which permission is given, or everyone;
   */
  grantee: IdentityId | 'everyone';

  /** The condition that must be matched to receive access to one or more Assets - Documents and Databases. */
  condition?: Condition | null;

  /** The capabilities attached to this grant. The default is `read`. */
  capabilities?: Capabilities | string;

  /**
   * The grant to extend by delegation. If you are the delegating grant's `grantee` is you,
   * and it has the `extend` capability, then this grant will have the same `granter` as
   * the delegating grant.
   */
  delegating?: GrantId;
};

const GRANTS_EP = 'grants';
const endpointForId = (id: GrantId) => `${GRANTS_EP}/${id}`;

export class Grant implements Model {
  public readonly id: GrantId;
  public readonly createdAt: Date;
  /** The Identity from which permission is given. */
  public readonly granter: IdentityId;
  /**
   * The Identity to which permission is given or everyone,
   */
  public readonly grantee: IdentityId | 'everyone';
  /** The condition that describes Assets - Documents and Databases to be shared. */
  public readonly condition?: Condition;
  /** The permission that created this Grant, if any. */
  public readonly permission?: PermissionId;
  /** The actions permissible to the grantee on targets selected by the conditions. */
  public readonly capabilities?: Capabilities;
  /** The grant that this grant extends by delegation. */
  public readonly delegating?: GrantId;

  #client: HttpClient;

  public constructor(client: HttpClient, pod: PODGrant) {
    this.#client = client;
    this.id = pod.id as GrantId;
    this.createdAt = new Date(pod.createdAt);
    this.granter = pod.granter as IdentityId;
    this.grantee = (pod.grantee as IdentityId) ?? 'everyone';
    this.condition = pod.condition;
    this.permission = pod.permission as PermissionId;
    this.capabilities = pod.capabilities ? parseCaps(pod.capabilities) : undefined;
    this.delegating = pod.delegating as GrantId;
  }

  public async delete(): Promise<void> {
    return this.#client.delete(endpointForId(this.id));
  }
}

export namespace GrantImpl {
  export async function create(client: HttpClient, params: GrantCreateParams): Promise<Grant> {
    const podGrant = await client.create<PODGrant>(GRANTS_EP, params);
    return new Grant(client, podGrant);
  }

  export async function get(client: HttpClient, id: GrantId): Promise<Grant> {
    const podGrant = await client.get<PODGrant>(endpointForId(id));
    return new Grant(client, podGrant);
  }

  export async function list(
    client: HttpClient,
    filter?: ListGrantsFilter & PageParams,
  ): Promise<Page<Grant>> {
    const podPage = await client.get<Page<PODGrant>>(GRANTS_EP, filter);
    return makePage(Grant, podPage, client);
  }

  export async function delete_(client: HttpClient, id: GrantId): Promise<void> {
    return client.delete(endpointForId(id));
  }
}

export type ListGrantsFilter = {
  /** Only return grants from granter. */
  granter?: IdentityId;

  /** Only return grants for the provided app. */
  grantee?: IdentityId;
};

/**
 * `Capabilities` is a collection of bit flags.
 * To test if a capability is set, you can do something like
 * ```
 * const requiredCaps = (Capabilities.Read | Capabilities.Extend);
 * caps & requiredCaps === requiredCaps;
 * ```
 */
/* eslint-disable @typescript-eslint/prefer-literal-enum-member */
export enum Capabilities {
  None = 0,
  /** The ability to read/view the target. */
  Read = 1 << 0, // eslint-disable-line unicorn/prefer-math-trunc
  // /** The ability to write the target. */
  // Write = 1 << 1,
  /** The ability to delegate this grant's capabilities to someone else. */
  Extend = 1 << 2,
}
/* eslint-enable @typescript-eslint/prefer-literal-enum-member */

export function parseCaps(strCaps?: string): Capabilities {
  if (strCaps === undefined) return Capabilities.None;
  let caps = Capabilities.None;
  for (const strCap of strCaps.trim().split(/\s+/)) {
    switch (strCap) {
      case 'read':
        caps |= Capabilities.Read;
        break;
      case 'extend':
        caps |= Capabilities.Extend;
        break;
      case '':
        break;
      default:
        throw new Error(`unknown capability "${strCap}"`);
    }
  }

  return caps;
}

export function stringifyCaps(caps?: Capabilities): string {
  if (caps === undefined) return '';
  const capsStrs = [];
  for (const [name, bit] of Object.entries(Capabilities)) {
    if (typeof bit !== 'number') continue;
    if ((caps & bit) !== 0) {
      capsStrs.push(name.toLowerCase());
    }
  }

  return capsStrs.join(' ');
}
