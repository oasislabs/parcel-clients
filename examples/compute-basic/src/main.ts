import Parcel, { Job, JobSpec, JobPhase } from '@oasislabs/parcel';
import fs from 'fs';

// #region snippet-configuration
const tokenSource = {
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
// #endregion snippet-configuration

// #region snippet-input-datasets
const parcel = new Parcel(tokenSource, {
  apiUrl: process.env.API_URL,
});
const myId = (await parcel.getCurrentIdentity()).id;

// Set up datasets.
const recipeDataset = await parcel.uploadDataset(
  Buffer.from('14g butter;  15g chicken sausage; 18g feta; 20g green pepper; 1.5min baking'),
).finished;
// #endregion snippet-input-datasets

// #region snippet-job-request
// Start job.
const jobSpec: JobSpec = {
  name: 'checksum',
  image: 'alpine',
  cmd: ['sh', '-c', 'sha256sum /parcel/data/in/recipe.txt >/parcel/data/out/hash.txt'],
  inputDatasets: [{ mountPath: 'recipe.txt', id: recipeDataset.id }],
  outputDatasets: [{ mountPath: 'hash.txt', owner: myId }],
};
// #endregion snippet-job-request

// #region snippet-job-submit-wait
// Submit the job
const jobId = (await parcel.submitJob(jobSpec)).id;

// Wait for job to finish.
let job: Job;
while (true) {
  console.log(`Getting job ${jobId} ...`);
  job = await parcel.getJob(jobId);
  console.log(`Job status is ${JSON.stringify(job.status)}`);
  if (job.status.phase !== JobPhase.PENDING && job.status.phase !== JobPhase.RUNNING) {
    console.log(
      `Job ${jobId} finished with status ${job.status.phase} and ${job.status.outputDatasets.length} output dataset(s).`,
    );
    break;
  }

  await new Promise((resolve) => setTimeout(resolve, 500)); // eslint-disable-line no-promise-executor-return
}
// #endregion snippet-job-submit-wait

// #region snippet-job-output
// Obtain compute job output.
const download = parcel.downloadDataset(job.status.outputDatasets[0].id);
const saver = fs.createWriteStream(`./output_dataset`);
await download.pipeTo(saver);
const outputDataset = fs.readFileSync('./output_dataset', 'utf-8');
console.log(`Here's the computed data: ${outputDataset}`);
// #endregion snippet-job-output
