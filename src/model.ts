export type POD = string | number | boolean | null | undefined | POD[] | { [key: string]: POD };

export type ResourceId = string; // Format from runtime: `<resource>-<id>`

export interface PODModel {
    /** An undifferentiated model identifier. */
    id: ResourceId;

    /** The number of seconds since the Unix epoch when this model was created */
    createTimestamp: number;
}

export interface Model {
    /** The number of seconds since the Unix epoch when this model was created */
    createTimestamp: number;
}

export type Page<T = POD> = {
    results: T[];
    nextPageToken: string;
};

export type PageParams = {
    pageSize?: number;
    pageToken?: string;
};

/**
 * A type that requires at least one property of the inner type to be set.
 * source: https://stackoverflow.com/questions/48230773
 */
export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];

/**
 * Returns whether the provided object contains values that will cause the server to update
 * the requested model. This is useful for short-circuiting noop updates by replacing them with
 * a simple `get`.
 * Specifically, this function returns `false` iff the input is an empty array, object,
 * or object containing only empty values.
 */
export function containsUpdate(object: POD): boolean {
    if (typeof object === 'undefined') {
        return false;
    }

    if (object === null) {
        return true;
    } // Explicit `null` is allowed

    if (typeof object === 'boolean') {
        return true;
    } // Explicit `false` is allowed

    if (typeof object === 'number') {
        return true;
    }

    if (typeof object === 'string') {
        return true;
    }

    if (Array.isArray(object)) {
        return object.length > 0;
    }

    for (const v of Object.values(object)) {
        if (containsUpdate(v)) {
            return true;
        }
    }

    return false;
}
