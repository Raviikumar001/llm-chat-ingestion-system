import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export function loadApiEnv() {
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFilePath);
  const apiRoot = path.resolve(currentDir, '../..');
  const repoRoot = path.resolve(currentDir, '../../../..');

  const envPaths = [
    path.join(repoRoot, '.env'),
    path.join(apiRoot, '.env'),
    path.join(repoRoot, '.env.local'),
    path.join(apiRoot, '.env.local'),
  ];

  for (const envPath of envPaths) {
    dotenv.config({ path: envPath, override: true });
  }
}
