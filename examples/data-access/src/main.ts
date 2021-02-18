import Parcel, { IdentityId } from '@oasislabs/parcel';
import fs from 'fs';

// #region snippet-config
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
// #endregion snippet-config

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
  const datasetDetails = { title: 'Weather forecast summary' };
  console.log(`Uploading data for Bob (owner ID: ${tokenSourceBob.principal})`);
  const dataset = await parcelAcme.uploadDataset(data, {
    details: datasetDetails,
    owner: tokenSourceBob.principal,
  }).finished;

  console.log(`Created dataset ${dataset.id} with owner ${dataset.owner}`);
  // #endregion snippet-upload

  // #region snippet-download-acme-error
  // We can't download data, if we are not granted to do so. Let's try to download it anyway.
  let download = parcelAcme.downloadDataset(dataset.id);
  let saver = fs.createWriteStream(`./bob_data_by_acme`);
  try {
    console.log(`Attempting to access Bob's dataset without permission...`);
    await download.pipeTo(saver);
  } catch (error: any) {
    console.log(`ACME was not able to access Bob's data (this was expected): ${error}`);
  }
  // #endregion snippet-download-acme-error

  console.log();

  // #region snippet-download-bob-success
  // Create Bob's parcel instance using his API access token.
  const parcelBob = new Parcel(tokenSourceBob, {
    apiUrl: process.env.API_URL,
  });
  await parcelBob.getCurrentIdentity();

  // Now let's try to download it again, this time as Bob.
  console.log(`Attempting to access Bob's dataset by Bob himself...`);
  download = parcelBob.downloadDataset(dataset.id);
  saver = fs.createWriteStream(`./bob_data_by_bob`);
  await download.pipeTo(saver);
  console.log(`Dataset ${dataset.id} has been downloaded to ./bob_data_by_bob`);

  const secretDataByBob = fs.readFileSync('./bob_data_by_bob', 'utf-8');
  console.log(`Here's the data: ${secretDataByBob}`);
  // #endregion snippet-download-bob-success

  console.log();

  // #region snippet-create-grant
  // Grant ACME access to Bob's data.
  const grant = await parcelBob.createGrant({
    grantee: tokenSourceAcme.principal,
    conditions: { 'dataset.id': { $eq: dataset.id } },
  });
  console.log(
    `New grant ${grant.id} for dataset ${dataset.id} and grantee ${tokenSourceAcme.principal} has been created`,
  );
  // #endregion snippet-create-grant

  // #region snippet-download-acme-success
  // ACME is now allowed to download Bob's data.
  console.log(`Attempting to access Bob's dataset with granted permission...`);
  download = parcelAcme.downloadDataset(dataset.id);
  saver = fs.createWriteStream(`./bob_data_by_acme`);
  await download.pipeTo(saver);
  console.log(`Dataset ${dataset.id} has been downloaded to ./bob_data_by_acme`);

  const secretDataByAcme = fs.readFileSync('./bob_data_by_acme', 'utf-8');
  console.log(`Here's the data: ${secretDataByAcme}`);
  // #endregion snippet-download-acme-success

  console.log();

  // #region snippet-upload-with-tags
  // Upload a dataset with a specific tag and assign ownership to Bob.
  const dataWithTags = 'Vreme bo jutri sončno, v torek pa oblačno.';
  const datasetDetailsWithTags = {
    title: 'Povzetek vremenske napovedi',
    tags: ['lang_sl'],
  };
  console.log(
    `Uploading data for Bob with ${datasetDetailsWithTags.tags} tags (owner ID: ${tokenSourceBob.principal})`,
  );
  const datasetWithTags = await parcelAcme.uploadDataset(dataWithTags, {
    details: datasetDetailsWithTags,
    owner: tokenSourceBob.principal,
  }).finished;

  console.log(
    `Created dataset ${datasetWithTags.id} with owner ${datasetWithTags.owner} and tags ${datasetWithTags.details.tags}`,
  );
  // #endregion snippet-upload-with-tags

  // #region snippet-create-grant-with-tags
  // Grant ACME access to any Bob's dataset containing tag 'lang:sl'.
  const grantWithTags = await parcelBob.createGrant({
    grantee: tokenSourceAcme.principal,
    conditions: { 'dataset.details.tags': { $any: { $eq: 'lang_sl' } } },
  });
  console.log(
    `New grant ${grantWithTags.id} for datasets with tags 'lang_sl' and grantee ${tokenSourceAcme.principal} has been created`,
  );
  // #endregion snippet-create-grant-with-tags

  // #region snippet-download-acme-success-with-tags
  // ACME is now allowed to download Bob's data.
  console.log(`Attempting to access Bob's dataset with tags-based grant...`);
  download = parcelAcme.downloadDataset(datasetWithTags.id);
  saver = fs.createWriteStream(`./bob_data_by_acme_with_tags`);
  await download.pipeTo(saver);
  console.log(`Dataset ${datasetWithTags.id} has been downloaded to ./bob_data_by_acme_with_tags`);

  const secretDataByAcmeWithTags = fs.readFileSync('./bob_data_by_acme_with_tags', 'utf-8');
  console.log(`Here's the data: ${secretDataByAcmeWithTags}`);
  // #endregion snippet-download-acme-success-with-tags
}

main()
  .then(() => console.log('All done!'))
  .catch((error) => {
    console.error(`Error in main(): ${error}`);
    process.exitCode = 1;
  });
