// Import { Buffer } from 'buffer';
// import { randomBytes } from 'tweetnacl';
// import crypto from 'crypto';
// import jwkToPem from 'jwk-to-pem';
// import jwt from 'jsonwebtoken';
//
// export const PARCEL_AUD = 'https://api.oasislabs.com/parcel';

/**
 * A `TokenProvider` hands out OAuth access tokens.
 */
export interface TokenProvider {
    /**
     * Returns a valid Bearer token to be presented to the Parcel gateway.
     */
    getToken: () => Promise<string>;
}

/**
 * A `TokenProvider` that always returns the same, initially provided token
 */
export class StaticTokenProvider implements TokenProvider {
    public constructor(private readonly token: string) {}

    public async getToken(): Promise<string> {
        return this.token;
    }
}

// Export enum TokenScope {
//     Api = 'parcel.temp_api',
//     Ipfs = 'parcel.temp_ipfs',
//     GCP = 'https://www.googleapis.com/auth/devstorage.read_write',
// }
//
// /**
//  * A renewing token provider obtains a new access token when the current one has expired.
//  */
// /* Note: we could use the openid-client NPM package, but it's massive
//  * overkill for what we want, which is simply `fetch`ing the /token endpoint.
//  */
// export class RenewingTokenProvider implements TokenProvider {
//     private currentToken: Token = new Token('', 0);
//
//     private constructor(
//         private tokenEndpoint: string,
//         private makeRefreshRequestParams: () => any,
//         private handleRefreshResponse: (
//             response: Promise<Response>,
//         ) => Promise<Token> = Token.fromResponse,
//     ) {}
//
//     /**
//      * Returns a new `RenewingTokenProvider` that obtains new access tokens to
//      * https://api.oasislabs.com/parcel by presenting a client assertion to `tokenEndpoint`.
//      * The client assertion token is signed using your API access token; you will need to
//      * also provide your `clientId` and signing JWK.
//      */
//     public static fromJWK({
//         clientId,
//         privateKey,
//         tokenEndpoint,
//         scopes,
//         expiresIn = '1h',
//     }: {
//         clientId: string;
//         privateKey: string;
//         tokenEndpoint: string;
//         scopes: TokenScope[];
//         expiresIn?: string;
//     }): RenewingTokenProvider {
//         const privateJwk = JSON.parse(privateKey);
//         if (privateJwk.kty !== 'EC') {
//             throw new Error('Private key should be an ECDSA key.');
//         }
//         if (!privateJwk.kid) {
//             privateJwk.kid = getKeyThumbprint(privateJwk);
//         }
//         const makeRefreshRequestParams = () => {
//             const clientAssertion = jwt.sign({}, jwkToPem(privateJwk, { private: true }), {
//                 subject: clientId,
//                 issuer: clientId,
//                 keyid: privateJwk.kid,
//                 algorithm: 'ES256',
//                 audience: tokenEndpoint,
//                 expiresIn: expiresIn,
//                 jwtid: Buffer.from(randomBytes(8)).toString('base64'),
//             });
//             /* eslint-disable @typescript-eslint/camelcase */
//             return {
//                 grant_type: 'client_credentials',
//                 scope: scopes.join(' '),
//                 audience: PARCEL_AUD,
//                 client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
//                 client_assertion: clientAssertion,
//             };
//             /* eslint-enable @typescript-eslint/camelcase */
//         };
//         return new RenewingTokenProvider(tokenEndpoint, makeRefreshRequestParams);
//     }
//
//     /**
//      * Returns a new `RenewingTokenProvider` that obtains new access tokens to
//      * https://api.oasislabs.com/parcel by presenting a client assertion to `tokenEndpoint`.
//      * The client assertion token is signed using your API access token; you will need to
//      * also provide your `clientId` and client secret in PEM format.
//      */
//     public static fromPrivatePEM({
//         clientId,
//         clientSecret,
//         tokenEndpoint,
//         scopes,
//         expiresIn = '1h',
//     }: {
//         clientId: string;
//         clientSecret: string;
//         tokenEndpoint: string;
//         scopes: TokenScope[];
//         expiresIn?: string;
//     }): RenewingTokenProvider {
//         const makeRefreshRequestParams = () => {
//             const payload = {
//                 iss: clientId,
//                 scope: scopes.join(' '),
//                 aud: tokenEndpoint,
//             };
//             const clientAssertion = jwt.sign(payload, clientSecret, {
//                 algorithm: 'RS256',
//                 expiresIn: expiresIn,
//             });
//             /* eslint-disable @typescript-eslint/camelcase */
//             return {
//                 grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
//                 assertion: clientAssertion,
//             };
//             /* eslint-enable @typescript-eslint/camelcase */
//         };
//         return new RenewingTokenProvider(tokenEndpoint, makeRefreshRequestParams);
//     }
//
//     /**
//      * Returns a new `RenewingTokenProvider` that obtains new access tokens
//      * by presenting a non-expired refresh token.
//      */
//     public static fromRefreshToken({
//         refreshToken,
//         tokenEndpoint,
//     }: {
//         refreshToken: string;
//         tokenEndpoint: string;
//     }): RenewingTokenProvider {
//         /* eslint-disable @typescript-eslint/camelcase */
//         const makeRefreshRequestParams = () => {
//             return {
//                 grant_type: 'refresh_token',
//                 refresh_token: refreshToken,
//             };
//         };
//         const handleRefreshResponse = async (resP: Promise<Response>) => {
//             const requestTime = Date.now();
//             const res = await resP.then(checkResponseStatus);
//             const body = await res.json();
//             refreshToken = body.refresh_token;
//             return Token.fromResponseBody(body, requestTime);
//         };
//         /* eslint-enable @typescript-eslint/camelcase */
//         return new RenewingTokenProvider(
//             tokenEndpoint,
//             makeRefreshRequestParams,
//             handleRefreshResponse,
//         );
//     }
//
//     public async getToken(): Promise<string> {
//         if (this.currentToken.isExpired()) {
//             this.currentToken = await this.refreshToken();
//         }
//         return this.currentToken.token;
//     }
//
//     private async refreshToken(): Promise<Token> {
//         const params = this.makeRefreshRequestParams();
//
//         const form = new URLSearchParams();
//         Object.keys(params).forEach((key) => {
//             form.append(key, params[key]);
//         });
//
//         return this.handleRefreshResponse(
//             fetch(this.tokenEndpoint, {
//                 method: 'POST',
//                 body: form,
//             }),
//         );
//     }
// }
//
// class Token {
//     public constructor(readonly token: string, readonly expiry: number) {}
//
//     public static async fromResponse(resP: Promise<Response>): Promise<Token> {
//         const res = await resP.then(checkResponseStatus);
//         return Token.fromResponseBody(await res.json(), Date.now());
//     }
//
//     public static fromResponseBody(
//         /* eslint-disable @typescript-eslint/camelcase */
//         {
//             access_token: accessToken,
//             expires_in: expiresIn,
//         }: { access_token: string; expires_in: number },
//         /* eslint-enable @typescript-eslint/camelcase */
//         requestTime: number,
//     ): Token {
//         return new Token(accessToken, requestTime + expiresIn * 1000);
//     }
//
//     public isExpired(): boolean {
//         return this.expiry <= Date.now();
//     }
// }
//
// function checkResponseStatus(res: Response): Response {
//     if (!res.ok) {
//         throw new Error(`auth token fetch failed with status ${res.status}`);
//     }
//     return res;
// }
//
// function getKeyThumbprint(jwk: jwkToPem.EC): string {
//     const json = JSON.stringify(
//         {
//             crv: jwk.crv,
//             kty: jwk.kty,
//             x: jwk.x,
//             y: jwk.y,
//         },
//         // Keys should be stringified in an alphabetical order.
//         ['crv', 'kty', 'x', 'y'],
//     );
//     const digest = crypto.createHash('sha256').update(json).digest();
//     // base64url encoding.
//     return digest.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
// }

export type ES256JWK = {
    kty: 'EC';
    alg: 'ES256';
    crv: 'P-256';
    x: string;
    y: string;
    d: string;
    use?: 'sig';
    kid?: string;
};

export type RS256JWK = {
    kty: 'RSA';
    alg: 'RS256';
    d: string;
    e?: 'AQAB';
    p: string;
    q: string;
    dp: string;
    dq: string;
    qi: string;
    use?: 'sig';
    kid?: string;
};

export type HS256JWK = {
    kty: 'oct';
    alg: 'HS256';
    k: string;
    use?: 'sig';
    kid?: string;
};

export type ClientJWK = ES256JWK | RS256JWK | HS256JWK;
