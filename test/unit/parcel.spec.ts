import { execSync } from 'child_process';

import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv from 'ajv';
import nock from 'nock';
import { paramCase } from 'param-case';
import { Writable } from 'readable-stream';
import type { JsonObject } from 'type-fest';
import * as uuid from 'uuid';

import Parcel from '@oasislabs/parcel';
import type { AppId, AppUpdateParams, PODApp } from '@oasislabs/parcel/app';
import type { ConsentId, PODConsent } from '@oasislabs/parcel/consent';
import type { DatasetId, PODDataset } from '@oasislabs/parcel/dataset';
import type { GrantId, PODGrant } from '@oasislabs/parcel/grant';
import type { IdentityId, PODIdentity } from '@oasislabs/parcel/identity';
import type { Page, PODModel } from '@oasislabs/parcel/model';

const API_BASE_URL = 'https://api.oasislabs.com/parcel/v1';
function nockIt(testName: string, test: (scope: nock.Scope) => Promise<void>): void {
    it(testName, async () => {
        const scope = nock(API_BASE_URL)
            .defaultReplyHeaders({
                'content-type': 'application/json',
            })
            .replyContentLength()
            .matchHeader(
                'authorization',
                /^Bearer [\w-=]+\.[\w-=]+\.?[\w-.+/=]*$/, // JWT regex
            );
        await test(scope);
        scope.done();
    });
}

function clone<T = JsonObject>(object: T): T {
    return JSON.parse(JSON.stringify(object));
}

declare global {
    namespace jest {
        interface Matchers<R> {
            toMatchSchema: (schema: string | JsonObject) => CustomMatcherResult;
        }
    }
}

const API_KEY = {
    kty: 'EC',
    d: '0fI_f6qv9MPkzvDged2YYEgYz9q1zTcHoNJl_vhLyeM',
    use: 'sig',
    crv: 'P-256',
    kid: '6-j7iM2OHHqu1HoulfQFcCSPAl_ghWa0abUv4Nl9GGk',
    x: 'C4GWlEeWvEQLtyvwndZzaHcKEfuZSZrQ2jikoH55EHU',
    y: 'xNSJVFo7gewNmv-7aKZUkZdjn0fVi25XQi1pxYGZpWU',
    alg: 'ES256',
} as const;

const API_TOKEN =
    'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJwYXJjZWwiLCJpc3MiOiJhdXRoLm9hc2lzbGFicy5jb20ifQ.foQOs-KXhOP6Vlwfs1sYqW1whbG-QW29Ex4Xa_mNNXaT4T2xtCwghhYGurkVUYSlo4cRxoaQYKo_foC2KysaDQ';

