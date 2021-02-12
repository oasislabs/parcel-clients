import type { ConditionalExcept, Except, JsonObject, JsonValue } from 'type-fest';

export type ResourceId = string; // Format from runtime: `<resource>-<id>`

export interface PODModel extends JsonObject {
  /** An undifferentiated model identifier. */
  id: ResourceId;

  /** The number of seconds since the Unix epoch when this model was created */
  createdAt: string;
}

export interface Model {
  /** The model's unique ID. */
  id: ResourceId;

  /** The number of seconds since the Unix epoch when this model was created */
  createdAt: Date;
}

export type Writable<T extends Model> = WritableExcluding<T, never>;
export type WritableExcluding<T extends Model, ReadOnly extends keyof T> = ConditionalExcept<
  Except<T, 'id' | 'createdAt' | ReadOnly>,
  (...args: any[]) => any
>;

export type Page<T = JsonValue> = {
  results: T[];
  nextPageToken: string;
};

export type PageParams = Partial<{
  pageSize: number;
  nextPageToken: string;
}>;
