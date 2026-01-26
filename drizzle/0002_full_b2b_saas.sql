-- Migration: Full B2B SaaS schema
-- Creates users, agents, saas_documents, chunks, conversations, messages
-- Run in Supabase SQL Editor
--
-- This script drops and recreates the new tables (NOT document_chunks).

-- ============================================================
-- 0. Clean slate: drop new tables if they exist (reverse order)
--    NOTE: document_chunks is NOT dropped (contains 6,372 real rows)
-- ============================================================

DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS chunks CASCADE;
DROP TABLE IF EXISTS saas_documents CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS message_role CASCADE;
DROP TYPE IF EXISTS document_status CASCADE;
DROP TYPE IF EXISTS file_type CASCADE;
DROP TYPE IF EXISTS tone CASCADE;

-- ============================================================
-- 1. Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 2. Enums
-- ============================================================

CREATE TYPE tone AS ENUM ('neutre', 'pedagogique', 'academique');
CREATE TYPE file_type AS ENUM ('pdf', 'txt', 'csv', 'json');
CREATE TYPE document_status AS ENUM ('pending', 'processing', 'ready', 'error');
CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');

-- ============================================================
-- 3. Users table (extends Supabase auth.users)
-- ============================================================

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(320) NOT NULL UNIQUE,
  full_name VARCHAR(200),
  avatar_url TEXT,
  plan VARCHAR(20) NOT NULL DEFAULT 'free',
  documents_quota INTEGER NOT NULL DEFAULT 1000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_plan_idx ON users(plan);

-- ============================================================
-- 4. Agents table
-- ============================================================

CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  tone tone NOT NULL DEFAULT 'neutre',
  system_prompt TEXT,
  temperature REAL NOT NULL DEFAULT 0.1,
  max_sources INTEGER NOT NULL DEFAULT 20,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX agents_user_id_idx ON agents(user_id);
CREATE INDEX agents_tone_idx ON agents(tone);

-- ============================================================
-- 5. SaaS Documents table (uploaded files)
-- ============================================================

CREATE TABLE saas_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  file_type file_type NOT NULL,
  file_url TEXT,
  file_size INTEGER,
  status document_status NOT NULL DEFAULT 'pending',
  chunk_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX saas_documents_user_id_idx ON saas_documents(user_id);
CREATE INDEX saas_documents_agent_id_idx ON saas_documents(agent_id);
CREATE INDEX saas_documents_status_idx ON saas_documents(status);
CREATE INDEX saas_documents_file_type_idx ON saas_documents(file_type);

-- ============================================================
-- 6. Chunks table (text segments with vector embeddings)
-- ============================================================

CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES saas_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  reference TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX chunks_document_id_idx ON chunks(document_id);
CREATE INDEX chunks_user_id_idx ON chunks(user_id);
CREATE INDEX chunks_source_idx ON chunks(source);

-- HNSW index for fast vector similarity search (cosine distance)
CREATE INDEX chunks_embedding_hnsw_idx
  ON chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- 7. Conversations table
-- ============================================================

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  title VARCHAR(500),
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX conversations_user_id_idx ON conversations(user_id);
CREATE INDEX conversations_agent_id_idx ON conversations(agent_id);
CREATE INDEX conversations_updated_at_idx ON conversations(updated_at);

-- ============================================================
-- 8. Messages table
-- ============================================================

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role message_role NOT NULL,
  content TEXT NOT NULL,
  citations JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX messages_conversation_id_idx ON messages(conversation_id);
CREATE INDEX messages_role_idx ON messages(role);
CREATE INDEX messages_created_at_idx ON messages(created_at);

-- ============================================================
-- 9. Add user_id to legacy document_chunks table
-- ============================================================

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================
-- 10. Row Level Security (RLS)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Users: own profile only
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE USING (auth.uid() = id);

-- Agents: own agents only
CREATE POLICY "Users can view own agents"
  ON agents FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own agents"
  ON agents FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agents"
  ON agents FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own agents"
  ON agents FOR DELETE USING (auth.uid() = user_id);

-- SaaS Documents: own documents only
CREATE POLICY "Users can view own saas_documents"
  ON saas_documents FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saas_documents"
  ON saas_documents FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saas_documents"
  ON saas_documents FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saas_documents"
  ON saas_documents FOR DELETE USING (auth.uid() = user_id);

-- Chunks: own chunks only
CREATE POLICY "Users can view own chunks"
  ON chunks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chunks"
  ON chunks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chunks"
  ON chunks FOR DELETE USING (auth.uid() = user_id);

-- Legacy document_chunks: own documents only
CREATE POLICY "Users can view own document_chunks"
  ON document_chunks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own document_chunks"
  ON document_chunks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own document_chunks"
  ON document_chunks FOR DELETE USING (auth.uid() = user_id);

-- Conversations: own conversations only
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE USING (auth.uid() = user_id);

-- Messages: via conversation ownership
CREATE POLICY "Users can view messages in own conversations"
  ON messages FOR SELECT USING (
    conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert messages in own conversations"
  ON messages FOR INSERT WITH CHECK (
    conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())
  );

-- ============================================================
-- 11. Auto-create user profile on signup (trigger)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 12. Auto-update updated_at timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_saas_documents_updated_at
  BEFORE UPDATE ON saas_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
