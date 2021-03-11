import Parcel, { Job, JobSpec, JobPhase } from '@oasislabs/parcel';
import fs from 'fs';

const tokenSourceAcme = {
  clientId: 'C92EAFfH67w4bGkVMjihvkQ',
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
  scopes: ['parcel.*'] as string[],
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
