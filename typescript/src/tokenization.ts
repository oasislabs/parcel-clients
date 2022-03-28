import type { Except, Opaque } from 'type-fest';

import type { AccessContext, AssetId, EscrowedAsset, EscrowedAssetSearchParams } from './asset.js';
import { AssetImpl } from './asset.js';
import type { Condition } from './condition.js';
import type { Capabilities } from './grant.js';
import type { HttpClient } from './http.js';
import type { IdentityId } from './identity.js';
import type { Model, Page, PageParams, PODModel, ResourceId } from './model.js';
import { makePage } from './model.js';

export type TokenId = Opaque<ResourceId, 'TokenId'>;
export type TransferReceiptId = Opaque<ResourceId, 'TransferReceiptId'>;

export type PODToken = Readonly<
  PODModel & {
    creator: string;
    name?: string;
    grant: TokenGrantSpec;
    consumesAssets: boolean;
    transferability: TokenTransferability;
  }
>;

const TOKENS_EP = 'tokens';
const RECEIPTS_EP = 'receipts';
const endpointForId = (id: TokenId) => `${TOKENS_EP}/${id}`;
const endpointForAssets = (token: TokenId) => `${endpointForId(token)}/assets`;
const endpointForAsset = (token: TokenId, asset: AssetId) => `${endpointForAssets(token)}/${asset}`;
const endpointForTransfers = (id: TokenId) => `${endpointForId(id)}/transfers`;
const endpointForTransfer = (token: TokenId, receipt: TransferReceiptId) =>
  `${endpointForTransfers(token)}/${receipt}`;

export class Token implements Model {
  public readonly id: TokenId;
  public readonly creator: IdentityId;
  public readonly createdAt: Date;
  public readonly name?: string;
  public readonly grant: TokenGrantSpec;
  public readonly consumesAssets: boolean;
  public readonly transferability: TokenTransferability;

  #client: HttpClient;

  public constructor(client: HttpClient, pod: PODToken) {
    this.#client = client;
    this.id = pod.id as TokenId;
    this.creator = pod.creator as IdentityId;
    this.createdAt = new Date(pod.createdAt);
    this.grant = pod.grant;
    this.consumesAssets = pod.consumesAssets;
    this.transferability = pod.transferability;
  }

  public async delete(): Promise<void> {
    return TokenImpl.delete_(this.#client, this.id);
  }

  public async searchAssets(
    filter?: Except<EscrowedAssetSearchParams, 'token'> & PageParams,
  ): Promise<Page<EscrowedAsset>> {
    return AssetImpl.search(this.#client, {
      ...filter,
      token: this.id,
    });
  }

