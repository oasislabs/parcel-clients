module.exports = {
    envs: ['node', 'browser'],
    plugins: ['@typescript-eslint'],
    prettier: true,
    rules: {
        '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_*' }],
        'arrow-parens': ['error', 'always'],
        'comma-dangle': ['error', 'always-multiline'],
        'no-unused-vars': 'error',
        'object-curly-spacing': ['error', 'always'],
        'unicorn/prevent-abbreviations': [
            'error',
            { replacements: { cb: false, params: false, req: false, res: false } },
        ],
        'max-nested-callbacks': 'off',
    },
    space: 4,
    overrides: [
        {
            files: 'test/unit/**/*',
            envs: ['jest'],
        },
        {
            files: 'test/cypress/**/*',
            plugins: ['cypress'],
            envs: ['cypress/globals'],
        },
    ],
};
