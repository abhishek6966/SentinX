// =============================================================================
// SentinX — Database Connection Manager
// PostgreSQL via Supabase (Drizzle ORM) + MongoDB Atlas
// =============================================================================
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import * as schema from '../db/schema';

let pgPool: Pool;
export let db: ReturnType<typeof drizzle>;

export async function connectDatabases(): Promise<void> {
  await connectPostgres();
  await connectMongo();
}

async function connectPostgres(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  pgPool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  // Test connection
  const client = await pgPool.connect();
  await client.query('SELECT 1');
  client.release();

  db = drizzle(pgPool, { schema });
  logger.info('PostgreSQL connection established');
}

async function connectMongo(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  await mongoose.connect(uri, {
    dbName: 'sentinx',
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
  });

  logger.info('MongoDB Atlas connection established');
}

export async function disconnectDatabases(): Promise<void> {
  if (pgPool) await pgPool.end();
  await mongoose.disconnect();
  logger.info('All database connections closed');
}
