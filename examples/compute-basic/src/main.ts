import Parcel, { IdentityId, Job, JobSpec, JobPhase } from '@oasislabs/parcel';
import fs from 'fs';

// #region snippet-configuration
const tokenSourceAcme = {
  principal: '0d9f279b-a5d8-7260-e090-ff1a7659ba3b',
  privateKey: {
    kty: 'EC',
    alg: 'ES256',
    use: 'sig',
    crv: 'P-256',
    kid: 'DcI1bh_7WW9YujsR3h7dik2rQmYNQPSB3dXV-AJsxgc',
    x: 'v8c_cPZJndQLe51QhGApDPhT4C6OqteK3e0Ttd1CbxE',
    y: 'Cbvi7oyrCfX5iDPiFUiJPtpiGbypB5UoxJviXtBXfNQ',
    d: '9ssmJBm_mDIKpxdB2He-zIMeclYtDGQcBv2glEH7r5k',
  },
} as const;

// In a real-world scenario, these credentials would typically be used in a completely separate script
// because no single entity has access to both Acme and Bob credentials.
// This example script, however, performs actions both as Acme and Bob so that the flow is easier to
// follow.
const tokenSourceBob = {
  principal: '6cc5defa-af04-512f-6aa3-c13f64d03a8b',
  privateKey: {
    kty: 'EC',
    alg: 'ES256',
    use: 'sig',
    crv: 'P-256',
    kid: 'EA8OhUgQBJ4GNO7hwhr3JiG6L-oKqPqYA_2ZctSBtAw',
    x: 'L3u92SCDDcsbLpFI2NUmwWtu4Xit26y2lUt8w3Da6g8',
    y: '857gZPxQiiO3mRSKuK8-42_QG65Q1HVzU__h8n7hLeQ',
    d: 'gXQmoXWOQvh8X4fM0d9b5aVYro3jhCkx0svuez9yMhk',
  },
} as const;
// #endregion snippet-configuration

// --- Upload data as Bob.
// #region snippet-input-datasets
const parcelBob = new Parcel(tokenSourceBob, { apiUrl: process.env.API_URL });
const bobId = (await parcelBob.getCurrentIdentity()).id;

// Upload a datasets and give Acme access to it.
console.log('Uploading input dataset as Bob.');
const recipeDataset = await parcelBob.uploadDataset(
  Buffer.from('14g butter; 15g chicken sausage; 18g feta; 20g green pepper; 1.5min baking'),
).finished;
await parcelBob.createGrant({
  grantee: tokenSourceAcme.principal as IdentityId,
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
const parcelAcme = new Parcel(tokenSourceAcme, { apiUrl: process.env.API_URL });
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
