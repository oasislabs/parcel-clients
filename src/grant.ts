import type { Opaque } from 'type-fest';

import type { ConsentId } from './consent.js';
import type { Constraints } from './filter.js';
import type { HttpClient } from './http.js';
import type { IdentityId } from './identity.js';
import type { Model, Page, PageParams, PODModel, ResourceId } from './model.js';
import { makePage } from './model.js';

export type GrantId = Opaque<ResourceId, 'GrantId'>;

export type PODGrant = Readonly<
  PODModel & {
    granter: ResourceId;
    grantee?: ResourceId;
    consent?: ResourceId;
    filter?: Constraints;
  }
>;

export type GrantCreateParams = {
  /**
   * The singular Identity to which permission is given, or everyone;
   */
  grantee: IdentityId | 'everyone';

  /** A filter that gives permission to only matching Datasets. */
  filter?: Constraints;
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
  /** A filter that gives permission to only matching Datasets. */
  public readonly filter?: Constraints;
  /** The Consent that created this Grant, if any. */
  public readonly consent?: ConsentId;

  public constructor(private readonly client: HttpClient, pod: PODGrant) {
    this.id = pod.id as GrantId;
    this.createdAt = new Date(pod.createdAt);
    this.granter = pod.granter as IdentityId;
    this.grantee = (pod.grantee as IdentityId) ?? 'everyone';
    this.filter = pod.filter;
    this.consent = pod.consent as ConsentId;
  }

  public async delete(): Promise<void> {
    return this.client.delete(endpointForId(this.id));
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

export type ListGrantsFilter = Partial<{
  /** Only return grants from granter. */
  granter?: IdentityId;

  /** Only return grants for the provided app. */
  grantee?: IdentityId;
}>;
