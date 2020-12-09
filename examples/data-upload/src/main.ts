//import * as Parcel from '@oasislabs/parcel-sdk';
import Parcel, { DatasetId } from '../../../src'; // TODO
import streamSaver from 'streamsaver';

async function main() {
    const JWKcreds = `{
        "principal": "0d9f279b-a5d8-7260-e090-ff1a7659ba3b",
        "privateKey": {
            "kty": "EC",
            "alg": "ES256",
            "use": "sig",
            "crv": "P-256",
            "kid": "DcI1bh_7WW9YujsR3h7dik2rQmYNQPSB3dXV-AJsxgc",
            "x": "v8c_cPZJndQLe51QhGApDPhT4C6OqteK3e0Ttd1CbxE",
            "y": "Cbvi7oyrCfX5iDPiFUiJPtpiGbypB5UoxJviXtBXfNQ",
            "d": "9ssmJBm_mDIKpxdB2He-zIMeclYtDGQcBv2glEH7r5k"
        }
    }`;
    const tokenSource = await (async () => JSON.parse(JWKcreds))().catch(() => JWKcreds);
    let parcel: Parcel;
    try {
        parcel = new Parcel(tokenSource, {
            apiUrl: process.env.API_URL,
        });
        await parcel.getCurrentIdentity();
    } catch (error) {
        console.error(error);
    }

    // #region snippet-dataset-upload
    const data = new TextEncoder().encode('hooray!');
    const datasetMetadata = { name: 'My First Dataset', tags: ["greeting", "english"]};
    const dataset = await parcel.uploadDataset(data, { metadata: datasetMetadata }).finished;
    console.log(
        `Created dataset ${dataset.id} named ${dataset.metadata.name}`,
    );
    const id = dataset.id as string;
    // #endregion snippet-dataset-upload

    // #region snippet-dataset-download
    // By default, the dataset owner can download the data.
    const download = parcel.downloadDataset(id as DatasetId);
    const saver = streamSaver.createWriteStream(`./user_data`);
    try {
        await download.pipeTo(saver);
        console.log(`Dataset ${id} has been downloaded to ./user_data`);
    } catch (e) {
        throw new Error(`Failed to download dataset ${id}`);
    }
    const secretData = require('fs').readFileSync('./user_data').toString();
    console.log(`Hey dataset owner! Here's your data: ${secretData}\n`);
    // #endregion snippet-dataset-download
}

main()
    .then(() => console.log('All done!'))
    .catch((err) => {
        console.log(`Error in main(): ${err.stack || JSON.stringify(err)}`);
        process.exitCode = 1;
    });
