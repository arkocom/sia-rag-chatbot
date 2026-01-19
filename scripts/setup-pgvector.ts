/**
 * Script de configuration pgvector pour Supabase
 * À exécuter après `prisma db push`
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setup() {
  console.log('\n========================================');
  console.log('  CONFIGURATION PGVECTOR');
  console.log('========================================\n');

  try {
    // 1. Activer l'extension vector
    console.log('🔧 Activation de pgvector...');
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('✅ Extension pgvector activée!');

    // 2. Activer les extensions utiles
    console.log('\n🔧 Activation des extensions additionnelles...');
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS unaccent');
    console.log('✅ Extensions pg_trgm et unaccent activées!');

    // 3. Créer l'index vectoriel
    console.log('\n📊 Création des index...');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_document_embedding 
      ON document_chunks USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);
    console.log('✅ Index vectoriel créé!');

    // 4. Index full-text français
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_document_content_fts 
      ON document_chunks USING gin(to_tsvector('french', content))
    `);
    console.log('✅ Index full-text créé!');

    // 5. Index sur les métadonnées
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_document_metadata 
      ON document_chunks USING gin(metadata)
    `);
    console.log('✅ Index métadonnées créé!');

    // 6. Fonction de recherche sémantique
    console.log('\n🔍 Création de la fonction de recherche...');
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION search_similar_documents(
        query_embedding vector(768),
        match_threshold float DEFAULT 0.5,
        match_count int DEFAULT 10
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
      $$
    `);
    console.log('✅ Fonction search_similar_documents créée!');

    // 7. Vérification
    const extensions: any[] = await prisma.$queryRaw`
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname IN ('vector', 'pg_trgm', 'unaccent')
    `;

    console.log('\n📊 Extensions actives:');
    extensions.forEach(ext => {
      console.log(`  - ${ext.extname}: v${ext.extversion}`);
    });

    console.log('\n✅ Configuration terminée avec succès!\n');

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setup();
