/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
  rootDir: '../',
  coverageDirectory: 'coverage/jest',
  coveragePathIgnorePatterns: ['test/*'],
  coverageReporters: ['lcov', 'text', 'cobertura'],
  moduleFileExtensions: ['js', 'ts'],
  moduleNameMapper: {
    '^@oasislabs/parcel$': '<rootDir>/src/index',
    '^\\./(app|asset|client|compute|condition|database|document|grant|http|identity|meter|model|permission|polyfill|token|tokenization).js$':
      '<rootDir>/src/$1',
    '^@oasislabs/parcel/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '\\.ts$': 'ts-jest',
    '\\.js$': 'babel-jest',
  },
  transformIgnorePatterns: ['<rootDir>/node_modules/?!(ky|node-fetch)'],
};

export default config;
