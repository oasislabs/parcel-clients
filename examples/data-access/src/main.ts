import Parcel, { IdentityId } from '@oasislabs/parcel';
import fs from 'fs';

const tokenSourceAcme = {
  principal: '0d9f279b-a5d8-7260-e090-ff1a7659ba3b' as IdentityId,
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
const tokenSourceBob = {
  principal: '6cc5defa-af04-512f-6aa3-c13f64d03a8b' as IdentityId,
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

async function main() {
  // #region snippet-identity-acme-connect
  // Connect to ACME's identity.
  const parcelAcme = new Parcel(tokenSourceAcme, {
    apiUrl: process.env.API_URL,
  });
  await parcelAcme.getCurrentIdentity();
  // #endregion snippet-identity-acme-connect

  // #region snippet-upload
  // Upload a dataset and assign ownership to Bob.
  const data = 'The weather will be sunny tomorrow and cloudy on Tuesday.';
  const datasetDetails = { title: 'Weather forecast summary', tags: ['weather_forecast'] };
  console.log(`Uploading data for Bob (owner ID: ${tokenSourceBob.principal as string})`);
  const dataset = await parcelAcme.uploadDataset(data, {
    details: datasetDetails,
    owner: tokenSourceBob.principal,
  }).finished;

  console.log(`Created dataset ${dataset.id as string} with owner ${dataset.owner as string}`);
  // #endregion snippet-upload

  // #region snippet-download-acme-error
  // We can't download data, if we are not granted to do so. Let's try to download it anyway.
  let download = parcelAcme.downloadDataset(dataset.id);
  let saver = fs.createWriteStream(`./bob_data_by_acme`);
  try {
    console.log(`Attempting to access Bob's data without permission...`);
    await download.pipeTo(saver);
  } catch (error: any) {
    console.log(`ACME was not able to access Bob's data (this was expected): ${error as string}`);
  }
  // #endregion snippet-download-acme-error

  // #region snippet-download-bob-success
  // Create Bob's parcel instance using his API access token.
  const parcelBob = new Parcel(tokenSourceBob, {
    apiUrl: process.env.API_URL,
  });
  await parcelBob.getCurrentIdentity();

  // Now let's try to download it again, this time as Bob.
  console.log(`Attempting to access Bob's data by Bob himself...`);
  download = parcelBob.downloadDataset(dataset.id);
  saver = fs.createWriteStream(`./bob_data_by_bob`);
  await download.pipeTo(saver);
  console.log(`Dataset ${dataset.id as string} has been downloaded to ./bob_data_by_bob`);

  const secretDataByBob = fs.readFileSync('./bob_data_by_bob', 'utf-8');
  console.log(`Here's the data: ${secretDataByBob}`);
  // #endregion snippet-download-bob-success

  // #region snippet-create-grant
  // Grant ACME access to Bob's data.
  const grant = await parcelBob.createGrant({
    grantee: tokenSourceAcme.principal,
    filter: { 'dataset.id': { $eq: dataset.id } },
  });
  console.log(
    `New grant ${grant.id as string} for dataset ${dataset.id as string} and grantee ${
      tokenSourceAcme.principal as string
    } has been created`,
  );
  // #endregion snippet-create-grant

  // #region snippet-download-acme-success
  // ACME is now allowed to download Bob's data.
  console.log(`Attempting to access Bob's data with granted permission...`);
  download = parcelAcme.downloadDataset(dataset.id);
  saver = fs.createWriteStream(`./bob_data_by_acme`);
  await download.pipeTo(saver);
  console.log(`Dataset ${dataset.id as string} has been downloaded to ./bob_data_by_acme`);

  const secretDataByAcme = fs.readFileSync('./bob_data_by_acme', 'utf-8');
  console.log(`Here's the data: ${secretDataByAcme}`);
  // #endregion snippet-download-acme-success
}

main()
  .then(() => console.log('All done!'))
  .catch((error) => {
    console.error(
      `Error in main(): ${
        ((error.response ? error.response.data.error : '') as string) || JSON.stringify(error)
      }`,
    );
    process.exitCode = 1;
  });
