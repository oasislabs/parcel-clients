// cf. https://github.com/sindresorhus/ky-universal/issues/35

import fetch from 'node-fetch';

globalThis.fetch = fetch;
globalThis.Request = fetch.Request;
globalThis.Response = fetch.Response;
globalThis.Headers = fetch.Headers;