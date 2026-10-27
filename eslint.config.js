// @ts-check
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import { createNodeResolver, importX } from 'eslint-plugin-import-x'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.verify', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  reactHooks.configs.flat['recommended-latest'],
  importX.flatConfigs.typescript,
  {
    files: ['**/*.{ts,tsx,js}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver-next': [createNodeResolver({ extensions: ['.ts', '.tsx', '.js', '.json'] })],
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'import-x/no-cycle': ['error', { ignoreExternal: true }],
      'import-x/no-unresolved': 'error',
      'import-x/no-self-import': 'error',
      'import-x/no-duplicates': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Architecture boundary: the core never depends on concrete plugins, blocks or the app.
    files: ['src/editor/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/plugins',
                '**/plugins/**',
                '**/blocks',
                '**/blocks/**',
                '**/app',
                '**/app/**',
                '**/content/**',
                '**/utils/**',
              ],
              message: 'editor/core must stay independent of plugins, blocks and the app.',
            },
          ],
        },
      ],
    },
  },
  {
    // Plugins and blocks use the core only through its public entry point.
    files: ['src/plugins/**/*.{ts,tsx}', 'src/blocks/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}', 'src/utils/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/editor/core/*', '!**/editor/core/index'],
              message: "Import from 'editor/core' (public API) only.",
            },
          ],
        },
      ],
    },
  },
  prettier,
)
