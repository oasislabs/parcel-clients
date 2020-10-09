module.exports = {
    envs: ['node', 'browser', 'jest'],
    prettier: true,
    rules: {
        'arrow-parens': ['error', 'always'],
        'comma-dangle': ['error', 'always-multiline'],
        'object-curly-spacing': ['error', 'always'],
        'unicorn/prevent-abbreviations': ['error', { replacements: { cb: false, params: false } }],
    },
    space: 4,
};
