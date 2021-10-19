import type { Opaque } from 'type-fest';

import type { JobSpec } from './compute.js';
import type { Condition } from './condition.js';
import type { HttpClient } from './http.js';
import type { IdentityId } from './identity.js';
import type { Page, PageParams, ResourceId } from './model.js';
import type { TokenId } from './tokenization.js';

export type AssetId = Opaque<ResourceId, 'DocumentId' | 'DatabaseId'>;

const ASSETS_EP = 'escrow/assets';
const endpointForId = (id: AssetId) => `${ASSETS_EP}/${id}`;

/** An asset held by the escrow identity. */
export type EscrowedAsset = {
  readonly type: 'document' | 'database';
  readonly id: AssetId;
  /** The identity that has permission to retrieve the asset from escrow. */
  readonly cliamant: IdentityId;
};

export namespace AssetImpl {
  export async function search(
    client: HttpClient,
    params?: EscrowedAssetSearchParams & PageParams,
  ): Promise<Page<EscrowedAsset>> {
    return client.search<EscrowedAsset>(`${ASSETS_EP}/search`, params);
  }

  export async function get(client: HttpClient, assetId: AssetId): Promise<EscrowedAsset> {
    return client.get(endpointForId(assetId));
  }
}

export type EscrowedAssetSearchParams = {
  token?: TokenId;
  selectedByCondition?: Condition;
  accessibleInContext?: AccessContext;
};

/**
 * The context in which a document will be accessed.
 * Grants condition on the values of this context.
 */
export type AccessContext = {
  /**
   * The identity that will be accessing the document.
   * Leaving this field unset will search for documents
   * accessible to anybody (likely only in the context of a job).
   */
  accessor?: IdentityId;

  /**
   * The job that will be accessing the data.
   * Leaving this field unset will search for documents
   * accessible directly by identities. If `identity` is
   * also unset, the search will return public documents.
   */
  job?: JobSpec;

  /**
   * The time at which the data will be accessed.
   * Generally, you don't need to set this unless you're differentiating
   * among multiple documents that all require a certain access time.
   */
  accessTime?: Date;

  // /**
  //  * The kind of worker that you must use to run the job.
  //  */
  // worker: WorkerSpec; // TODO
};
