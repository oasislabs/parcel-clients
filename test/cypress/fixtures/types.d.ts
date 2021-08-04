// Load cypress global types
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="cypress" />

// Set window.Parcel type
import { Parcel } from '../../../src';

type ParcelClass = typeof Parcel;
declare global {
  interface Window {
    Parcel: ParcelClass;
  }
}
