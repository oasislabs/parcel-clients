import Parcel, { Job, JobSpec, JobPhase } from '@oasislabs/parcel';
import fs from 'fs';

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

console.log('Here we go...');
// #region snippet-config
const parcelAcme = new Parcel(tokenSourceAcme);
const acmeId = (await parcelAcme.getCurrentIdentity()).id;
// #endregion snippet-config

// Set up the datasets
// #region snippet-input-datasets
const skinDataset = await parcelAcme.uploadDataset(
  await fs.promises.readFile('docker/test_workdir/data/in/basal_cell_carcinoma_example.jpg'),
  { details: { title: 'User-provided skin image' } },
).finished;
// #endregion snippet-input-datasets
console.log('Datasets uploaded.');

// Submit the job.
// #region snippet-submit-job
const jobSpec: JobSpec = {
  name: 'word-count',
  image: 'oasislabs/acme-derma-demo',
  inputDatasets: [{ mountPath: 'skin.jpg', id: skinDataset.id }],
  outputDatasets: [{ mountPath: 'prediction.txt', owner: acmeId }],
  cmd: ['python', 'predict.py', '/parcel/data/in/skin.jpg', '/parcel/data/out/prediction.txt'],
};
const jobId = (await parcelAcme.submitJob(jobSpec)).id;
// #endregion snippet-submit-job
console.log(`Job ${jobId} submitted.`);

// Wait for job completion.
let job: Job;
do {
  await new Promise((resolve) => setTimeout(resolve, 5000)); // eslint-disable-line no-promise-executor-return
  job = await parcelAcme.getJob(jobId);
  console.log(`Job status is ${JSON.stringify(job.status)}`);
} while (job.status.phase === JobPhase.PENDING || job.status.phase === JobPhase.RUNNING);
