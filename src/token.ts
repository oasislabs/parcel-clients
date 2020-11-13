import axios, { AxiosResponse } from 'axios';
import { KEYUTIL, KJUR } from 'jsrsasign';
import type { Except, JsonObject } from 'type-fest';

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
        if (this.token === undefined || this.token.isExpired())
            this.token = await this.renewToken();
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

export type RenewingTokenProviderParams = {
    clientId: string;

    privateKey: PrivateJWK;

    /**
     * The identity provider's OAuth token retrieval endpoint.
     * If left undefined, the access token will be self-signed with the `clientId`
     * as the issuer.
     */
    tokenEndpoint: string;

    /**
     * A list of scopes that will be requested from the identity provider, which
     * may be different from the scopes that the identity provider actually returns.
     */
    scopes: string[];
};

/** A `TokenProvider` that obtains a new token by re-authenticating to the issuer. */
export class RenewingTokenProvider extends ExpiringTokenProvider {
    private readonly clientId: string;
    private readonly tokenEndpoint: string;
    private readonly scopes: string[];
    private readonly privateKey: string; // PKCS8-encoded
    private readonly keyId: string;

    private readonly clientAssertionLifetime = 1 * 60 * 60; // 1 hour

    public constructor({
        clientId,
        privateKey: privateJWK,
        scopes,
        tokenEndpoint,
    }: RenewingTokenProviderParams) {
        super();

        const { privateKey, keyId } = jwkToPem(privateJWK);
        this.privateKey = privateKey;
        this.keyId = keyId;

        this.clientId = clientId;
        this.tokenEndpoint = tokenEndpoint;
        this.scopes = scopes;
    }

    protected async renewToken(): Promise<Token> {
        const clientAssertion = makeJWT({
            privateKey: this.privateKey,
            keyId: this.keyId,
            payload: {
                sub: this.clientId,
                iss: this.clientId,
                aud: this.tokenEndpoint,
                jti: KJUR.crypto.Util.getRandomHexOfNbytes(8),
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

        return Token.fromResponse(axios.post(this.tokenEndpoint, authParams));
    }
}

export type RefreshingTokenProviderParams = {
    refreshToken: string;
    tokenEndpoint: string;
};

/** A `TokenProvider` that obtains a new token using a refresh token. */
export class RefreshingTokenProvider extends ExpiringTokenProvider {
    private refreshToken: string;
    private readonly tokenEndpoint: string;

    public constructor({ refreshToken, tokenEndpoint }: RefreshingTokenProviderParams) {
        super();
        this.refreshToken = refreshToken;
        this.tokenEndpoint = tokenEndpoint;
    }

    protected async renewToken(): Promise<Token> {
        const refreshParams = new URLSearchParams();
        refreshParams.append('grant_type', 'refresh_token');
        refreshParams.append('refresh_token', this.refreshToken);

        return Token.fromResponse(
            axios.post(this.tokenEndpoint, refreshParams).then((refreshResponse) => {
                this.refreshToken = refreshResponse.data.refresh_token;
                return refreshResponse;
            }),
        );
    }
}

export type SelfIssuedTokenProviderParams = {
    /** The `sub` and `iss` claims of the provided access token. */
    principal: string;

    /** The private key that will be used to sign the access token. */
    privateKey: PrivateJWK;

    /**
     * A list of scopes that will be added as claims.
     * The default is all scopes.
     */
    scopes?: string[];

    /**
     * Duration for which the issued token is valid, in seconds.
     * Defaults to one hour;
     */
    tokenLifetime?: number;
};

/** A `TokenProvider` that self-signs an access token. */
export class SelfIssuedTokenProvider extends ExpiringTokenProvider {
    private readonly principal: string;
    private readonly privateKey: string;
    private readonly keyId: string;
    private readonly scopes: string[];
    private readonly tokenLifetime: number;

    public constructor({
        principal,
        privateKey: privateJWK,
        scopes,
        tokenLifetime,
    }: SelfIssuedTokenProviderParams) {
        super();

        const { privateKey, keyId } = jwkToPem(privateJWK);
        this.privateKey = privateKey;
        this.keyId = keyId;

        this.principal = principal;
        this.scopes = scopes ?? ['parcel.*'];
        this.tokenLifetime = tokenLifetime ?? 1 * 60 * 60 /* one hour */;
    }

    protected async renewToken(): Promise<Token> {
        const expiry = Date.now() / 1000 + this.tokenLifetime;
        const token = makeJWT({
            privateKey: this.privateKey,
            keyId: this.keyId,
            payload: {
                sub: this.principal,
                iss: this.principal,
                aud: 'parcel-runtime',
                scope: this.scopes,
            },
            lifetime: this.tokenLifetime,
        });
        return new Token(token, expiry);
    }
}

class Token {
    public constructor(private readonly token: string, private readonly expiry: number) {}

    public static async fromResponse(response: Promise<AxiosResponse>): Promise<Token> {
        const requestTime = Date.now();
        const body = (await response).data;
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
export type PublicES256JWK = Except<PrivateES256JWK, 'd'>;

export type PublicJWK = PublicES256JWK;
export type PrivateJWK = PrivateES256JWK;

export type OidcTokenClaims = {
    /** The token's subject. */
    sub: string;

    /** The token's issuer. */
    iss: string;
};

export type ClientCredentials = OidcTokenClaims & {
    privateKey: PrivateJWK;
};

/** Returns the PKCS8-encoded private key and the JWK"s key id. */
function jwkToPem(jwk: PrivateJWK): { privateKey: string; keyId: string } {
    if (jwk.kty !== 'EC' || jwk.alg !== 'ES256') {
        throw new Error(
            `Unsupported private key. Expected \`alg: 'ES256'\` but was \`${jwk.alg}\` }`,
        );
    }

    const kjurJWK = JSON.parse(JSON.stringify(jwk));
    const keyId = jwk.kid ?? KJUR.jws.JWS.getJWKthumbprint(kjurJWK);
    kjurJWK.crv = 'secp256r1'; // KJUR's preferred name for name for P-256
    const privateKey = (KEYUTIL.getPEM(KEYUTIL.getKey(kjurJWK), 'PKCS8PRV') as unknown) as string; // The type definitions are wrong: they say `void` but it's actually `string`.
    return {
        privateKey,
        keyId,
    };
}

function makeJWT({
    privateKey,
    keyId,
    payload,
    lifetime,
}: {
    /** PKCS8 (PEM)-encoded private key */
    privateKey: string;
    keyId: string;
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
    payload.iat = now;
    payload.exp = now + lifetime;

    return KJUR.jws.JWS.sign(null, header, payload, privateKey);
}
