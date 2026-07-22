import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './lib/db/schema.d1.ts',
  out: './migrations/d1',
})
