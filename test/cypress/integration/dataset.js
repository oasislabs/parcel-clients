/// <reference path="../fixtures/types.d.ts" />

// @ts-check
const API_URL = 'https://api.oasislabs.local/v1';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-user-agent',
};

context('Download', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('roundtrip', () => {
    const mockDatasetId =
      /** @type { import('../../../src').DatasetId } */
      ('fad69589-b76c-4cf0-856a-8a05fbda90c2');
    const mockData = Buffer.alloc(1024 * 1024 * 2).fill(34);

    const downloadUrl = `${API_URL}/datasets/${mockDatasetId}/download`;
    cy.route2('OPTIONS', downloadUrl, {
      headers: CORS_HEADERS,
    });
    cy.route2('GET', downloadUrl, (req) => {
      req.reply(mockData.toString('base64'), CORS_HEADERS);
    });
    cy.window()
      .then(async (window) => {
        const parcel = new window.Parcel('fake api token', { apiUrl: API_URL });
        const download = parcel.downloadDataset(mockDatasetId);
        return new Promise((resolve, reject) => {
          const bufs = [];
          download
            .on('error', reject)
            .on('data', (buf) => bufs.push(buf))
            .on('end', () => resolve(Buffer.concat(bufs).toString()));
        });
      })
      .should('equal', mockData.toString('base64'));
  });

  it('not found', () => {
    const bogusDatasetId = 'totally-bogus-dataset-id';
    const downloadUrl = `${API_URL}/datasets/${bogusDatasetId}/download`;
    cy.route2('OPTIONS', downloadUrl, {
      headers: CORS_HEADERS,
    });
    cy.route2('GET', downloadUrl, (req) => {
      req.reply(404, { error: 'not found' }, CORS_HEADERS);
    });
    cy.window().then(async (window) => {
      const parcel = new window.Parcel('fake api token', { apiUrl: API_URL });
      const download = parcel.downloadDataset(bogusDatasetId);
      return new Promise((resolve, reject) => {
        download
          .on('error', resolve)
          .on('data', (data) => {
            reject(new Error(`expected rejection but got data: ${data}`));
          })
          .on('end', () => {
            reject(new Error('expected rejection but got end'));
          });
      });
    });
  });
});
