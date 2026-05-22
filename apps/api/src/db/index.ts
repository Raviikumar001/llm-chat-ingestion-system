import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { loadApiEnv } from '../config/load-env';

loadApiEnv();

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ollive';

// For migrations
export const migrationClient = postgres(connectionString, { max: 1 });

// For queries
export const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });
