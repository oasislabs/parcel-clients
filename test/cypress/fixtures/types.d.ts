// Load cypress global types
/// <reference types="cypress" />

// Set window.Parcel type
import { Parcel } from '../../../src';
type ParcelClass = typeof Parcel;
declare global {
  interface Window {
    Parcel: ParcelClass;
  }
}
