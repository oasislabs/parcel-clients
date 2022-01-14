import jwt from 'jsonwebtoken';
import { KEYUTIL } from 'jsrsasign';
import nock from 'nock';
import ky from 'ky-universal';

import {
  PARCEL_RUNTIME_AUD,
  RefreshingTokenProvider,
  RenewingTokenProvider,
  Scope,
  SelfIssuedTokenProvider,
  StaticTokenProvider,
} from '@oasislabs/parcel/token';
import type { PublicJWK, PrivateJWK } from '@oasislabs/parcel/token';

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

const ONE_HOUR = 60 * 60;

const AUTH_URL = 'https://auth.oasislabs.com';
const TOKEN_ENDPOINT = `${AUTH_URL}/token`;

const RENEWING_PROVIDER_PARAMS = {
  clientId: 'parcel user',
  privateKey: privateJwk,
  tokenEndpoint: TOKEN_ENDPOINT,
  scopes: ['parcel.job.*', 'parcel.full.read'] as Scope[],
  audience: PARCEL_RUNTIME_AUD,
};

const REFRESHING_PROVIDER_PARAMS = {
  tokenEndpoint: TOKEN_ENDPOINT,
  refreshToken: '5BcgyHetfeUlcoeaO0AIA9NtYq1xiIKxlsNAmtHxqE4',
  audience: PARCEL_RUNTIME_AUD,
};

describe('StaticTokenProvider', () => {
  it('provides token', async () => {
    const provider = new StaticTokenProvider('token');
    await expect(provider.getToken()).resolves.toBe('token');
  });
});

describe('Re(new|fresh)ingTokenProvider', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  for (const suite of [
    {
      name: 'private key',
      makeProvider: () => new RenewingTokenProvider(RENEWING_PROVIDER_PARAMS),
      expectedRequest: (body: any) => {
        const { payload: clientAssertion, header } = jwt.verify(
          body.client_assertion,
          jwkPem as any,
          {
            complete: true,
            algorithms: ['ES256'],
            issuer: RENEWING_PROVIDER_PARAMS.clientId,
            subject: RENEWING_PROVIDER_PARAMS.clientId,
            audience: TOKEN_ENDPOINT,
          },
        ) as any;
        const isGoodJwt = header.kid === privateJwk.kid && typeof clientAssertion.jti === 'string';
        return (
          body.grant_type === 'client_credentials' &&
          body.scope === 'parcel.job.* parcel.full.read' &&
          body.audience === PARCEL_RUNTIME_AUD &&
          body.client_assertion_type === 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer' &&
          isGoodJwt
        );
      },
    },
    {
      name: 'refresh token',
      makeProvider: () => new RefreshingTokenProvider(REFRESHING_PROVIDER_PARAMS),
      expectedRequest: {
        grant_type: 'refresh_token',
        refresh_token: REFRESHING_PROVIDER_PARAMS.refreshToken,
        audience: PARCEL_RUNTIME_AUD,
      },
      expectedRefreshRequest: (body: any) =>
        body.refresh_token === 'refresh token 2' && body.audience === PARCEL_RUNTIME_AUD,
    },
  ]) {
    describe('using ' + suite.name, () => {
      it('provides token', async () => {
        const provider = suite.makeProvider();

        const accessToken = makeAccessToken(ONE_HOUR);
        const scope = nock(AUTH_URL).post('/token', suite.expectedRequest).reply(200, {
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

        let scope = nock(AUTH_URL).post('/token').reply(200, {
          access_token: accessToken1,
          refresh_token: refreshToken2,
          expires_in: NO_TIME,
        });

        await expect(provider.getToken()).resolves.toBe(accessToken1);
        scope.done();

        scope = nock(AUTH_URL)
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
        const scope = nock(AUTH_URL).post('/token').reply(401);
        await expect(provider.getToken()).rejects.toThrow();
        scope.done();
      });
    });
  }
});

describe('RenewingTokenProvider', () => {
  it('does not generate keyId', async () => {
    const { kid, ...privateKey } = privateJwk;
    const provider = new RenewingTokenProvider({
      ...RENEWING_PROVIDER_PARAMS,
      privateKey,
    });

    const accessToken = makeAccessToken(ONE_HOUR);
    const scope = nock(AUTH_URL)
      .post('/token', (body: any) => {
        const { header } = insecureDecodeJwt(body.client_assertion);
        return header.kid === undefined;
      })
      .reply(200, {
        access_token: accessToken,
        expires_in: ONE_HOUR,
      });

    await expect(provider.getToken()).resolves.toBe(accessToken);
    scope.done();
  });
});

describe('SelfIssuedTokenProvider', () => {
  const defaultParams = {
    principal: 'sovereign',
    privateKey: privateJwk,
    scopes: ['parcel.full'] as Scope[],
  };

  it('provides token', async () => {
    const provider = new SelfIssuedTokenProvider(defaultParams);
    const token = await provider.getToken();
    const { payload, header } = jwt.verify(token, jwkPem as any, {
      complete: true,
      algorithms: ['ES256'],
      issuer: defaultParams.principal,
      subject: defaultParams.principal,
      audience: PARCEL_RUNTIME_AUD,
    }) as any;
    expect(header).toHaveProperty('kid');
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

  it('does not generate keyId', async () => {
    const { kid, ...privateKey } = privateJwk;
    const provider = new SelfIssuedTokenProvider({
      ...defaultParams,
      privateKey,
    });
    const { header } = insecureDecodeJwt(await provider.getToken());
    expect(header).not.toHaveProperty('kid');
  });
});

function makeAccessToken(expiry: number, claims: any = {}): string {
  return jwt.sign(claims, 'secret', { expiresIn: expiry });
}

function insecureDecodeJwt(jwt: string): { header: any; payload: any } {
  const [header, payload] = jwt
    .split('.')
    .slice(0, 2)
    .map((part) => JSON.parse(Buffer.from(part, 'base64').toString()));
  return { header, payload };
}

// @ts-expect-error
const BAD_PUBLIC_JWK: PublicJWK = privateJwk; // eslint-disable-line no-unused-vars
