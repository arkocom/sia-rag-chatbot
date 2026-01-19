-- =============================================================================
-- Migration pour ajouter le support pgvector et la structure optimisée
-- À exécuter après migration vers Supabase/Neon avec pgvector
-- =============================================================================

-- 1. Activer l'extension pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Activer la recherche full-text (déjà inclus dans PostgreSQL)
-- Note: Pour le support arabe avancé, utiliser une configuration personnalisée

-- 3. Ajouter la colonne embedding à la table existante
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS embedding vector(384);

-- 4. Créer l'index vectoriel pour recherche cosine
CREATE INDEX IF NOT EXISTS idx_document_embedding 
ON document_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 5. Ajouter des colonnes pour le texte arabe et les métadonnées enrichies
ALTER TABLE document_chunks
ADD COLUMN IF NOT EXISTS content_arabic TEXT,
ADD COLUMN IF NOT EXISTS grade VARCHAR(50),
ADD COLUMN IF NOT EXISTS themes TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS isnad TEXT;

-- 6. Index pour recherche par thèmes
CREATE INDEX IF NOT EXISTS idx_document_themes 
ON document_chunks USING gin(themes);

-- 7. Index GIN sur les métadonnées JSONB
CREATE INDEX IF NOT EXISTS idx_document_metadata 
ON document_chunks USING gin(metadata);

-- 8. Index pour la recherche full-text français
CREATE INDEX IF NOT EXISTS idx_document_content_fts 
ON document_chunks USING gin(to_tsvector('french', content));

-- =============================================================================
-- TABLE HADITHS COMPLÈTE (pour import futur)
-- =============================================================================

CREATE TABLE IF NOT EXISTS hadiths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identifiants
  hadith_number INTEGER,
  book_number INTEGER,
  chapter_number INTEGER,
  
  -- Textes
  text_arabic TEXT NOT NULL,
  text_french TEXT,
  text_english TEXT,
  
  -- Chaîne de transmission
  isnad TEXT,
  narrator_chain JSONB DEFAULT '[]',
  
  -- Classification
  grade VARCHAR(50),
  graded_by VARCHAR(255),
  
  -- Catégorisation
  source VARCHAR(100) NOT NULL,
  book_name VARCHAR(255),
  chapter_name VARCHAR(255),
  themes TEXT[] DEFAULT '{}',
  
  -- Métadonnées complètes
  metadata JSONB DEFAULT '{}',
  
  -- Embeddings
  embedding_arabic vector(768),
  embedding_french vector(384),
  
  -- Horodatage
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour hadiths
CREATE INDEX IF NOT EXISTS idx_hadith_source ON hadiths(source);
CREATE INDEX IF NOT EXISTS idx_hadith_grade ON hadiths(grade);
CREATE INDEX IF NOT EXISTS idx_hadith_themes ON hadiths USING gin(themes);
CREATE INDEX IF NOT EXISTS idx_hadith_metadata ON hadiths USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_hadith_embedding_fr ON hadiths 
USING ivfflat (embedding_french vector_cosine_ops) WITH (lists = 100);

-- =============================================================================
-- TABLE VERSETS CORAN (pour import futur)
-- =============================================================================

CREATE TABLE IF NOT EXISTS quran_verses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Références
  surah_number INTEGER NOT NULL,
  verse_number INTEGER NOT NULL,
  juz_number INTEGER,
  hizb_number INTEGER,
  page_number INTEGER,
  
  -- Textes
  text_arabic TEXT NOT NULL,
  text_french TEXT,
  text_transliteration TEXT,
  
  -- Métadonnées sourate
  surah_name_arabic VARCHAR(100),
  surah_name_french VARCHAR(100),
  revelation_type VARCHAR(20),
  
  -- Catégorisation
  themes TEXT[] DEFAULT '{}',
  related_verses JSONB DEFAULT '[]',
  
  -- Embedding
  embedding vector(384),
  
  -- Contrainte d'unicité
  UNIQUE(surah_number, verse_number)
);

-- Index pour navigation Coran
CREATE INDEX IF NOT EXISTS idx_quran_nav ON quran_verses(surah_number, verse_number);
CREATE INDEX IF NOT EXISTS idx_quran_themes ON quran_verses USING gin(themes);
CREATE INDEX IF NOT EXISTS idx_quran_embedding ON quran_verses 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- =============================================================================
-- FONCTION DE RECHERCHE SÉMANTIQUE
-- =============================================================================

CREATE OR REPLACE FUNCTION search_similar_documents(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id TEXT,
  content TEXT,
  reference TEXT,
  source TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id::TEXT,
    dc.content,
    dc.reference,
    dc.source,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =============================================================================
-- VUE STATISTIQUES
-- =============================================================================

CREATE OR REPLACE VIEW data_statistics AS
SELECT 
  'document_chunks' as table_name,
  COUNT(*) as total_rows,
  COUNT(embedding) as with_embeddings,
  pg_size_pretty(pg_total_relation_size('document_chunks')) as table_size
FROM document_chunks
UNION ALL
SELECT 
  'hadiths',
  COUNT(*),
  COUNT(embedding_french),
  pg_size_pretty(pg_total_relation_size('hadiths'))
FROM hadiths
UNION ALL
SELECT 
  'quran_verses',
  COUNT(*),
  COUNT(embedding),
  pg_size_pretty(pg_total_relation_size('quran_verses'))
FROM quran_verses;
