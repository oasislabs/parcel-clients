import type { JsonValue } from 'type-fest';

export type ResourceId = string; // Format from runtime: `<resource>-<id>`

export interface PODModel {
    /** An undifferentiated model identifier. */
    id: ResourceId;

    /** The number of seconds since the Unix epoch when this model was created */
    createdAt: number;
}

export interface Model {
    /** The number of seconds since the Unix epoch when this model was created */
    createdAt: number;
}

export type Page<T = JsonValue> = {
    results: T[];
    nextPageToken: string;
};

export type PageParams = Partial<{
    pageSize: number;
    nextPageToken: string;
}>;

/**
 * Returns whether the provided updateParams contains values that will cause the server to update
 * the requested model. This is useful for short-circuiting noop updates by replacing them with
 * a simple `get`.
 * Specifically, this function returns `false` iff the input is an empty array, updateParams,
 * or updateParams containing only empty values.
 */
export function containsUpdate(updateParams?: JsonValue): boolean {
    if (updateParams === undefined) return false;
    if (updateParams === null) return true;

    if (['boolean', 'number', 'string'].includes(typeof updateParams)) return true;

    if (Array.isArray(updateParams)) return updateParams.length > 0;

    for (const v of Object.values(updateParams)) {
        if (containsUpdate(v)) return true;
    }

    return false;
}
