import type { JsonObject, Opaque } from 'type-fest';

import type { DatasetId } from './dataset';
import type { HttpClient } from './http';
import type { IdentityId } from './identity';
import type { Page, PageParams } from './model';

export type JobId = Opaque<string, 'JobId'>;

/**
 * A specification/manifest for the job. This is a complete description of what
 * and how the job should run.
 */
export type JobSpec = JsonObject & {
  /**
   * A human-readable name for the job. Intended to help with monitoring and
   * debugging. The name SHOULD be unique among jobs submitted by the same
   * user. */
  name: string;

  /**
   * The command-line arguments to the command that should be run to start the
   * job. This corresponds to `CMD` in Docker terminology; note that images
   * running on Parcel are required to have a non-empty `ENTRYPOINT`, so the
   * actual command that runs will be the
   * [concatenation](https://docs.docker.com/engine/reference/builder/#understand-how-cmd-and-entrypoint-interact)
   * of `ENTRYPOINT` and this field.
   */
  cmd: string[];

  /**
   * The name of the docker image to use, optionally prefixed with an image
   * repository hostname. See [docker
   * pull](https://docs.docker.com/engine/reference/commandline/pull/)
   * documentation for a full description of allowable formats.
   */
  image: string;

  /**
   * Environment variables to use when running the image. Setting `PATH` is
   * not allowed.
   */
  env?: Record<string, string>;
  inputDatasets?: Array<{
    mountPath: string;
    id: DatasetId;
  }>;
  outputDatasets?: Array<{
    mountPath: string;
    owner?: IdentityId;
  }>;
};

export type JobStatus = {
  phase: JobPhase;
  /**
   * A human readable message indicating details about why the pod is in this
   * condition.
   */
  message?: string;

  /**
   * A reference to the worker hosting (running) this job, if any. This field
   * is intended for human reference/debugging only for now, so no semantics
   * are prescribed for the endpoint at the `host` address.
   */
  host: string | null;
};

export enum JobPhase {
  PENDING = 'Pending',
  RUNNING = 'Running',
  SUCCEEDED = 'Succeeded',
  FAILED = 'Failed',
}

export type PODJob = JsonObject & {
  readonly id: JobId;
  readonly spec: JobSpec;

  /**
   * Most recently observed status of the pod. This data may not be up to
   * date. The data type is a mostly subset of [Kubernetes'
   * PodStatus](https://www.k8sref.io/docs/workloads/pod-v1/#podstatus).
   */
  readonly status: JobStatus;
};

/**
 * An existing, already-submitted job. The job might also be already completed.
 */
export class Job {
  public readonly id: JobId;
  public readonly spec: JobSpec;
  public readonly status: JobStatus;

  public constructor(pod: PODJob) {
    this.id = pod.id;
    this.spec = pod.spec;
    this.status = pod.status;
  }
}

const ENDPOINTS = {
  jobs: '/compute/jobs',
  forJobId: (id: string) => `/compute/jobs/${id}`,
};

export namespace ComputeImpl {
  export async function submitJob(client: HttpClient, spec: JobSpec): Promise<Job> {
    return client.post<PODJob>(ENDPOINTS.jobs, spec).then((pod) => new Job(pod));
  }

  export async function listJobs(client: HttpClient, filter: PageParams = {}): Promise<Page<Job>> {
    return client.get<Page<PODJob>>(ENDPOINTS.jobs, filter).then((podPage) => ({
      results: podPage.results.map((podJob) => new Job(podJob)),
      nextPageToken: podPage.nextPageToken,
    }));
  }

  export async function getJob(client: HttpClient, jobId: JobId): Promise<Job> {
    return client.get<PODJob>(ENDPOINTS.forJobId(jobId)).then((pod) => new Job(pod));
  }

  export async function terminateJob(client: HttpClient, jobId: JobId): Promise<void> {
    return client.delete(ENDPOINTS.forJobId(jobId));
  }
}
