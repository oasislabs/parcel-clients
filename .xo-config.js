module.exports = {
    envs: ['node', 'browser', 'jest'],
    extends: ['plugin:cypress/recommended'],
    plugins: ['@typescript-eslint'],
    prettier: true,
    rules: {
        '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_*' }],
        'arrow-parens': ['error', 'always'],
        'comma-dangle': ['error', 'always-multiline'],
        'no-unused-vars': 'off', // Subsumed by `@typescript-eslint/no-unused-vars`
        'object-curly-spacing': ['error', 'always'],
        'unicorn/prevent-abbreviations': [
            'error',
            { replacements: { cb: false, params: false, req: false, res: false } },
        ],
    },
    space: 4,
};
