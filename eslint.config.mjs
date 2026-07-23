import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
    },
  },
  globalIgnores(['.next/**', '.open-next/**', '.wrangler/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts', 'worker-configuration.d.ts']),
])
