import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const repoRoot = path.resolve(currentDir, '../..');

for (const envPath of [
  path.join(repoRoot, '.env'),
  path.join(currentDir, '.env'),
  path.join(repoRoot, '.env.local'),
  path.join(currentDir, '.env.local'),
]) {
  dotenv.config({ path: envPath, override: true });
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ollive',
  },
});
