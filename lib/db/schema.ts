import {
  pgTable,
  text,
  uuid,
  timestamp,
  varchar,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { customType } from 'drizzle-orm/pg-core'

// ==================== CUSTOM TYPES ====================

/**
 * Type pgvector personnalisé pour Drizzle.
 * Stocke des embeddings sous forme vector(768).
 */
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(768)'
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`
  },
  fromDriver(value: string): number[] {
    return value
      .slice(1, -1)
      .split(',')
      .map(Number)
  },
})

// ==================== DOCUMENTS ====================
// Maps to existing `document_chunks` table (created by Prisma).
// IDs are CUIDs (text), not UUIDs.
// user_id will be added in a future migration when auth is implemented.

export const documents = pgTable(
  'document_chunks',
  {
    id: text('id').primaryKey(),
    content: text('content').notNull(),
    source: text('source').notNull(), // 'coran' | 'hadith' | 'imam'
    reference: text('reference').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    embedding: vector('embedding'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('document_chunks_source_idx').on(table.source),
    index('document_chunks_created_at_idx').on(table.createdAt),
  ]
)

// ==================== PROFILES (extends Supabase Auth) ====================
// Will be created when auth is implemented.

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // matches auth.users.id
  email: varchar('email', { length: 320 }).notNull(),
  fullName: varchar('full_name', { length: 200 }),
  plan: varchar('plan', { length: 20 }).notNull().default('free'), // 'free' | 'pro' | 'enterprise'
  documentsQuota: integer('documents_quota').notNull().default(1000),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ==================== CONVERSATIONS ====================
// Will be created when auth is implemented.

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_conversations_user_id').on(table.userId),
  ]
)

// ==================== MESSAGES ====================
// Will be created when auth is implemented.

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(), // 'user' | 'assistant'
    content: text('content').notNull(),
    sources: jsonb('sources').$type<Array<{
      documentId: string
      reference: string
      sourceType: string
      snippet: string
      score: number
    }>>(),
    metadata: jsonb('metadata').$type<{
      processingTimeMs?: number
      sourcesSearched?: number
      sourcesSelected?: number
      model?: string
    }>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_messages_conversation_id').on(table.conversationId),
  ]
)

// ==================== TYPES INFÉRÉS ====================

export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert
export type Conversation = typeof conversations.$inferSelect
export type NewConversation = typeof conversations.$inferInsert
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
