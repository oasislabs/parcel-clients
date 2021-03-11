import Parcel, { IdentityId, Job, JobSpec, JobPhase } from '@oasislabs/parcel';
import fs from 'fs';

// #region snippet-configuration
const acmeId = '3f7d3ca9-85ca-6498-15d1-facebee979cb' as IdentityId;
const tokenSourceAcme = {
  clientId: '6589cf53-e825-3aca-5bc7-1d00d227c388',
  privateKey: {
    kid: 'example-client-1',
    use: 'sig',
    kty: 'EC',
    crv: 'P-256',
    alg: 'ES256',
    x: 'ej4slEdbZpwYG-4T-WfLHpMBWPf6FItNNGFEHsjdyK4',
    y: 'e4Q4ygapmkxku_olSuc-WhSJaWiNCvuPqIWaOV6P9pE',
    d: '_X2VJCigbOYXOq0ilXATJdh9c2DdaSzZlxXVV6yuCXg',
  },
} as const;

// In a real-world scenario, these credentials would typically be used in a completely separate script
// because no single entity has access to both Acme and Bob credentials.
// This example script, however, performs actions both as Acme and Bob so that the flow is easier to
// follow.
const tokenSourceBob = {
  clientId: '55579380-d771-38ef-bfd3-0305c52a9881',
  privateKey: {
    kid: 'example-client-2',
    kty: 'EC',
    alg: 'ES256',
    use: 'sig',
    crv: 'P-256',
    x: 'kbhoJYKyOgY645Y9t-Vewwhke9ZRfLh6_TBevIA6SnQ',
    y: 'SEu0xuCzTH95-q_-FSZc-P6hCSnq6qH00MQ52vOVVpA',
    d: '10sS7lgM_YWxf79x21mWalCkAcZZOmX0ZRE_YwEXcmc',
  },
} as const;
// #endregion snippet-configuration

// --- Upload data as Bob.
// #region snippet-input-datasets
const parcelBob = new Parcel(tokenSourceBob);
const bobId = (await parcelBob.getCurrentIdentity()).id;

// Upload a datasets and give Acme access to it.
console.log('Uploading input dataset as Bob.');
const recipeDataset = await parcelBob.uploadDataset(
  Buffer.from('14g butter; 15g chicken sausage; 18g feta; 20g green pepper; 1.5min baking'),
).finished;
await parcelBob.createGrant({
  grantee: acmeId,
  conditions: { 'dataset.id': { $eq: recipeDataset.id } },
});
// #endregion snippet-input-datasets

// --- Run compute job as Acme.
// #region snippet-job-request
// Define the job.
const jobSpec: JobSpec = {
  name: 'word-count',
  image: 'bash',
  inputDatasets: [{ mountPath: 'recipe.txt', id: recipeDataset.id }],
  outputDatasets: [{ mountPath: 'count.txt', owner: bobId }],
  cmd: [
    '-c',
    'echo "Dataset has $(wc -w </parcel/data/in/recipe.txt) words" >/parcel/data/out/count.txt',
  ],
};
// #endregion snippet-job-request

// #region snippet-job-submit-wait
// Submit the job.
console.log('Running the job as Acme.');
const parcelAcme = new Parcel(tokenSourceAcme);
const jobId = (await parcelAcme.submitJob(jobSpec)).id;

// Wait for job to finish.
let job: Job;
do {
  await new Promise((resolve) => setTimeout(resolve, 5000)); // eslint-disable-line no-promise-executor-return
  job = await parcelAcme.getJob(jobId);
  console.log(`Job status is ${JSON.stringify(job.status)}`);
} while (job.status.phase === JobPhase.PENDING || job.status.phase === JobPhase.RUNNING);

console.log(
  `Job ${jobId} completed with status ${job.status.phase} and ${job.status.outputDatasets.length} output dataset(s).`,
);
// #endregion snippet-job-submit-wait

// Obtain compute job output -- again as Bob, because the computation was confidential and Acme
// does not have access to the output data.
// #region snippet-job-output
console.log('Downloading output dataset as Bob.');
const download = parcelBob.downloadDataset(job.status.outputDatasets[0].id);
const saver = fs.createWriteStream(`/tmp/output_dataset`);
await download.pipeTo(saver);
const outputDataset = fs.readFileSync('/tmp/output_dataset', 'utf-8');
console.log(`Here's the computed result: "${outputDataset}"`);
// #endregion snippet-job-output
