import Parcel, { Dataset } from '@oasislabs/parcel';
import * as fs from 'fs';

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

async function main() {
  const parcel = new Parcel(tokenSource, {
    apiUrl: process.env.API_URL,
  });
  await parcel.getCurrentIdentity();

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

  console.log(
    `Created dataset ${dataset.id as string} with title ${dataset.details.title as string}`,
  );
  // #endregion snippet-dataset-upload

  // #region snippet-dataset-download
  // Let's download the above dataset using its ID.
  const id = dataset.id;

  // By default, the dataset owner can download the data.
  const download = parcel.downloadDataset(id);
  const saver = fs.createWriteStream(`./user_data`);
  try {
    await download.pipeTo(saver);
    console.log(`Dataset ${id as string} has been downloaded to ./user_data`);
  } catch (error: any) {
    console.error(`Failed to download dataset ${id as string}`);
    throw error;
  }

  const secretData = fs.readFileSync('./user_data', 'utf-8');
  console.log(`Hey dataset owner! Here's your data: ${secretData}\n`);
  // #endregion snippet-dataset-download
}

main()
  .then(() => console.log('All done!'))
  .catch((error) => {
    console.error(`Error in main(): ${(error.stack as string) || JSON.stringify(error)}`);
    process.exitCode = 1;
  });
