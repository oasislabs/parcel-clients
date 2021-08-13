import type { Primitive } from 'type-fest';

import type {
  InputDocumentSpec as $InputDocumentSpec,
  OutputDocumentSpec as $OutputDocumentSpec,
} from './compute.js';
import type { DatabaseId as $DatabaseId } from './database.js';
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
  export type DocumentOwner = {
    'document.owner': RelationalOp<$IdentityId>;
  };
  export type DocumentTitle = {
    'document.title': RelationalOp<string>;
  };
  export type DocumentTags = {
    'document.tags': SetOp<string>;
  };
  export type Document =
    | DocumentId
    | DocumentCreator
    | DocumentOwner
    | DocumentTitle
    | DocumentTags;

  export type DatabaseId = {
    'database.id': RelationalOp<$DatabaseId>;
  };
  export type DatabaseCreator = {
    'database.creator': RelationalOp<$IdentityId>;
  };
  export type DatabaseOwner = {
    'database.owner': RelationalOp<$IdentityId>;
  };
  export type DatabaseName = {
    'database.name': RelationalOp<string>;
  };
  export type Database = DatabaseId | DatabaseCreator | DatabaseOwner | DatabaseName;

  // Action-based selectors.
  export type JobImage = {
    'job.spec.image': RelationalOp<string>;
  };
  export type JobInputs = {
    'job.spec.inputs': RelationalOp<$InputDocumentSpec>;
  };
  export type JobOutputs = {
    'job.spec.outputs': RelationalOp<$OutputDocumentSpec>;
  };
  export type Job = JobImage | JobInputs | JobOutputs;

  export type AccessTime = {
    accessTime: RelationalOp<string>; // TODO: This should be a Date, but Date is not currently serializable as a JsonObject.
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
  | Selectors.Database
  | Selectors.Document
  | Selectors.Job
  | Selectors.AccessTime;

// Logical operators enabled by the conditions DSL.
export namespace LogicalOps {
  export type And = {
    $and: Condition[];
  };
  export type Or = {
    $or: Condition[];
  };
  export type Nor = {
    $nor: Condition[];
  };
  export type Not = {
    $not: Condition;
  };
}
// A LogicalOp is an internal node in the boolean expression tree for a condition.
export type LogicalOp = LogicalOps.And | LogicalOps.Or | LogicalOps.Nor | LogicalOps.Not;

export type Condition = Selector | LogicalOp;

// Relational operators enabled by the conditions DSL.
export namespace RelationalOp {
  export type Eq<T = Primitive> = {
    $eq: T;
  };

  export type Neq<T = Primitive> = {
    $ne: T;
  };

  export type Geq<T = Comparable> = {
    $gte: T;
  };

  export type Gt<T = Comparable> = {
    $gt: T;
  };

  export type Leq<T = Comparable> = {
    $lte: T;
  };

  export type Lt<T = Comparable> = {
    $lt: T;
  };

  export type In<T = Primitive> = {
    $in: T[];
  };

  export type Nin<T = Primitive> = {
    $nin: T[];
  };
}
type Comparable = number | Date;
// eslint-disable-next-line @typescript-eslint/no-redeclare
type RelationalOp<T> =
  | RelationalOp.Eq<T>
  | RelationalOp.Neq<T>
  | RelationalOp.Geq<T>
  | RelationalOp.Gt<T>
  | RelationalOp.Leq<T>
  | RelationalOp.Lt<T>
  | RelationalOp.In<T>
  | RelationalOp.Nin<T>;

export namespace ArrayOps {
  export type Any<T = Primitive> = {
    $any: RelationalOp<T>;
  };

  export type All<T = Primitive> = {
    $all: RelationalOp<T>;
  };

  export type Len<T = Primitive> = {
    $size: RelationalOp<T>;
  };
}
export type ArrayOp<T> = ArrayOps.Any<T> | ArrayOps.All<T> | ArrayOps.Len<T>;

export namespace SetOps {
  export type Contains<T = Primitive> = {
    $contains: T;
  };

  export type Intersects<T = Primitive> = {
    $intersects: T[];
  };

  export type Superset<T = Primitive> = {
    $superset: T[];
  };

  export type Subset<T = Primitive> = {
    $subset: T[];
  };

  export type Values<T = Primitive> = {
    $values: ArrayOp<T>;
  };

  export type Len<T = Primitive> = {
    $size: RelationalOp<T>;
  };
}
export type SetOp<T> =
  | SetOps.Contains<T>
  | SetOps.Intersects<T>
  | SetOps.Superset<T>
  | SetOps.Subset<T>
  | SetOps.Values<T>
  | SetOps.Len<T>;
