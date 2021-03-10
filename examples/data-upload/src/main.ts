import Parcel, { Dataset } from '@oasislabs/parcel';

import * as fs from 'fs';

// #region snippet-configuration
const apiCreds = {
  // Client ID
  clientId: '6589cf53-e825-3aca-5bc7-1d00d227c388',
  // Client key
  privateKey: {
    // Note: Make sure kid matches the one you added in portal.
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
// #endregion snippet-configuration

// #region snippet-connect
const parcel = new Parcel(apiCreds);
// #endregion snippet-connect

// #region snippet-dataset-upload
const data = 'Hello private world!';
const datasetDetails = { title: 'My first dataset', tags: ['greeting', 'english'] };
let dataset: Dataset;
try {
  dataset = await parcel.uploadDataset(data, { details: datasetDetails }).finished;
} catch (error: any) {
  console.error('Failed to upload dataset');
  throw error;
}

console.log(`Created dataset ${dataset.id} with title ${dataset.details.title}`);
// #endregion snippet-dataset-upload

// #region snippet-dataset-download
// Let's download the above dataset using its ID.
// By default, the dataset owner can download the data.
const download = parcel.downloadDataset(dataset.id);
const saver = fs.createWriteStream(`./user_data`);
try {
  await download.pipeTo(saver);
  console.log(`Dataset ${dataset.id} has been downloaded to ./user_data`);
} catch (error: any) {
  console.error(`Failed to download dataset ${dataset.id}`);
  throw error;
}

const secretData = fs.readFileSync('./user_data', 'utf-8');
console.log(`Hey dataset owner! Here's your data: ${secretData}\n`);
// #endregion snippet-dataset-download
