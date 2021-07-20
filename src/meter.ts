import type { HttpClient } from './http';

/**
 * Filters for specifying the subset of API usage to utilize
 * when generating your metering report.
 */
export type GetUsageFilter = Partial<{
  after: Date;
  before: Date;
}>;

/**
 * Parameters for setting your (current) monthly usage quota.
 * This will carry on to subsequent months until you change it
 * again.
 */
export type QuotaUpdateParams = Partial<{
  apiCallsLimit: number;
  accessedBytesLimit: number;
  computeMsecLimit: number;
}>;

export type PODMeteringReport = Readonly<{
  createCount: number;
  readCount: number;
  writeCount: number;
  deleteCount: number;
  uploadCount: number;
  downloadCount: number;
  uploadSizeBytes: number;
  downloadSizeBytes: number;
  computeMsec: number;
}>;

/**
 * A metering report of your API usage.
 */
export class MeteringReport {
  public readonly createCount: number;
  public readonly readCount: number;
  public readonly writeCount: number;
  public readonly deleteCount: number;
  public readonly uploadCount: number;
  public readonly downloadCount: number;
  public readonly uploadSizeBytes: number;
  public readonly downloadSizeBytes: number;
  public readonly computeMsec: number;

  #client: HttpClient;

  public constructor(client: HttpClient, pod: PODMeteringReport) {
    this.#client = client;
    this.createCount = pod.createCount;
    this.readCount = pod.readCount;
    this.writeCount = pod.writeCount;
    this.deleteCount = pod.deleteCount;
    this.uploadCount = pod.uploadCount;
    this.downloadCount = pod.downloadCount;
    this.uploadSizeBytes = pod.uploadSizeBytes;
    this.downloadSizeBytes = pod.downloadSizeBytes;
    this.computeMsec = pod.computeMsec;
  }
}

export type PODMeteringQuota = Readonly<{
  apiCallsLimit: number;
  accessedBytesLimit: number;
  computeMsecLimit: number;
}>;

/**
 * Your monthly quota for API usage.
 */
export class MeteringQuota {
  public readonly apiCallsLimit: number;
  public readonly accessedBytesLimit: number;
  public readonly computeMsecLimit: number;

  #client: HttpClient;

  public constructor(client: HttpClient, pod: PODMeteringQuota) {
    this.#client = client;
    this.apiCallsLimit = pod.apiCallsLimit;
    this.accessedBytesLimit = pod.accessedBytesLimit;
    this.computeMsecLimit = pod.computeMsecLimit;
  }
}

const USAGE_EP = 'usage';
const QUOTA_EP = 'quota';

export namespace MeterImpl {
  export async function getUsage(
    client: HttpClient,
    filter?: GetUsageFilter,
  ): Promise<MeteringReport> {
    const pod = await client.get<PODMeteringReport>(USAGE_EP, filter);
    return new MeteringReport(client, pod);
  }

  export async function getQuota(client: HttpClient): Promise<MeteringQuota> {
    const pod = await client.get<PODMeteringQuota>(QUOTA_EP);
    return new MeteringQuota(client, pod);
  }

  export async function setQuota(
    client: HttpClient,
    params: QuotaUpdateParams,
  ): Promise<MeteringQuota> {
    const pod = await client.put<PODMeteringQuota>(QUOTA_EP, params);
    return new MeteringQuota(client, pod);
  }
}
