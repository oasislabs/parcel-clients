import * as uuid from 'uuid';

const API_URL = 'https://api.oasislabs.local/v1';

const CORS_HEADERS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization',
};

context('Download', () => {
    beforeEach(() => {
        cy.visit('/');
    });

    it('roundtrip', () => {
        const mockDatasetId = uuid.v4();
        const mockData = Buffer.alloc(12).fill(34);

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
});
