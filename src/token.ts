import jsrsasign from 'jsrsasign';
import type { NormalizedOptions, ResponsePromise } from 'ky';
import ky, { HTTPError } from 'ky';
import type { JsonObject, Merge } from 'type-fest';

import { appendAsLastBeforeRequest, dontCloneForAfterResponses } from './http.js';
import type { IdentityId } from './identity.js';
import './polyfill.js'; // eslint-disable-line import/no-unassigned-import

export class TokenError extends HTTPError {
  name = 'TokenError';
  message = this.responseJson.error_description ?? this.responseJson.error;

  public constructor(
    request: Request,
    options: NormalizedOptions,
    response: Response,
    // Workaround for https://github.com/sindresorhus/ky/issues/148.
    public responseJson: {
      error: string; // Identifier
      error_description?: string; // Error_verbose \n error_hint
      error_verbose?: string;
      error_hint?: string;
    },
  ) {
    super(response, request, options);
  }
}

const tokenKy: typeof ky = ky.create({
  hooks: {
    beforeRequest: [appendAsLastBeforeRequest(dontCloneForAfterResponses())],
    afterResponse: [
      async (req, opts, res) => {
        // Wrap errors, for easier client handling (and maybe better messages).
        const isJson = res.headers.get('content-type')?.startsWith('application/json') ?? false;
        if (!res.ok && isJson) {
          throw new TokenError(req, opts, res, await res.json());
        }
      },
    ],
  },
});

type ScopeResource = 'identity' | 'dataset' | 'app' | 'grant' | 'permission' | 'job' | '*';
type ScopeAction = 'create' | 'read' | 'update' | 'delete' | '*';
export type Scope = 'parcel.full' | `parcel.${ScopeResource}.${ScopeAction}`;

const DEFAULT_TOKEN_ENDPOINT = globalThis?.process?.env?.PARCEL_AUTH_URL
  ? `${globalThis.process.env.PARCEL_AUTH_URL}/oauth/token`
  : 'https://auth.oasislabs.com/oauth/token';
export const PARCEL_RUNTIME_AUD = 'https://api.oasislabs.com/parcel'; // TODO(#326)
const DEFAULT_SCOPES: Scope[] = ['parcel.full'];

export abstract class TokenProvider {
  public static fromSource(source: TokenSource): TokenProvider {
    if (typeof source === 'string') return new StaticTokenProvider(source);
    if ('principal' in source) return new SelfIssuedTokenProvider(source);
    if ('refreshToken' in source) return new RefreshingTokenProvider(source);
    if ('clientId' in source) return new RenewingTokenProvider(source);
    throw new Error(`unrecognized \`tokenSource\`: ${JSON.stringify(source)}`);
  }

  /** Returns a valid Bearer token to be presented to the Parcel gateway. */
  public abstract getToken(): Promise<string>;
}

export type TokenSource =
  | string
  | RenewingTokenProviderParams
  | RefreshingTokenProviderParams
  | SelfIssuedTokenProviderParams;

/** A `TokenProvider` hands out OIDC access tokens. */
export abstract class ExpiringTokenProvider implements TokenProvider {
  protected token?: Token;

  public static isTokenProvider(thing: any): thing is TokenProvider {
    return thing && typeof thing.getToken === 'function';
  }

  /** Returns a valid Bearer token to be presented to the Parcel gateway. */
  public async getToken(): Promise<string> {
    if (this.token === undefined || this.token.isExpired()) this.token = await this.renewToken();
    return this.token.toString();
  }

  /** Returns a renewed `Token`. */
  protected abstract renewToken(): Promise<Token>;
}

/** A `TokenProvider` that always returns the same, initially provided token. */
export class StaticTokenProvider implements TokenProvider {
  public constructor(private readonly token: string) {}

  public async getToken(): Promise<string> {
    return this.token;
  }
}

/** Parameters of a token provider that fetches access tokens via OAuth using a client key. */
export type RenewingTokenProviderParams = {
  clientId: string;

  privateKey: PrivateJWK;

  /**
   * The identity provider's OAuth token retrieval endpoint.
   */
  tokenEndpoint?: string;

  /**
   * The audience to use when using provider's OAuth token retrieval endpoint.
   */
  audience?: string;

  /**
   * A list of scopes that will be requested from the identity provider, which
   * may be different from the scopes that the identity provider actually returns.
   */
  scopes?: Scope[];
};

