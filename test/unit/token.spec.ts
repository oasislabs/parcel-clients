import jwt from 'jsonwebtoken';
import { KEYUTIL } from 'jsrsasign';
import nock from 'nock';

import {
    PrivateJWK,
    RefreshingTokenProvider,
    RenewingTokenProvider,
    SelfIssuedTokenProvider,
    StaticTokenProvider,
} from '@oasislabs/parcel/token';

const privateJwk: PrivateJWK = {
    // A random jwk from https://mkjwk.org/.
    kty: 'EC',
    crv: 'P-256',
    d: 'LAvsIqVtYbq0KVHVeWx5o-aI0rV5vNZyhH1K0DmQOdo',
    x: '-EEnau5dVtKS2z3bNL6qyvQS-8fbO15fKcXbsbILBVs',
    y: '3Hgr-K3DxyWtoOZTx_DKs1XUXmMZBLyH_G1DgSMQvhI',
    kid: 'the key id',
    alg: 'ES256',
    use: 'sig',
};
const jwkPem = KEYUTIL.getPEM(
    KEYUTIL.getKey({
        ...privateJwk,
        crv: 'secp256r1',
    } as any),
    'PKCS8PRV',
);

describe('StaticTokenProvider', () => {
    it('provides token', async () => {
        const provider = new StaticTokenProvider('token');
        await expect(provider.getToken()).resolves.toBe('token');
    });
});

describe('Re(new|fresh)ingTokenProvider', () => {
    const authUrl = 'https://auth.oasislabs.com';
    const tokenEndpoint = `${authUrl}/token`;

    const renewingProviderParams = {
        clientId: 'parcel user',
        privateKey: privateJwk,
        tokenEndpoint,
        scopes: ['api', 'storage'],
    };

    const refreshingProviderParams = {
        tokenEndpoint,
        refreshToken: '5BcgyHetfeUlcoeaO0AIA9NtYq1xiIKxlsNAmtHxqE4',
    };

    afterEach(() => {
        nock.cleanAll();
    });

    [
        {
            name: 'private key',
            makeProvider: () => new RenewingTokenProvider(renewingProviderParams),
            expectedRequest: (body: any) => {
                const { payload: clientAssertion, header } = jwt.verify(
                    body.client_assertion,
                    jwkPem as any,
                    {
                        complete: true,
                        algorithms: ['ES256'],
                        issuer: renewingProviderParams.clientId,
                        subject: renewingProviderParams.clientId,
                        audience: tokenEndpoint,
                    },
                ) as any;
                const isGoodJwt =
                    header.kid === privateJwk.kid && typeof clientAssertion.jti === 'string';
                return (
                    body.grant_type === 'client_credentials' &&
                    body.scope === 'api storage' &&
                    body.client_assertion_type ===
                        'urn:ietf:params:oauth:client-assertion-type:jwt-bearer' &&
                    isGoodJwt
                );
            },
        },
        {
            name: 'refresh token',
            makeProvider: () => new RefreshingTokenProvider(refreshingProviderParams),
            expectedRequest: {
                grant_type: 'refresh_token',
                refresh_token: refreshingProviderParams.refreshToken,
            },
            expectedRefreshRequest: (body: any) => {
                return body.refresh_token === 'refresh token 2';
            },
        },
    ].forEach((suite) => {
        describe('using ' + suite.name, () => {
            it('provides token', async () => {
                const provider = suite.makeProvider();

                const ONE_HOUR = 60 * 60;
                const accessToken = makeAccessToken(ONE_HOUR);
                const scope = nock(authUrl).post('/token', suite.expectedRequest).reply(200, {
                    access_token: accessToken,
                    expires_in: ONE_HOUR,
                });

                await provider.getToken();
                await expect(provider.getToken()).resolves.toBe(accessToken);
                scope.done();
                await expect(provider.getToken()).resolves.toBe(accessToken);
            });

            it('refreshes token', async () => {
                const provider = suite.makeProvider();

                const NO_TIME = 0;

                const accessToken1 = makeAccessToken(NO_TIME, { seq: 1 });
                const accessToken2 = makeAccessToken(NO_TIME, { seq: 2 });
                const refreshToken2 = 'refresh token 2';

                let scope = nock(authUrl).post('/token').reply(200, {
                    access_token: accessToken1,
                    refresh_token: refreshToken2,
                    expires_in: NO_TIME,
                });

                await expect(provider.getToken()).resolves.toBe(accessToken1);
                scope.done();

                scope = nock(authUrl)
                    .post('/token', suite.expectedRefreshRequest ?? (() => true))
                    .reply(200, {
                        access_token: accessToken2,
                        expires_in: NO_TIME,
                    });

                await expect(provider.getToken()).resolves.toBe(accessToken2);
                scope.done();
            });

            it('throws', async () => {
                const provider = suite.makeProvider();
                const scope = nock(authUrl).post('/token').reply(401);
                await expect(provider.getToken()).rejects.toThrow();
                scope.done();
            });
        });
    });
});

describe('SelfIssuedTokenProvider', () => {
    const defaultParams = {
        principal: 'sovereign',
        privateKey: privateJwk,
        scopes: ['all', 'of', 'them'],
    };

    it('provides token', async () => {
        const provider = new SelfIssuedTokenProvider(defaultParams);
        const token = await provider.getToken();
        const { payload, header } = jwt.verify(token, jwkPem as any, {
            complete: true,
            algorithms: ['ES256'],
            issuer: defaultParams.principal,
            subject: defaultParams.principal,
            audience: 'parcel-runtime',
        }) as any;
        expect(header.kid).toBeDefined();
        expect(payload.exp).toBeGreaterThan(Date.now() / 1000 + 1 * 60 * 60 - 1 * 60);
    });

    it('refreshes token', async () => {
        const provider = new SelfIssuedTokenProvider({
            ...defaultParams,
            tokenLifetime: 0,
        });
        const token = await provider.getToken();
        const secondToken = await provider.getToken();
        expect(token).not.toEqual(secondToken);
    });
});

function makeAccessToken(expiry: number, claims: any = {}): string {
    return jwt.sign(claims, 'secret', { expiresIn: expiry });
}
