import Parcel, { Dataset } from '@oasislabs/parcel';
import * as fs from 'fs';

// #region snippet-configuration
const apiCreds = {
  // Client ID
  principal: '0d9f279b-a5d8-7260-e090-ff1a7659ba3b',
  // Client key
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

// #region snippet-connect
const parcel = new Parcel(apiCreds, {
  apiUrl: process.env.API_URL,
});
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