  /**
   * Adds an asset to this token.
   * The asset must be held by the escrow identity and not have been consumed by another token.
   */
  public async addAsset(asset: AssetId): Promise<TokenizationReceipt> {
    return TokenImpl.addAsset(this.#client, this.id, asset);
  }

  /**
   * Removes an asset from this token. You must hold the entire supply of the token to do this.
   * If this token previously consumed the asset, it will again become available to tokenize.
   */
  public async removeAsset(asset: AssetId): Promise<void> {
    return TokenImpl.removeAsset(this.#client, this.id, asset);
  }

  public async transfer(amount: number, recipient: IdentityId): Promise<TransferReceipt> {
    return TokenImpl.transfer(this.#client, this.id, amount, recipient);
  }

  public async listTransfers(
    filter?: ListTokenTransfersFilter & PageParams,
  ): Promise<Page<TransferReceipt>> {
    return TokenImpl.listTransferReceipts(this.#client, this.id, filter);
  }
}

export namespace TokenImpl {
  export async function mint(client: HttpClient, params: TokenCreateParams): Promise<Token> {
    const podToken = await client.create<PODToken>(TOKENS_EP, params);
    return new Token(client, podToken);
  }

  export async function get(client: HttpClient, id: TokenId): Promise<Token> {
    const podToken = await client.get<PODToken>(endpointForId(id));
    return new Token(client, podToken);
  }

  export async function delete_(client: HttpClient, id: TokenId): Promise<void> {
    return client.delete(endpointForId(id));
  }

  export async function search(
    client: HttpClient,
    params?: TokenSearchParams & PageParams,
  ): Promise<Page<Token>> {
    const podPage = await client.search<PODToken>(TOKENS_EP, params);
    return makePage(Token, podPage, client);
  }

  export async function addAsset(
    client: HttpClient,
    token: TokenId,
    asset: AssetId,
  ): Promise<TokenizationReceipt> {
    return client.post(endpointForAsset(token, asset), undefined);
  }

  export async function removeAsset(
    client: HttpClient,
    token: TokenId,
    asset: AssetId,
  ): Promise<void> {
    await client.delete(endpointForAsset(token, asset));
  }

  export async function transfer(
    client: HttpClient,
    token: TokenId,
    amount: number,
    recipient: IdentityId,
  ): Promise<TransferReceipt> {
    if (amount % 1 !== 0 || amount < 0) {
      throw new Error(`invalid token amount ${amount}. must be a positive integer`);
    }

    const podReceipt = await client.post<PODTransferReceipt>(endpointForTransfers(token), {
      recipient,
      amount,
    });
    return {
      ...podReceipt,
      completedAt: new Date(podReceipt.completedAt),
    };
  }

  export async function listTransferReceipts(
    client: HttpClient,
    tokenId: TokenId,
    filter?: ListTokenTransfersFilter & PageParams,
  ): Promise<Page<TransferReceipt>> {
    const podPage = await client.get<Page<PODTransferReceipt>>(
      endpointForTransfers(tokenId),
      filter,
    );
    return {
      ...podPage,
      results: podPage.results.map((podReceipt) => ({
        ...podReceipt,
        completedAt: new Date(podReceipt.completedAt),
      })),
    };
  }

  export async function getTransferReceipt(
    client: HttpClient,
    receipt: TransferReceiptId,
    token?: TokenId,
  ): Promise<TransferReceipt> {
    const url = token ? endpointForTransfer(token, receipt) : `${RECEIPTS_EP}/${receipt}`;
    const podReceipt = await client.get<PODTransferReceipt>(url);
    return {
      ...podReceipt,
      completedAt: new Date(podReceipt.completedAt),
    };
  }
}

export type TokenCreateParams = {
  name?: string;
  grant: TokenGrantSpec;
  consumesAssets?: boolean;
  transferability: TokenTransferability;
};

export type TokenGrantSpec = {
  condition: Condition | null;
  capabilities?: Capabilities;
};

export type TokenBalance = {
  id: TokenId;
  balance: number;
};

export type EthAddr = string;

export namespace TokenTransferability {
  export type Parcel = {
    parcel: {
      supply: number;
    };
  };
  export type Remote = {
    remote: RemoteToken;
  };
}
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type TokenTransferability = TokenTransferability.Parcel | TokenTransferability.Remote;

export namespace RemoteToken {
  export type EthLike = {
    network: EthNetwork;
    address: EthAddr;
    /**
     * The ID of the particular NFT within the collection. Required when the token is
     * ERC721 or ERC1155. Only values less than 2^63 - 1 are currently supported.
     */
    tokenId?: number;
  };
}
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type RemoteToken = RemoteToken.EthLike;

export type EthNetwork = 'emerald-mainnet' | 'emerald-testnet';

export type TokenSearchParams = {
  /** Search for tokens held by this identity. */
  heldBy?: IdentityId;
  containsAsset?: {
    selectedByCondition?: Condition;
    accessibleInContext?: AccessContext;
  };
};

export type TokenizationReceipt = {
  asset: AssetId;
  token: TokenId;
  consumed: boolean;
};

export type TransferReceipt = {
  id: TransferReceiptId;
  completedAt: Date;
  token: TokenId;
  amount: number;
  sender: IdentityId;
  recipient: IdentityId;
  /** The transaction hash of the Ethereum transaction that triggered this transfer. */
  bridgeTxId?: string;
};

export type PODTransferReceipt = Except<TransferReceipt, 'completedAt'> & { completedAt: string };

export type ListTokenTransfersFilter = {
  sender?: IdentityId;
  recipient?: IdentityId;
  /** Transfers completed after this time. */
  after?: Date;
  /** Transfers completed before this time. */
  before?: Date;
};
