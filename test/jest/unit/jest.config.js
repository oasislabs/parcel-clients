import commonConfig from '../../jest.config.js';

/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
  ...commonConfig,
  rootDir: '../../..',
  roots: ['<rootDir>/test/jest/unit'],
};

export default config;
