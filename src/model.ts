import type { ConditionalExcept, Except } from 'type-fest';

import type { HttpClient } from './http.js';

export type ResourceId = string;

export type JsonSerializable =
  | Date
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonSerializable[]
  | { [key in string]: JsonSerializable };

export interface PODModel {
  /** An undifferentiated model identifier. */
  id: ResourceId;

  /** The number of seconds since the Unix epoch when this model was created */
  createdAt: string;
}

export interface Model {
  /** The model's unique ID. */
  readonly id: ResourceId;

  /** The number of seconds since the Unix epoch when this model was created */
  readonly createdAt: Date;
}

export type Writable<T extends Model> = WritableExcluding<T, never>;
export type WritableExcluding<T extends Model, ReadOnly extends keyof T> = ConditionalExcept<
  Except<T, 'id' | 'createdAt' | ReadOnly>,
  (...args: any[]) => any
>;

export type Page<T> = {
  results: T[];
  nextPageToken: string;
};

export type PageParams = Partial<{
  pageSize: number;
  pageToken: string;
}>;

export function makePage<Pod extends PODModel, M extends Model>(
  // eslint-disable-next-line @typescript-eslint/prefer-function-type
  ModelTy: { new (client: HttpClient, pod: Pod): M },
  podPage: Page<Pod>,
  client: HttpClient,
): Page<M> {
  return {
    results: podPage.results.map((podModel) => new ModelTy(client, podModel)),
    nextPageToken: podPage.nextPageToken,
  };
}
