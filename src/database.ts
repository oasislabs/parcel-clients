import type { Except, Opaque } from 'type-fest';

import type { HttpClient } from './http.js';
import type { IdentityId } from './identity.js';
import type { JsonSerializable, Model, Page, PageParams, PODModel, ResourceId } from './model.js';
import { makePage } from './model.js';

export type DatabaseId = Opaque<ResourceId, 'DatabaseId'>;

export type PODDatabase = Readonly<
  PODModel & {
    creator: ResourceId;
    owner: ResourceId;
    name: string;
  }
>;

export class Database implements Model {
  public readonly id: DatabaseId;
  public readonly createdAt: Date;
  public readonly creator: IdentityId;
  public readonly owner: IdentityId;
  public readonly name: string;

  #client: HttpClient;

  public constructor(client: HttpClient, pod: PODDatabase) {
    this.#client = client;
    this.id = pod.id as DatabaseId;
    this.createdAt = new Date(pod.createdAt);
    this.creator = pod.creator as IdentityId;
    this.owner = pod.owner as IdentityId;
    this.name = pod.name;
  }

  public async update(params: DatabaseUpdateParams): Promise<Database> {
    Object.assign(this, await DatabaseImpl.update(this.#client, this.id, params));
    return this;
  }

  public async delete(): Promise<void> {
    return DatabaseImpl.delete_(this.#client, this.id);
  }
}

export namespace DatabaseImpl {
  export async function get(client: HttpClient, id: DatabaseId): Promise<Database> {
    const podDatabase = await client.get<PODDatabase>(endpointForId(id));
    return new Database(client, podDatabase);
  }

  export async function create(
    client: HttpClient,
    params: DatabaseCreateParams,
  ): Promise<Database> {
    const podDatabase = await client.create<PODDatabase>(DATABASES_EP, params);
    return new Database(client, podDatabase);
  }

  export async function list(
    client: HttpClient,
    filter?: ListDatabasesFilter & PageParams,
  ): Promise<Page<Database>> {
    const podPage = await client.get<Page<PODDatabase>>(DATABASES_EP, filter);
    return makePage(Database, podPage, client);
  }

  export async function query(client: HttpClient, id: DatabaseId, params: Query): Promise<Row[]> {
    return client.post<Row[]>(endpointForId(id), params);
  }

  export async function update(
    client: HttpClient,
    id: DatabaseId,
    params: DatabaseUpdateParams,
  ): Promise<Database> {
    const PODDatabase = await client.update<PODDatabase>(endpointForId(id), params);
    return new Database(client, PODDatabase);
  }

  export async function delete_(client: HttpClient, id: DatabaseId): Promise<void> {
    return client.delete(endpointForId(id));
  }
}

export type ListDatabasesFilter = Partial<{
  /** Only return databases from the provided owner. */
  owner?: IdentityId;

  /** Only return databases matching the provided name. */
  name?: string;
}>;

export type Query = {
  sql: string;
  params: Record<string, JsonSerializable>;
};

export type Row = JsonSerializable;

const DATABASES_EP = 'databases';
const endpointForId = (id: DatabaseId) => `${DATABASES_EP}/${id}`;

export type DatabaseUpdateParams = {
  name?: string;
  owner?: IdentityId;
};
export type DatabaseCreateParams = Except<DatabaseUpdateParams, 'owner'>;
