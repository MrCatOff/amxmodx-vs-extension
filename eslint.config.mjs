import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
        },
        rules: {
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
            'no-console': 'off',
            'prefer-const': 'warn',
            'eqeqeq': ['warn', 'always'],
        },
    },
    {
        ignores: ['dist/**', 'out-test/**', 'node_modules/**', '**/*.test.ts', 'esbuild.mjs', 'vitest.config.ts'],
    },
);
