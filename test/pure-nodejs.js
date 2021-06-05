/**
 * Checks if importing Parcel works in different NodeJS versions.
 */
import { Parcel } from '../lib/index.js';

const apiUrl = process.env.PARCEL_API_URL ?? 'http://localhost:4242/v1';
const parcel = new Parcel('not required in dev mode when identity creation is unauthenticated', {
  apiUrl,
});
console.assert(parcel);
