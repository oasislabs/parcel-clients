import type { Opaque } from 'type-fest';

import type { ConsentId } from './consent';
import type { Constraints } from './filter';
import type { HttpClient } from './http';
import type { IdentityId } from './identity';
import type { Model, Page, PageParams, PODModel, ResourceId } from './model';

export type GrantId = Opaque<ResourceId>;

export type PODGrant = PODModel & {
  granter: ResourceId;
  grantee?: ResourceId;
  consent?: ResourceId;
  filter?: Constraints;
};

export type GrantCreateParams = {
  /**
   * The singular Identity to which permission is given, or everyone;
   */
  grantee: IdentityId | 'everyone';

  /** A filter that gives permission to only matching Datasets. */
  filter?: Constraints;
};

const GRANTS_EP = '/grants';
const endpointForId = (id: GrantId) => `${GRANTS_EP}/${id}`;

export class Grant implements Model {
  public id: GrantId;
  public createdAt: Date;
  /** The Identity from which permission is given. */
  public granter: IdentityId;
  /**
   * The Identity to which permission is given or everyone,
   */
  public grantee: IdentityId | 'everyone';
  /** A filter that gives permission to only matching Datasets. */
  public filter?: Constraints;
  /** The Consent that created this Grant, if any. */
  public consent?: ConsentId;

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
    return client
      .create<PODGrant>(GRANTS_EP, params)
      .then((podGrant) => new Grant(client, podGrant));
  }

  export async function get(client: HttpClient, id: GrantId): Promise<Grant> {
    return client.get<PODGrant>(endpointForId(id)).then((podGrant) => new Grant(client, podGrant));
  }

  export async function list(
    client: HttpClient,
    filter?: ListGrantsFilter & PageParams,
  ): Promise<Page<Grant>> {
    const podPage = await client.get<Page<PODGrant>>(GRANTS_EP, filter);
    const results = podPage.results.map((podGrant) => new Grant(client, podGrant));
    return {
      results,
      nextPageToken: podPage.nextPageToken,
    };
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
