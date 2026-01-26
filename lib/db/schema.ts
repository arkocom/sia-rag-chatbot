import {
  pgTable,
  pgEnum,
  text,
  uuid,
  timestamp,
  varchar,
  integer,
  jsonb,
  index,
  real,
  boolean,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { customType } from 'drizzle-orm/pg-core'

// ==================== CUSTOM TYPES ====================

/**
 * Type pgvector personnalisé pour Drizzle.
 * Utilisé pour les embeddings des chunks (1536 dimensions pour text-embedding-3-small).
 */
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)'
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

/**
 * Legacy vector type (768 dimensions) pour la table document_chunks existante.
 */
const vector768 = customType<{ data: number[]; driverData: string }>({
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

// ==================== ENUMS ====================

export const toneEnum = pgEnum('tone', ['neutre', 'pedagogique', 'academique'])
export const fileTypeEnum = pgEnum('file_type', ['pdf', 'txt', 'csv', 'json'])
export const documentStatusEnum = pgEnum('document_status', ['pending', 'processing', 'ready', 'error'])
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system'])

// ==================== LEGACY TABLE ====================
// Maps to existing `document_chunks` table (created by Prisma).
// IDs are CUIDs (text), not UUIDs. Used by current API routes.

export const documentChunks = pgTable(
  'document_chunks',
  {
    id: text('id').primaryKey(),
    content: text('content').notNull(),
    source: text('source').notNull(), // 'coran' | 'hadith' | 'imam'
    reference: text('reference').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    embedding: vector768('embedding'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('document_chunks_source_idx').on(table.source),
    index('document_chunks_created_at_idx').on(table.createdAt),
  ]
)

/**
 * @deprecated Use `documentChunks` instead. Kept for backward compatibility.
 */
export const documents = documentChunks

// ==================== USERS (extends Supabase auth.users) ====================

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(), // matches auth.users.id
    email: varchar('email', { length: 320 }).notNull().unique(),
    fullName: varchar('full_name', { length: 200 }),
    avatarUrl: text('avatar_url'),
    plan: varchar('plan', { length: 20 }).notNull().default('free'), // 'free' | 'pro' | 'enterprise'
    documentsQuota: integer('documents_quota').notNull().default(1000),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('users_email_idx').on(table.email),
    index('users_plan_idx').on(table.plan),
  ]
)

// ==================== AGENTS ====================

export const agents = pgTable(
  'agents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    tone: toneEnum('tone').notNull().default('neutre'),
    systemPrompt: text('system_prompt'),
    temperature: real('temperature').notNull().default(0.1),
    maxSources: integer('max_sources').notNull().default(20),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('agents_user_id_idx').on(table.userId),
    index('agents_tone_idx').on(table.tone),
  ]
)

// ==================== SAAS DOCUMENTS (uploaded files) ====================

export const saasDocuments = pgTable(
  'saas_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 500 }).notNull(),
    fileType: fileTypeEnum('file_type').notNull(),
    fileUrl: text('file_url'),
    fileSize: integer('file_size'), // bytes
    status: documentStatusEnum('status').notNull().default('pending'),
    chunkCount: integer('chunk_count').notNull().default(0),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('saas_documents_user_id_idx').on(table.userId),
    index('saas_documents_agent_id_idx').on(table.agentId),
    index('saas_documents_status_idx').on(table.status),
    index('saas_documents_file_type_idx').on(table.fileType),
  ]
)

// ==================== CHUNKS (text segments with vector embeddings) ====================

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    documentId: uuid('document_id').notNull().references(() => saasDocuments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    source: text('source').notNull(), // 'coran' | 'hadith' | 'imam' | custom
    reference: text('reference').notNull(),
    chunkIndex: integer('chunk_index').notNull().default(0),
    tokenCount: integer('token_count'),
    embedding: vector('embedding'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('chunks_document_id_idx').on(table.documentId),
    index('chunks_user_id_idx').on(table.userId),
    index('chunks_source_idx').on(table.source),
    // HNSW index for vector similarity search
    // Created via raw SQL migration: CREATE INDEX chunks_embedding_hnsw_idx ON chunks USING hnsw (embedding vector_cosine_ops)
  ]
)

// ==================== CONVERSATIONS ====================

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 500 }),
    messageCount: integer('message_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('conversations_user_id_idx').on(table.userId),
    index('conversations_agent_id_idx').on(table.agentId),
    index('conversations_updated_at_idx').on(table.updatedAt),
  ]
)

// ==================== MESSAGES ====================

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    role: messageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    citations: jsonb('citations').$type<Array<{
      chunkId: string
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
      tokenCount?: number
    }>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('messages_conversation_id_idx').on(table.conversationId),
    index('messages_role_idx').on(table.role),
    index('messages_created_at_idx').on(table.createdAt),
  ]
)

// ==================== RELATIONS ====================

export const usersRelations = relations(users, ({ many }) => ({
  agents: many(agents),
  saasDocuments: many(saasDocuments),
  chunks: many(chunks),
  conversations: many(conversations),
}))

export const agentsRelations = relations(agents, ({ one, many }) => ({
  user: one(users, { fields: [agents.userId], references: [users.id] }),
  saasDocuments: many(saasDocuments),
  conversations: many(conversations),
}))

export const saasDocumentsRelations = relations(saasDocuments, ({ one, many }) => ({
  user: one(users, { fields: [saasDocuments.userId], references: [users.id] }),
  agent: one(agents, { fields: [saasDocuments.agentId], references: [agents.id] }),
  chunks: many(chunks),
}))

export const chunksRelations = relations(chunks, ({ one }) => ({
  document: one(saasDocuments, { fields: [chunks.documentId], references: [saasDocuments.id] }),
  user: one(users, { fields: [chunks.userId], references: [users.id] }),
}))

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
  agent: one(agents, { fields: [conversations.agentId], references: [agents.id] }),
  messages: many(messages),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}))

// ==================== INFERRED TYPES ====================

// Legacy types (existing document_chunks table)
export type DocumentChunk = typeof documentChunks.$inferSelect
export type NewDocumentChunk = typeof documentChunks.$inferInsert

// User types
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

// Agent types
export type Agent = typeof agents.$inferSelect
export type NewAgent = typeof agents.$inferInsert

// SaaS Document types (uploaded files)
export type SaasDocument = typeof saasDocuments.$inferSelect
export type NewSaasDocument = typeof saasDocuments.$inferInsert

// Chunk types (text segments with embeddings)
export type Chunk = typeof chunks.$inferSelect
export type NewChunk = typeof chunks.$inferInsert

// Conversation types
export type Conversation = typeof conversations.$inferSelect
export type NewConversation = typeof conversations.$inferInsert

// Message types
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert

// Legacy aliases
/** @deprecated Use DocumentChunk instead */
export type Document = DocumentChunk
/** @deprecated Use NewDocumentChunk instead */
export type NewDocument = NewDocumentChunk
/** @deprecated Use User instead */
export type Profile = User
/** @deprecated Use NewUser instead */
export type NewProfile = NewUser