/** A `TokenProvider` that obtains a new token by re-authenticating to the issuer. */
export class RenewingTokenProvider extends ExpiringTokenProvider {
  private readonly clientId: string;
  private readonly tokenEndpoint: string;
  private readonly audience: string;
  private readonly scopes: Scope[];
  private readonly privateKey: PrivateJWK;
  private readonly privateKeyPEM: string; // PEM is required by jsrsasign.

  private readonly clientAssertionLifetime = 1 * 60 * 60; // 1 hour

  public constructor({
    clientId,
    privateKey,
    scopes,
    tokenEndpoint,
    audience,
  }: RenewingTokenProviderParams) {
    super();

    if (privateKey.kty !== 'EC') {
      throw new Error('Private key should be an ECDSA key.');
    }

    this.privateKey = privateKey;
    const privateKeyPEM = jwkToPem(privateKey);
    this.privateKeyPEM = privateKeyPEM;

    this.clientId = clientId;
    this.tokenEndpoint = tokenEndpoint ?? DEFAULT_TOKEN_ENDPOINT;
    this.audience = audience ?? PARCEL_RUNTIME_AUD;
    this.scopes = scopes ?? DEFAULT_SCOPES;
  }

  protected async renewToken(): Promise<Token> {
    const clientAssertion = makeJWT({
      privateKey: this.privateKeyPEM,
      keyId: this.privateKey.kid,
      payload: {
        sub: this.clientId,
        iss: this.clientId,
        aud: this.tokenEndpoint,
        jti: jsrsasign.KJUR.crypto.Util.getRandomHexOfNbytes(8),
      },
      lifetime: this.clientAssertionLifetime,
    });

    const authParams = new URLSearchParams();
    authParams.append('grant_type', 'client_credentials');
    authParams.append('client_assertion', clientAssertion);
    authParams.append(
      'client_assertion_type',
      'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    );
    authParams.append('scope', this.scopes.join(' '));
    authParams.append('audience', this.audience);

    return Token.fromResponse(tokenKy.post(this.tokenEndpoint, { body: authParams }));
  }
}

/** Parameters of a token provider that fetches access tokens via OAuth using a refresh token. */
export type RefreshingTokenProviderParams = {
  refreshToken: string;
  tokenEndpoint: string;
  audience: string;
};

/** A `TokenProvider` that obtains a new token using a refresh token. */
export class RefreshingTokenProvider extends ExpiringTokenProvider {
  private refreshToken: string;
  private readonly tokenEndpoint: string;
  private readonly audience: string;

  public constructor({ refreshToken, tokenEndpoint, audience }: RefreshingTokenProviderParams) {
    super();
    this.refreshToken = refreshToken;
    this.tokenEndpoint = tokenEndpoint;
    this.audience = audience;
  }

  protected async renewToken(): Promise<Token> {
    const refreshParams = new URLSearchParams();
    refreshParams.append('grant_type', 'refresh_token');
    refreshParams.append('refresh_token', this.refreshToken);
    refreshParams.append('audience', this.audience);

    const res = tokenKy.post(this.tokenEndpoint, { body: refreshParams });
    res
      // eslint-disable-next-line promise/prefer-await-to-then
      .then(async (refreshResponse) => {
        this.refreshToken = (await refreshResponse.clone().json()).refresh_token;
      })
      // eslint-disable-next-line promise/prefer-await-to-then
      .catch(() => {
        // Do nothing. The promise lives on.
      });
    return Token.fromResponse(res);
  }
}

/** Parameters of a token provider that signs its own access tokens using a private key. */
export type SelfIssuedTokenProviderParams = {
  /** The `sub` and `iss` claims of the provided access token. */
  principal: string | IdentityId;

  /** The private key that will be used to sign the access token. */
  privateKey: PrivateJWK;

  /**
   * A list of scopes that will be added as claims.
   * The default is all scopes.
   */
  scopes?: Scope[];

  /**
   * Duration for which the issued token is valid, in seconds.
   * Defaults to one hour;
   */
  tokenLifetime?: number;
};

/** A `TokenProvider` that self-signs an access token. */
export class SelfIssuedTokenProvider extends ExpiringTokenProvider {
  private readonly principal: string;
  private readonly privateKey: PrivateJWK;
  private readonly privateKeyPEM: string; // PEM is required by jsrsasign.
  private readonly scopes: Scope[];
  private readonly tokenLifetime: number;

