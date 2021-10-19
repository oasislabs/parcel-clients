module.exports = {
  envs: ['node', 'browser'],
  plugins: ['@typescript-eslint'],
  prettier: true,
  files: ['**/*.ts'],
  ignores: ['bin/**', 'lib/**', 'dist/**'],
  rules: {
    '@typescript-eslint/no-implicit-any-catch': ['error', { allowExplicitAny: true }],
    '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_*' }],

    // These rules warn about operations on `any` typed variables. They're not as
    // useful when `any` is required to be explicit and carefully considered. If
    // the ts-client were rewritten, these rules could be re-enabled.
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',

    '@typescript-eslint/no-namespace': 'off',
    // This rule disallows throwing what TS thinks to be errors, but does not know extends Error.
    '@typescript-eslint/no-throw-literal': 'off',
    'arrow-parens': ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline'],
    'no-unused-vars': 'error',
    'object-curly-spacing': ['error', 'always'],
    // This rule is asinine: suggests renaming interator variable  `i` to `index`.
    'unicorn/prevent-abbreviations': 'off',
    // This rule requires adding `node:` to all builtin module imports, which confuses TS.
    'unicorn/prefer-node-protocol': 'off',
    'max-nested-callbacks': 'off',
    'max-params': 'off',
    'import/no-named-default': 'off',
    // This rule forbids TODO comments.
    'no-warning-comments': 'off',
    // This rule incorrectly triggers if you import a node built-in library without
    // listing it in dependencies in package.json.
    'import/no-extraneous-dependencies': 'off',
    'new-cap': 'off',
    'no-await-in-loop': 'off',
    // Highly dependent on its ability to infer correct types, whihc in turn depends
    // on which of your dependencies are currently built. Too brittle.
    '@typescript-eslint/restrict-template-expressions': 'off',
    // This lint is triggered by the browser tests which are transpiled independently
    // and do not have the `.js` extension because they actually expect `.ts` (and `tsc
    // expressly disallows that extension).
    'node/file-extension-in-import': 'off',
    'node/prefer-global/process': ['error', 'always'],
    'node/prefer-global/buffer': ['error', 'always'],
  },
  space: 2,
  overrides: [
    {
      files: 'test/jest/**/*',
      envs: ['jest'],
    },
    {
      files: ['test/cypress/**/*', 'test/examples/login-with-oasis.spec.js'],
      plugins: ['cypress'],
      envs: ['cypress/globals'],
      rules: {
        '@typescript-eslint/triple-slash-reference': 'off',
      },
    },
    {
      files: '**/*.js',
      plugins: [],
    },
  ],
};
