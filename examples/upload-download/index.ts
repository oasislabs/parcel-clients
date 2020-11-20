/// <reference types="@types/parcel-env" />

declare global {
    interface Window {
        setApiCredentials: () => Promise<void>;
        uploadDataset: () => Promise<void>;
        downloadDataset: (id: string) => Promise<void>;
        listUploadedDatasets: () => Promise<void>;
    }
}

import Parcel, { DatasetId } from '../../src';
import streamSaver from 'streamsaver';
import { WritableStream } from 'web-streams-polyfill/ponyfill/es2018';

import fixtureJWK from '../../../../../runtime/test/fixtures/test_identity_creds.json';

streamSaver.WritableStream = WritableStream;

if (module.hot) module.hot.accept();

const $ = <T extends Element = Element>(selector: string) => {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`\`${selector}\` did not match any elements`);
    return element;
};

const apiCreds: HTMLTextAreaElement = $('#api-creds');
const setupErrorSpan = $('#setup-error');
const datasetPicker: HTMLInputElement = $('#dataset-picker');
const datasetName: HTMLInputElement = $('#dataset-name');
const datasetsList = $('#uploaded-datasets');

apiCreds.value = JSON.stringify(fixtureJWK, null, 4);

let parcel: Parcel;

// Resets API Credentials modal on hotreload
document.body.setAttribute('pre-auth', 'pre-auth');

window.setApiCredentials = async function () {
    setupErrorSpan.classList.remove('visible');

    const creds = apiCreds.value;
    const tokenSource = await (async () => JSON.parse(creds))().catch(() => creds);

    try {
        parcel = new Parcel(tokenSource, {
            apiUrl: 'http://localhost:4242/v1',
        });
        await parcel.getCurrentIdentity();
        document.body.removeAttribute('pre-auth');
        void window.listUploadedDatasets();
    } catch (error) {
        console.error(error);
        setupErrorSpan.textContent = error.toString();
        setupErrorSpan.classList.add('visible');
    }
};

window.uploadDataset = async function () {
    const datasetFile = datasetPicker.files![0];
    const dataset = await parcel.uploadDataset(datasetFile, {
        metadata: { name: datasetName.value },
    }).finished;
    addDatasetToList(dataset.id, dataset.metadata?.name as string | undefined);
};

window.downloadDataset = async function (id: string) {
    const download = parcel.downloadDataset(id as DatasetId);
    const saver = streamSaver.createWriteStream(`dataset-${id}`);
    await download.pipeTo(saver);
};

window.listUploadedDatasets = async function () {
    if (!parcel) return;
    const uploadedDatasets = (
        await parcel.listDatasets({
            creator: (await parcel.getCurrentIdentity()).id,
        })
    ).results;

    while (datasetsList.lastChild) datasetsList.lastChild.remove();
    uploadedDatasets.forEach((d) => addDatasetToList(d.id, d.metadata?.name as string | undefined));
};

function addDatasetToList(id: string, name?: string) {
    const datasetItem = document.createElement('li');
    const datasetLink = document.createElement('a');

    datasetLink.href = `javascript:downloadDataset('${id}')`;
    datasetLink.textContent = `${name ?? 'Untitled'} (${id})`;

    datasetItem.append(datasetLink);
    datasetsList.append(datasetItem);
}

// $('#api-creds-modal form').submit(); // For debugging: auto-login