  public constructor({
    principal,
    privateKey,
    scopes,
    tokenLifetime,
  }: SelfIssuedTokenProviderParams) {
    super();

    this.privateKey = privateKey;
    const privateKeyPEM = jwkToPem(privateKey);
    this.privateKeyPEM = privateKeyPEM;

    this.principal = principal;
    this.scopes = scopes ?? DEFAULT_SCOPES;
    this.tokenLifetime = tokenLifetime ?? 1 * 60 * 60 /* one hour */;
  }

  protected async renewToken(): Promise<Token> {
    const expiry = Date.now() / 1000 + this.tokenLifetime;
    const token = makeJWT({
      privateKey: this.privateKeyPEM,
      keyId: this.privateKey.kid,
      payload: {
        sub: this.principal,
        iss: this.principal,
        aud: PARCEL_RUNTIME_AUD,
        scope: this.scopes.join(' '),
      },
      lifetime: this.tokenLifetime,
    });
    return new Token(token, expiry);
  }
}

class Token {
  public constructor(private readonly token: string, private readonly expiry: number) {}

  public static async fromResponse(response: ResponsePromise): Promise<Token> {
    const requestTime = Date.now();
    const body: {
      access_token: string;
      request_time: number;
      expires_in: number;
    } = await (await response).json();
    return new Token(body.access_token, requestTime + body.expires_in * 1000);
  }

  public isExpired(): boolean {
    return this.expiry <= Date.now();
  }

  public toString(): string {
    return this.token;
  }
}

type BaseJWK = {
  kty: string;
  alg: string;
  use?: 'sig';
  kid?: string;
};

export type PrivateES256JWK = BaseJWK & {
  kty: 'EC';
  alg: 'ES256';
  crv: 'P-256';
  x: string;
  y: string;
  d: string;
};
export type PublicES256JWK = Merge<PrivateES256JWK, { d?: void }>;

export type PublicJWK = PublicES256JWK;
export type PrivateJWK = PrivateES256JWK;

export type IdentityTokenClaims = {
  /** The token's subject. */
  sub: string;

  /** The token's issuer. */
  iss: string;
};

export type ClientCredentials = IdentityTokenClaims & {
  privateKey: PrivateJWK;
};

/** Returns the PKCS8-encoded private key and the JWK"s key id. */
function jwkToPem(jwk: PrivateJWK): string {
  if (jwk.kty !== 'EC' || jwk.alg !== 'ES256') {
    throw new Error(`Unsupported private key. Expected \`alg: 'ES256'\` but was \`${jwk.alg}\` }`);
  }

  const kjurJWK = JSON.parse(JSON.stringify(jwk));
  kjurJWK.crv = 'secp256r1'; // KJUR's preferred name for name for P-256
  const privateKey = jsrsasign.KEYUTIL.getPEM(
    jsrsasign.KEYUTIL.getKey(kjurJWK),
    'PKCS8PRV',
  ) as unknown as string; // The type definitions are wrong: they say `void` but it's actually `string`.
  return privateKey;
}

function makeJWT({
  privateKey,
  keyId,
  payload,
  lifetime,
}: {
  /** PKCS8 (PEM)-encoded private key */
  privateKey: string;
  keyId?: string;
  payload: JsonObject;
  /** The token's lifetime in seconds. */
  lifetime: number;
}): string {
  const header = {
    alg: 'ES256',
    typ: 'JWT',
    kid: keyId,
  };

  const now = Math.floor(Date.now() / 1000);
  payload.iat = now - 2 * 60; // Take off a couple of minutes to account for clock skew.
  payload.exp = now + lifetime;

  return jsrsasign.KJUR.jws.JWS.sign(null, header, payload, privateKey);
}
