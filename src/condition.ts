import type { Primitive } from 'type-fest';

import type {
  InputDocumentSpec as $InputDocumentSpec,
  OutputDocumentSpec as $OutputDatsetSpec,
} from './compute.js';
import type { DocumentId as $DocumentId } from './document.js';
import type { IdentityId as $IdentityId } from './identity.js';

// Selectors enabled by the conditions DSL.
export namespace Selectors {
  // Subject-based selectors.
  export type IdentityId = {
    'identity.id': RelationalOp<$IdentityId>;
  };
  // Resource-based selectors.
  export type DocumentId = {
    'document.id': RelationalOp<$DocumentId>;
  };
  export type DocumentCreator = {
    'document.creator': RelationalOp<$IdentityId>;
  };
  export type DocumentTitle = {
    'document.details.title': RelationalOp<string>;
  };
  export type DocumentTags = {
    'document.details.tags': ArrayOp<string>;
  };
  // Action-based selectors.
  export type JobImage = {
    'job.spec.image': RelationalOp<string>;
  };
  export type JobInputs = {
    'job.spec.inputs': RelationalOp<$InputDocumentSpec>;
  };
  export type JobOutputs = {
    'job.spec.outputs': RelationalOp<$OutputDatsetSpec>;
  };
  export type AccessTime = {
    access_time: number; // TODO: This should be a Date, but Date is not currently serializable as a JsonObject.
  };
  // Environment-based selectors.
  export type WorkerId = {
    'worker.id': RelationalOp<$IdentityId>;
  };
  export type WorkerVersion = {
    'worker.version': RelationalOp<string>;
  };
}
// A Selector is a leaf node in the boolean expression tree for a condition.
export type Selector =
  | Selectors.IdentityId
  | Selectors.DocumentId
  | Selectors.DocumentCreator
  | Selectors.DocumentTitle
  | Selectors.DocumentTags
  | Selectors.JobImage
  | Selectors.JobInputs
  | Selectors.JobOutputs
  | Selectors.AccessTime;

// Logical operators enabled by the conditions DSL.
export namespace LogicalOps {
  export type And = {
    $and: Condition[];
  };
  export type Or = {
    $or: Condition[];
  };
  export type Not = {
    $not: Condition;
  };
}
// A LogicalOp is an internal node in the boolean expression tree for a condition.
type LogicalOp = LogicalOps.And | LogicalOps.Or | LogicalOps.Not;

export type Condition = Selector | LogicalOp;

// Relational operators enabled by the conditions DSL.
export namespace RelationalOp {
  export type Eq<T = Primitive> = {
    $eq: T;
  };

  export type Neq<T = Primitive> = {
    $neq: T;
  };

  export type Geq<T = Comparable> = {
    $geq: T;
  };

  export type Gt<T = Comparable> = {
    $gt: T;
  };

  export type Leq<T = Comparable> = {
    $leq: T;
  };

  export type Lt<T = Comparable> = {
    $lt: T;
  };

  export type In<T = Primitive> = {
    $in: T[];
  };
}
type Comparable = number | Date;
type RelationalOp<T> =
  | RelationalOp.Eq<T>
  | RelationalOp.Neq<T>
  | RelationalOp.Geq<T>
  | RelationalOp.Gt<T>
  | RelationalOp.Leq<T>
  | RelationalOp.Lt<T>
  | RelationalOp.In<T>;

// Array operators enabled by the conditions DSL.
export namespace ArrayOps {
  export type Any<T = Primitive> = {
    $any: RelationalOp<T>;
  };

  export type All<T = Primitive> = {
    $all: RelationalOp<T>;
  };

  export type Len<T = Primitive> = {
    $len: RelationalOp<T>;
  };
}
type ArrayOp<T> = ArrayOps.Any<T> | ArrayOps.All<T> | ArrayOps.Len<T>;
