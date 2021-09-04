import commonConfig from '../../jest.config.js';

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
  ...commonConfig,
  rootDir: '../../..',
  roots: ['<rootDir>/test/jest/integration'],
  moduleNameMapper: {
    // Override moduleNameMapper to remove `@oasislabs/parcel => src/index`
    // mappings, otherwise importing '../../..' imports `lib/index.d.ts` and
    // causes duplicate conflicting ky Response declaration.

    // Override using bundle.cjs because jest uses package.json "main".
    // Jest + bundle.cjs causes Segmentation Fault when downloading.
    // TODO: https://gitlab.com/oasislabs/parcel/-/issues/740
    '^\\.\\./\\.\\./\\.\\.$': '<rootDir>/lib/index',
  },
};

export default config;
