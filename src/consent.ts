import type { Opaque, RequireAtLeastOne } from 'type-fest';

import type { Client } from './client';
import type { Constraints } from './filter';
import type { IdentityId } from './identity';
import type { Model, PODModel, ResourceId } from './model';

export type ConsentId = Opaque<ResourceId>;

export type PODConsent = PODModel & ConsentCreateParams;

export type ConsentCreateParams = {
    /** The Grants to make when the App containing this Consent is joined. */
    grants: GrantSpec[];

    /** Whether this Consent is automatically accepted when joining an App. */
    required?: boolean;
};

export interface Consent extends Model {
    id: ConsentId;

    /** The Grants to make when the App containing this Consent is joined. */
    grants: GrantSpec[];

    /** Whether this Consent is automatically accepted when joining an App. */
    required: boolean;
}

export class ConsentImpl implements Consent {
    public id: ConsentId;
    public createTimestamp: number;
    public grants: GrantSpec[];
    public required: boolean;

    public constructor(private readonly client: Client, pod: PODConsent) {
        this.id = pod.id as ConsentId;
        this.createTimestamp = pod.createTimestamp;
        this.grants = pod.grants;
        this.required = pod.required ?? false;
    }
}

export type GrantSpec = {
    /** The symbolic granter. */
    granter: GranterRef;

    /** The symbolic grantee */
    grantee?: GranteeRef;

    /** The Grant's filter. @see `Grant.filter`. */
    filter?: Constraints;
};

/** `app` represents the app, `participant` represents the joining identity. */
export type GranterRef = 'app' | 'participant';

/**
 * A `ResourceId` causes the grant to be made to a specific Identity,
 * `app` grants to the app, `participant` grants to the joining identity, and
 * `everyone` refers to, well, everyone.
 */
export type GranteeRef = 'app' | 'participant' | 'everyone' | IdentityId;

export type ConsentUpdateParams = RequireAtLeastOne<{
    granted: ConsentId[];
    revoked: ConsentId[];
}>;
