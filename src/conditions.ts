import type { Primitive } from 'type-fest';

import type { DocumentId as $DocumentId } from './document.js';
import type { IdentityId } from './identity.js';

export namespace Conditions {
  export type And = {
    $and: Conditions[];
  };
  export type Or = {
    $or: Conditions[];
  };
  export type Not = {
    $not: Conditions;
  };
  export type DocumentId = {
    'document.id': Comparison<$DocumentId>;
  };
  export type DocumentCreator = {
    'document.creator': Comparison<IdentityId>;
  };
  export type DocumentTags = {
    'document.details.tags': ArrayOp<string>;
  };
}
export type Conditions =
  | Conditions.Or
  | Conditions.And
  | Conditions.Not
  | Conditions.DocumentId
  | Conditions.DocumentCreator
  | Conditions.DocumentTags;

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
