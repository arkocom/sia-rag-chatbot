import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * Client PostgreSQL pour Drizzle.
 * Utilise postgres.js (driver léger, compatible Edge).
 */
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL est obligatoire. Voir .env.example.')
}

// Client pour les requêtes (pool de connexions)
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

/**
 * Instance Drizzle typée avec le schema complet.
 * Usage: import { db } from '@/lib/db'
 */
export const db = drizzle(client, { schema })
