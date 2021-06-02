import { parseCaps, Capabilities, stringifyCaps } from '@oasislabs/parcel/grant';

describe('Capabilities', () => {
  it('parse', () => {
    expect(parseCaps('')).toEqual(Capabilities.None);
    expect(parseCaps('read')).toEqual(Capabilities.Read);
    expect(parseCaps('read extend ')).toEqual(Capabilities.Read | Capabilities.Extend);
  });

  it('stringify', () => {
    expect(stringifyCaps(Capabilities.None)).toEqual('');
    expect(stringifyCaps(Capabilities.Read)).toEqual('read');
    expect(stringifyCaps(Capabilities.Read | Capabilities.Extend)).toEqual('read extend');
  });
});
