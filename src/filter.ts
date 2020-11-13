import type { Primitive } from 'type-fest';

import type { DatasetId } from './dataset';
import type { IdentityId } from './identity';

export namespace Constraints {
    export type And = {
        $and: Constraints[];
    };
    export type Or = {
        $or: Constraints[];
    };
    export type Not = {
        $not: Constraints;
    };
    export type DatasetId = {
        'dataset.id': Comparison<DatasetId>;
    };
    export type DatasetCreator = {
        'dataset.creator': Comparison<IdentityId>;
    };
    export type DatasetTags = {
        'dataset.metadata.tags': ArrayOp<string>;
    };
}
export type Constraints =
    | Constraints.Or
    | Constraints.And
    | Constraints.Not
    | Constraints.DatasetId
    | Constraints.DatasetCreator
    | Constraints.DatasetTags;

export namespace Comparison {
    export type In<T = Primitive> = {
        $in: T[];
    };

    export type Eq<T = Primitive> = {
        $eq: T;
    };

    export type Not<T = Primitive> = {
        $not: Comparison<T>;
    };
}
type Comparison<T> = Comparison.In<T> | Comparison.Eq<T> | Comparison.Not<T>;

export namespace ArrayOp {
    export type Any<T = Primitive> = {
        $any: Comparison<T>;
    };

    export type All<T = Primitive> = {
        $all: T[];
    };
}
type ArrayOp<T> = ArrayOp.Any<T> | ArrayOp.All<T>;