describe('Parcel', () => {
    let openapiSchema: any;
    let ajv: Ajv.Ajv;

    let parcel: Parcel;

    beforeAll(async () => {
        const repoRoot = execSync('git rev-parse --show-toplevel').toString().trim();
        openapiSchema = await SwaggerParser.validate(repoRoot + '/gateway/api/v1/parcel.yaml');

        ajv = new Ajv({
            formats: {
                timestamp: (t: any) => typeof t === 'number' && t >= 0 && t <= 18446744073709552000,
                'RGB hex': /^#[\da-f]{6}$/i,
                binary: (b: any) => Buffer.isBuffer(b) || b.constructor.name === 'Uint8Array',
                int32: Number.isInteger,
            },
        });
        Object.entries(openapiSchema.components.schemas).forEach(
            ([name, schema]: [string, any]) => {
                ajv.addSchema(schema, name);
            },
        );

        expect.extend({
            toMatchSchema(
                received: any,
                schema: string | JsonObject,
            ): { message: () => string; pass: boolean } {
                let validator: Ajv.ValidateFunction;
                if (typeof schema === 'string') {
                    const schemaValidator = ajv.getSchema(schema);
                    if (!schemaValidator) {
                        return {
                            pass: false,
                            message: () => `unknown schema: \`${schema}\``,
                        };
                    }

                    validator = schemaValidator;
                } else if (schema) {
                    validator = ajv.compile(schema);
                } else {
                    return {
                        pass: false,
                        message: () => 'no schema passed to `toMatchSchema`',
                    };
                }

                const valid = validator(received) as boolean;
                return {
                    pass: valid,
                    message: () =>
                        `error ${JSON.stringify(validator.errors)} in schema ${JSON.stringify(
                            validator.schema,
                        )}`,
                };
            },
        });
    });

    type HttpVerb = 'GET' | 'POST' | 'PATCH' | 'DELETE';

    function getRequestSchema(method: HttpVerb, endpoint: string): JsonObject {
        let schema =
            openapiSchema.paths[endpoint][method.toLowerCase()].requestBody.content[
                'application/json'
            ].schema;
        if (schema.allOf) schema = mergeAllOf(schema.allOf);
        schema.additionalProperties = false;
        ajv.validateSchema(schema);
        expect(ajv.errors).toBeNull();
        return schema;
    }

    function getQueryParametersSchema(method: HttpVerb, endpoint: string): JsonObject {
        const params = openapiSchema.paths[endpoint][method.toLowerCase()].parameters.filter(
            (p: { in: string }) => p.in === 'query',
        );
        if (params.length > 1)
            return mergeAllOf(params.map((p: { schema: JsonObject }) => p.schema));
        return params[0].schema;
    }

    type Schema = { type: 'object'; required: string[]; properties: JsonObject; allOf?: Schema[] };
    function mergeAllOf(allOfs: Schema[]): Schema {
        const mergedRequires: Set<string> = new Set();
        const mergedProperties: JsonObject = {};
        for (let schema of allOfs) {
            if (schema.allOf) schema = mergeAllOf(schema.allOf);
            for (const required of schema.required ?? []) mergedRequires.add(required);
            Object.assign(mergedProperties, schema.properties);
        }

        return {
            type: 'object',
            required: [...mergedRequires.values()],
            properties: mergedProperties,
        };
    }

    function getResponseSchema(
        method: HttpVerb,
        endpoint: string,
        statusCode: number,
        contentType?: string,
    ): any {
        const responses = openapiSchema.paths[endpoint][method.toLowerCase()].responses[statusCode];
        if (!responses.content) return undefined;

        let schema = responses.content[contentType ?? 'application/json'].schema;

        if (schema.type === 'string' && schema.format === 'binary') {
            schema.type = 'object'; // Workaround for JSON schema not having binary
            delete schema.format;
        }

        if (schema.allOf) schema = mergeAllOf(schema.allOf);
        schema.additionalProperties = false;
        ajv.validateSchema(schema);
        expect(ajv.errors).toBeNull();
        return schema;
    }

    beforeEach(() => {
        parcel = new Parcel(API_TOKEN, {
            apiUrl: API_BASE_URL,
        });
    });

    function createPodModel(): PODModel {
        const podModel = {
            id: uuid.v4(),
            createTimestamp: Math.floor(Date.now() / 1000),
        };
        expect(podModel).toMatchSchema('Model');
        return podModel;
    }

    const createIdentityId: () => IdentityId = () => uuid.v4() as IdentityId;
    const createConsentId: () => ConsentId = () => uuid.v4() as ConsentId;

    function createPodIdentity(): PODIdentity {
        const podIdentity = {
            ...createPodModel(),
            idp: {
                sub: 'subject',
                iss: 'auth.oasislabs.com',
                publicKey: API_KEY,
            },
        };
        expect(podIdentity).toMatchSchema('Identity');
        return podIdentity;
    }

    function createPodDataset(): PODDataset {
        const podDataset = {
            ...createPodModel(),
            creator: createIdentityId(),
            owner: createIdentityId(),
            metadata: {
                tags: ['mock', 'dataset'],
                key: { value: 42 },
            },
        };
        expect(podDataset).toMatchSchema('Dataset');
        return podDataset;
    }

    function createPodApp(): PODApp {
        const podApp = {
            ...createPodModel(),
            acceptanceText: 'thanks for the data!',
            brandingColor: '#abcdef',
            category: 'testing',
            consents: [createPodConsent()],
            creator: createIdentityId(),
            extendedDescription: 'looooong description',
            homepage: 'https://friendly.app',
            invitationText: 'plz give data',
            inviteOnly: true,
            invites: [createIdentityId()],
            name: 'test app',
            organization: 'Oasis Labs',
            participants: [],
            privacyPolicy: 'Your data remains private using the Oasis Network!',
            published: false,
            rejectionText: '🙁',
            shortDescription: 'shrt dscrptn',
            termsAndConditions: "you won't do bad things and neither will we.",
            logo: 'data:image/png;base64,SGVsbG8sIFdvcmxkIQ==',
        };
        expect(podApp).toMatchSchema('App');
        return podApp;
    }

    function createPodGrant(): PODGrant {
        const podGrant = {
            ...createPodModel(),
            granter: createIdentityId(),
            grantee: createIdentityId(),
            consent: createConsentId(),
            filter: { 'dataset.metadata.tags': { $any: { $eq: 'mock' } } },
        };
        expect(podGrant).toMatchSchema('Grant');
        return podGrant;
    }

    function createPodConsent(options?: { optional: boolean }): PODConsent {
        const podConsent: PODConsent = {
            ...createPodModel(),
            grants: [
                {
                    granter: 'requester',
                    grantee: 'initiator',
                    filter: { 'dataset.metadata.tags': { $any: { $eq: 'mock' } } },
                },
            ],
            required: !options?.optional,
        };
        expect(podConsent).toMatchSchema('Consent');
        return podConsent;
    }

    function createResultsPage<T>(n: number, factory: () => T): Page<T> {
        const page = {
            results: new Array(n).fill(undefined).map(() => factory()),
            nextPageToken: uuid.v4(),
        };
        expect(page).toMatchSchema('ResultsPage');
        return page;
    }

    describe('identity', () => {
        let fixtureIdentity: PODIdentity;

        beforeEach(() => {
            fixtureIdentity = createPodIdentity();
        });

        describe('create', () => {
            nockIt('create', async (scope) => {
                expect(fixtureIdentity).toMatchSchema(
                    getResponseSchema('POST', '/identities', 201),
                );
                const createParams = {
                    idp: fixtureIdentity.idp,
                };
                expect(createParams).toMatchSchema(getRequestSchema('POST', '/identities'));
                scope.post('/identities', createParams).reply(201, fixtureIdentity);
                const identity = await parcel.createIdentity(createParams);
                expect(identity).toMatchObject(fixtureIdentity);
            });

            nockIt('already exists', async (scope) => {
                expect(fixtureIdentity).toMatchSchema(
                    getResponseSchema('POST', '/identities', 200),
                );

                const expectedRequest = {
                    idp: fixtureIdentity.idp,
                };

                const existingIdentityEp = `/identities/${fixtureIdentity.id}`;
                scope.post('/identities', expectedRequest).reply(303, undefined, {
                    location: API_BASE_URL + existingIdentityEp,
                });
                scope.get(existingIdentityEp).reply(200, fixtureIdentity);

                const identity = await parcel.createIdentity(expectedRequest);
                expect(identity).toMatchObject(fixtureIdentity);
            });

            nockIt('bad request', async (scope) => {
                scope.post('/identities').reply(400);
                await expect(parcel.createIdentity({} as any)).rejects.toThrow();
            });
        });

        nockIt('get current', async (scope) => {
            expect(fixtureIdentity).toMatchSchema(getResponseSchema('GET', '/identities/me', 200));
            scope.get('/identities/me').reply(200, fixtureIdentity);
            const identity = await parcel.getCurrentIdentity();
            expect(identity).toMatchObject(fixtureIdentity);
        });

        describe('update', () => {
            nockIt('by id', async (scope) => {
                const updatedIdentity = Object.assign(clone(fixtureIdentity), {
                    idp: createPodIdentity().idp,
                });
                const update = { idp: updatedIdentity.idp };
                expect(update).toMatchSchema(getRequestSchema('PATCH', '/identities/{id}'));
                scope
                    .patch(`/identities/${fixtureIdentity.id}`, update)
                    .reply(200, updatedIdentity);
                const updated = await parcel.updateIdentity(
                    fixtureIdentity.id as IdentityId,
                    update,
                );
                expect(updated).toMatchObject(updatedIdentity);
            });

            nockIt('retrieved', async (scope) => {
                const updatedIdentity = Object.assign(clone(fixtureIdentity), {
                    idp: createPodIdentity().idp,
                });

                scope.get('/identities/me').reply(200, fixtureIdentity);
                scope
                    .patch(`/identities/${fixtureIdentity.id}`, { idp: updatedIdentity.idp })
                    .reply(200, updatedIdentity);

                const identity = await parcel.getCurrentIdentity();
                await identity.update({ idp: updatedIdentity.idp });
                expect(identity).toMatchObject(updatedIdentity);
            });
        });

        describe('delete', () => {
            nockIt('by id', async (scope) => {
                scope.delete(`/identities/${fixtureIdentity.id}`).reply(204);
                expect(
                    await parcel.deleteIdentity(fixtureIdentity.id as IdentityId),
                ).toBeUndefined();
            });

            nockIt('retrieved', async (scope) => {
                scope.get('/identities/me').reply(200, fixtureIdentity);
                scope.delete(`/identities/${fixtureIdentity.id}`).reply(204);
                const identity = await parcel.getCurrentIdentity();
                expect(await identity.delete()).toBeUndefined();
            });
        });
    });

    describe('dataset', () => {
        let fixtureDataset: PODDataset;
        const fixtureData = Buffer.from('fixture data');

        beforeEach(() => {
            fixtureDataset = createPodDataset();
        });

        class DownloadCollector extends Writable {
            private readonly bufs: Buffer[] = [];

            constructor(private readonly options?: { error: Error }) {
                super();
            }

            public _write(chunk: Buffer, _encoding: string, cb: (err?: any) => void) {
                if (this.options?.error) {
                    cb(this.options?.error);
                    return;
                }

                this.bufs.push(chunk);
                cb();
            }

            public get collectedDownload(): Buffer {
                return Buffer.concat(this.bufs);
            }
        }

        // Matches the metadata part of a (multipart) dataset upload request
        const MULTIPART_METADATA_RE = /content-disposition: form-data; name="metadata"\r\ncontent-type: application\/json\r\n\r\n{"metadata":{"tags":\["mock","dataset"],"key":{"value":42}}}\r\n/gi;
        // Matches the data part of a (multipart) dataset upload request
        const MULTIPART_DATA_RE = /content-disposition: form-data; name="data"\r\ncontent-type: application\/octet-stream\r\n\r\nfixture data\r\n/gi;

        describe('upload', () => {
            nockIt('no params', async (scope) => {
                expect(fixtureDataset).toMatchSchema(getResponseSchema('POST', '/datasets', 201));
                scope
                    .post('/datasets', MULTIPART_DATA_RE)
                    .matchHeader('content-type', /^multipart\/form-data; boundary=/)
                    .reply(201, fixtureDataset);
                const dataset = await parcel.uploadDataset(fixtureData).finished;
                expect(dataset).toMatchObject(fixtureDataset);
            });

            nockIt('with params', async (scope) => {
                scope
                    .post(
                        '/datasets',
                        (body) => MULTIPART_METADATA_RE.test(body) && MULTIPART_DATA_RE.test(body),
                    )
                    .matchHeader('content-type', /^multipart\/form-data; boundary=/)
                    .reply(201, fixtureDataset);
                const dataset = await parcel.uploadDataset(fixtureData, {
                    metadata: fixtureDataset.metadata!,
                }).finished;
                expect(dataset).toMatchObject(fixtureDataset);
            });
        });

        nockIt('get', async (scope) => {
            expect(fixtureDataset).toMatchSchema(getResponseSchema('GET', '/datasets/{id}', 200));
            scope.get(`/datasets/${fixtureDataset.id}`).reply(200, fixtureDataset);
            const dataset = await parcel.getDataset(fixtureDataset.id as DatasetId);
            expect(dataset).toMatchObject(fixtureDataset);
        });

        describe('download', () => {
            nockIt('by id', async (scope) => {
                scope.get(`/datasets/${fixtureDataset.id}/download`).reply(200, fixtureData);
                const download = parcel.downloadDataset(fixtureDataset.id as DatasetId);
                const downloadCollector = new DownloadCollector();
                await download.pipeTo(downloadCollector);
                expect(downloadCollector.collectedDownload).toEqual(fixtureData);
            });

            nockIt('retrieved', async (scope) => {
                scope.get(`/datasets/${fixtureDataset.id}`).reply(200, fixtureDataset);
                scope.get(`/datasets/${fixtureDataset.id}/download`).reply(200, fixtureData);

                const dataset = await parcel.getDataset(fixtureDataset.id as DatasetId);

                const download = dataset.download();
                const downloadCollector = new DownloadCollector();
                await download.pipeTo(downloadCollector);
                expect(downloadCollector.collectedDownload).toEqual(fixtureData);
            });

            nockIt('not found', async (scope) => {
                scope.get(`/datasets/${fixtureDataset.id}/download`).reply(404);
                const download = parcel.downloadDataset(fixtureDataset.id as DatasetId);
                const downloadCollector = new DownloadCollector();
                await expect(download.pipeTo(downloadCollector)).rejects.toThrow('404');
            });

            nockIt('write error', async (scope) => {
                scope.get(`/datasets/${fixtureDataset.id}/download`).reply(200, fixtureData);
                const download = parcel.downloadDataset(fixtureDataset.id as DatasetId);
                const downloadCollector = new DownloadCollector({ error: new Error('whoops') });
                await expect(download.pipeTo(downloadCollector)).rejects.toThrow('whoops');
            });
        });

        describe('list', () => {
            nockIt('no filter', async (scope) => {
                const numberResults = 3;
                const fixtureResultsPage: Page<PODDataset> = createResultsPage(
                    numberResults,
                    createPodDataset,
                );
                expect(fixtureResultsPage).toMatchSchema(
                    getResponseSchema('GET', '/datasets', 200),
                );

                scope.get('/datasets').reply(200, fixtureResultsPage);

                const { results, nextPageToken } = await parcel.listDatasets();
                expect(results).toHaveLength(numberResults);
                results.forEach((r, i) => expect(r).toMatchObject(fixtureResultsPage.results[i]));
                expect(nextPageToken).toEqual(fixtureResultsPage.nextPageToken);
            });

            nockIt('with filter and pagination', async (scope) => {
                const numberResults = 1;
                const fixtureResultsPage: Page<PODDataset> = createResultsPage(
                    numberResults,
                    createPodDataset,
                );

                const filterWithPagination = {
                    owner: fixtureResultsPage.results[0].owner as IdentityId,
                    creator: fixtureResultsPage.results[0].creator as IdentityId,
                    tags: 'all:tag1,tag2',
                    pageSize: 2,
                    nextPageToken: uuid.v4(),
                };
                expect(filterWithPagination).toMatchSchema(
                    getQueryParametersSchema('GET', '/datasets'),
                );
                scope
                    .get('/datasets')
                    .query(
                        Object.fromEntries(
                            Object.entries(filterWithPagination).map(([k, v]) => [paramCase(k), v]),
                        ),
                    )
                    .reply(200, fixtureResultsPage);

                const { results, nextPageToken } = await parcel.listDatasets({
                    ...filterWithPagination,
                    tags: { all: ['tag1', 'tag2'] },
                });
                expect(results).toHaveLength(numberResults);
                results.forEach((r, i) => expect(r).toMatchObject(fixtureResultsPage.results[i]));
                expect(nextPageToken).toEqual(fixtureResultsPage.nextPageToken);
            });

            nockIt('no results', async (scope) => {
                const fixtureResultsPage: Page<PODDataset> = createResultsPage(0, createPodDataset);
                scope.get('/datasets').reply(200, fixtureResultsPage);
                const { results, nextPageToken } = await parcel.listDatasets();
                expect(results).toHaveLength(0);
                expect(nextPageToken).toEqual(fixtureResultsPage.nextPageToken);
            });
        });

        describe('update', () => {
            nockIt('by id', async (scope) => {
                const update = {
                    owner: createIdentityId(),
                    metadata: { hello: 'world', deleteKey: null },
                };
                expect(update).toMatchSchema(getRequestSchema('PATCH', '/datasets/{id}'));
                const updatedDataset = Object.assign(clone(fixtureDataset), update);
                scope.patch(`/datasets/${fixtureDataset.id}`, update).reply(200, updatedDataset);
                const updated = await parcel.updateDataset(fixtureDataset.id as DatasetId, update);
                expect(updated).toMatchObject(updatedDataset);
            });

            nockIt('retrieved', async (scope) => {
                const update = {
                    owner: createIdentityId(),
                    metadata: { hello: 'world', deleteKey: null },
                };
                const updatedDataset = Object.assign(clone(fixtureDataset), update);

                scope.patch(`/datasets/${fixtureDataset.id}`, update).reply(200, updatedDataset);
                scope.get(`/datasets/${fixtureDataset.id}`).reply(200, fixtureDataset);

                const dataset = await parcel.getDataset(fixtureDataset.id as DatasetId);
                await dataset.update(update);
                expect(dataset).toMatchObject(updatedDataset);
            });

            nockIt('empty params', async (scope) => {
                // This test is for JavaScript users who might inadvertently pass in an empty params.
                scope.get(`/datasets/${fixtureDataset.id}`).reply(200, fixtureDataset);
                const dataset = await parcel.updateDataset(
                    fixtureDataset.id as DatasetId,
                    {} as any,
                );
                expect(dataset).toMatchObject(fixtureDataset);
            });
        });

        describe('delete', () => {
            nockIt('by id', async (scope) => {
                scope.delete(`/datasets/${fixtureDataset.id}`).reply(204);
                await parcel.deleteDataset(fixtureDataset.id as DatasetId);
            });

            nockIt('retrieved', async (scope) => {
                scope.get(`/datasets/${fixtureDataset.id}`).reply(200, fixtureDataset);
                scope.delete(`/datasets/${fixtureDataset.id}`).reply(204);
                const dataset = await parcel.getDataset(fixtureDataset.id as DatasetId);
                await dataset.delete();
            });

            nockIt('expect 204', async (scope) => {
                scope.delete(`/datasets/${fixtureDataset.id}`).reply(200);
                await expect(
                    parcel.deleteDataset(fixtureDataset.id as DatasetId),
                ).rejects.toThrow();
            });
        });
    });

    describe('grant', () => {
        let fixtureGrant: PODGrant;

        beforeEach(() => {
            fixtureGrant = createPodGrant();
        });

        nockIt('create', async (scope) => {
            expect(fixtureGrant).toMatchSchema(getResponseSchema('POST', '/grants', 201));
            const createParams = {
                grantee: createIdentityId(),
                filter: fixtureGrant.filter,
            };
            expect(createParams).toMatchSchema(getRequestSchema('POST', '/grants'));
            scope.post('/grants', createParams).reply(201, fixtureGrant);
            const grant = await parcel.createGrant(createParams);
            expect(grant).toMatchObject(fixtureGrant);
        });

        nockIt('get', async (scope) => {
            expect(fixtureGrant).toMatchSchema(getResponseSchema('GET', '/grants/{id}', 200));
            scope.get(`/grants/${fixtureGrant.id}`).reply(200, JSON.stringify(fixtureGrant));
            const grant = await parcel.getGrant(fixtureGrant.id as GrantId);
            expect(grant).toMatchObject(fixtureGrant);
        });

        describe('delete', () => {
            nockIt('by id', async (scope) => {
                scope.delete(`/grants/${fixtureGrant.id}`).reply(204);
                await parcel.deleteGrant(fixtureGrant.id as GrantId);
            });

            nockIt('retrieved', async (scope) => {
                scope.get(`/grants/${fixtureGrant.id}`).reply(200, fixtureGrant);
                scope.delete(`/grants/${fixtureGrant.id}`).reply(204);
                const grant = await parcel.getGrant(fixtureGrant.id as GrantId);
                await grant.delete();
            });

            nockIt('expect 204', async (scope) => {
                scope.delete(`/grants/${fixtureGrant.id}`).reply(200);
                await expect(parcel.deleteGrant(fixtureGrant.id as GrantId)).rejects.toThrow();
            });
        });
    });

    describe('app', () => {
        let fixtureApp: PODApp;

        beforeEach(() => {
            fixtureApp = createPodApp();
        });

        nockIt('create', async (scope) => {
            const createParams: any /* AppCreateParams & PODApp */ = {
                ...clone(fixtureApp),
                consents: [createPodConsent({ optional: true })],
                idp: {
                    sub: 'app',
                    iss: 'auth.oasislabs.com',
                    publicKey: API_KEY,
                },
            };
            delete createParams.id;
            delete createParams.createTimestamp;
            delete createParams.creator;
            delete createParams.participants;
            delete createParams.published;

            expect(createParams).toMatchSchema(getRequestSchema('POST', '/apps'));
            scope.post('/apps', createParams).reply(201, fixtureApp);
            expect(fixtureApp).toMatchSchema(getResponseSchema('POST', '/apps', 201));
            const app = await parcel.createApp(createParams);
            expect(app).toMatchObject(fixtureApp);
        });

        nockIt('get', async (scope) => {
            expect(fixtureApp).toMatchSchema(getResponseSchema('GET', '/apps/{id}', 200));
            scope.get(`/apps/${fixtureApp.id}`).reply(200, fixtureApp);
            const app = await parcel.getApp(fixtureApp.id as AppId);
            expect(app).toMatchObject(fixtureApp);
        });

        describe('list', () => {
            nockIt('no filter', async (scope) => {
                const numberResults = 3;
                const fixtureResultsPage: Page<PODApp> = createResultsPage(
                    numberResults,
                    createPodApp,
                );
                expect(fixtureResultsPage).toMatchSchema(getResponseSchema('GET', '/apps', 200));

                scope.get('/apps').reply(200, fixtureResultsPage);

                const { results, nextPageToken } = await parcel.listApps();
                expect(results).toHaveLength(numberResults);
                results.forEach((r, i) => expect(r).toMatchObject(fixtureResultsPage.results[i]));
                expect(nextPageToken).toEqual(fixtureResultsPage.nextPageToken);
            });

            nockIt('with filter and pagination', async (scope) => {
                const numberResults = 1;
                const fixtureResultsPage: Page<PODApp> = createResultsPage(
                    numberResults,
                    createPodApp,
                );

                const filterWithPagination = {
                    creator: createIdentityId(),
                    requesterParticipation: 'invited' as const,
                    pageSize: 2,
                    nextPageToken: uuid.v4(),
                };
                expect(filterWithPagination).toMatchSchema(
                    getQueryParametersSchema('GET', '/apps'),
                );
                scope
                    .get('/apps')
                    .query(
                        Object.fromEntries(
                            Object.entries(filterWithPagination).map(([k, v]) => [paramCase(k), v]),
                        ),
                    )
                    .reply(200, fixtureResultsPage);

                const { results, nextPageToken } = await parcel.listApps(filterWithPagination);
                expect(results).toHaveLength(numberResults);
                results.forEach((r, i) => expect(r).toMatchObject(fixtureResultsPage.results[i]));
                expect(nextPageToken).toEqual(fixtureResultsPage.nextPageToken);
            });

            nockIt('no results', async (scope) => {
                const fixtureResultsPage: Page<PODApp> = createResultsPage(0, createPodApp);
                scope.get('/apps').reply(200, fixtureResultsPage);
                const { results, nextPageToken } = await parcel.listApps();
                expect(results).toHaveLength(0);
                expect(nextPageToken).toEqual(fixtureResultsPage.nextPageToken);
            });
        });

        describe('update', () => {
            let update: AppUpdateParams;
            let updatedApp: PODApp;

            beforeEach(() => {
                update = {
                    acceptanceText: 'new acceptance text',
                    brandingColor: '#feeded',
                    category: 'updated category',
                    extendedDescription: 'new extended description',
                    invitationText: 'new invitation text',
                    inviteOnly: false,
                    newOptionalConsents: [createPodConsent({ optional: true })],
                    published: true,
                    rejectionText: 'new rejection text',
                    removedConsents: [createConsentId()],
                    shortDescription: 'new short description',
                    logo: 'https://logos.images',
                    uninvite: fixtureApp.invites as IdentityId[],
                };
                updatedApp = Object.assign(clone(fixtureApp), update);
                delete (updatedApp as any).newOptionalConsents;
                delete (updatedApp as any).removedConsents;
                delete (updatedApp as any).uninvite;
                updatedApp.consents = [];
                updatedApp.invites = [];
            });

            nockIt('by id', async (scope) => {
                scope.patch(`/apps/${fixtureApp.id}`, update).reply(200, updatedApp);
                const updated = await parcel.updateApp(fixtureApp.id as AppId, update);
                expect(updated).toMatchObject(updatedApp);
            });

            nockIt('retrieved', async (scope) => {
                scope.patch(`/apps/${fixtureApp.id}`, update).reply(200, updatedApp);
                scope.get(`/apps/${fixtureApp.id}`).reply(200, fixtureApp);

                const app = await parcel.getApp(fixtureApp.id as AppId);
                await app.update(update);
                expect(app).toMatchObject(updatedApp);
            });

            nockIt('empty params', async (scope) => {
                // This test is for JavaScript users who might inadvertently pass in an empty params.
                scope.get(`/apps/${fixtureApp.id}`).reply(200, fixtureApp);
                const app = await parcel.updateApp(fixtureApp.id as AppId, {} as any);
                expect(app).toMatchObject(fixtureApp);
            });
        });

        describe('delete', () => {
            nockIt('by id', async (scope) => {
                scope.delete(`/apps/${fixtureApp.id}`).reply(204);
                await parcel.deleteApp(fixtureApp.id as AppId);
            });

            nockIt('retrieved', async (scope) => {
                scope.get(`/apps/${fixtureApp.id}`).reply(200, fixtureApp);
                scope.delete(`/apps/${fixtureApp.id}`).reply(204);
                const app = await parcel.getApp(fixtureApp.id as AppId);
                await app.delete();
            });

            nockIt('expect 204', async (scope) => {
                scope.delete(`/apps/${fixtureApp.id}`).reply(200);
                await expect(parcel.deleteApp(fixtureApp.id as AppId)).rejects.toThrow();
            });
        });

        describe('consent', () => {
            describe('authorize', () => {
                const optionalConsents = [createConsentId(), createConsentId()];

                nockIt('by id', async (scope) => {
                    scope
                        .post(`/apps/${fixtureApp.id}/consent`, { consents: optionalConsents })
                        .reply(200);
                    await parcel.authorizeApp(fixtureApp.id as AppId, optionalConsents);
                });

                nockIt('retrieved', async (scope) => {
                    scope.get(`/apps/${fixtureApp.id}`).reply(200, fixtureApp);
                    scope
                        .post(`/apps/${fixtureApp.id}/consent`, { consents: optionalConsents })
                        .reply(200);
                    const app = await parcel.getApp(fixtureApp.id as AppId);
                    await app.authorize(optionalConsents);
                });
            });

            describe('update', () => {
                const granted = [createConsentId(), createConsentId()];
                const revoked = [createConsentId()];
                const update = { granted, revoked };

                nockIt('by id', async (scope) => {
                    scope.patch(`/apps/${fixtureApp.id}/consent`, update).reply(200);
                    await parcel.updateAppConsent(fixtureApp.id as AppId, update);
                });

                nockIt('retrieved', async (scope) => {
                    scope.get(`/apps/${fixtureApp.id}`).reply(200, fixtureApp);
                    scope.patch(`/apps/${fixtureApp.id}/consent`, update).reply(200);
                    const app = await parcel.getApp(fixtureApp.id as AppId);
                    await app.updateConsent(update);
                });
            });

            describe('deauthorize', () => {
                nockIt('by id', async (scope) => {
                    scope.delete(`/apps/${fixtureApp.id}/consent`).reply(204);
                    await parcel.deauthorizeApp(fixtureApp.id as AppId);
                });

                nockIt('retrieved', async (scope) => {
                    scope.get(`/apps/${fixtureApp.id}`).reply(200, fixtureApp);
                    scope.delete(`/apps/${fixtureApp.id}/consent`).reply(204);
                    const app = await parcel.getApp(fixtureApp.id as AppId);
                    await app.deauthorize();
                });
            });
        });
    });
});
