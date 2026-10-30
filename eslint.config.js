import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/dist-testnet/**', '**/dist-local/**', '**/.wrangler/**', '**/out/**', '**/.next/**', '**/node_modules/**', '**/test-results/**', '**/.fixtures-build/**', 'release/**', '**/next-env.d.ts', 'qa/pages/react-app.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Security: no string evaluation anywhere in the codebase.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Use textContent or React rendering; never innerHTML.' },
        { property: 'outerHTML', message: 'Never write raw HTML.' },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
);
