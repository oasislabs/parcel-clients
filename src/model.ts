import type { JsonValue } from 'type-fest';

export type ResourceId = string; // Format from runtime: `<resource>-<id>`

export interface PODModel {
    /** An undifferentiated model identifier. */
    id: ResourceId;

    /** The number of seconds since the Unix epoch when this model was created */
    createdAt: string;
}

export interface Model {
    /** The number of seconds since the Unix epoch when this model was created */
    createdAt: Date;
}

export type Page<T = JsonValue> = {
    results: T[];
    nextPageToken: string;
};

export type PageParams = Partial<{
    pageSize: number;
    nextPageToken: string;
}>;
