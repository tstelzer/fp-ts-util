module.exports = {
    env: {
        browser: false,
        commonjs: true,
        node: true,
        jest: true,
        es6: true,
    },
    plugins: ['prettier', '@typescript-eslint'],
    extends: [
        'plugin:@typescript-eslint/recommended',
        'prettier/@typescript-eslint',
        'plugin:prettier/recommended',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaFeatures: {
            jsx: false,
            ecmaVersion: 8,
            impliedStrict: true,
            experimentalObjectRestSpread: true,
        },
        useJSXTextNode: false,
        sourceType: 'module',
        project: [
            'tsconfig.json',
            'tsconfig.test.json'
        ],
        tsconfigRootDir: '.',
        warnOnUnsupportedTypeScriptVersion: false,
    },
    rules: {
        'prettier/prettier': 'error',
        'no-const-assign': 'warn',
        'no-this-before-super': 'warn',
        'no-undef': 'error',
        'no-unreachable': 'error',
        'constructor-super': 'warn',
        'valid-typeof': 'warn',
        'no-debugger': 'off',
        'no-console': 'warn',
        'padding-line-between-statements': [
            'error',
            {
                blankLine: 'any',
                prev: ['const', 'let', 'var'],
                next: ['const', 'let', 'var'],
            },
        ],
        '@typescript-eslint/prefer-interface': 'off',
    },
};
