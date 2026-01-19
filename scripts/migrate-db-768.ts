
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Migrating database to 768 dimensions...');
    try {
        // 1. Drop index
        console.log('Dropping index...');
        await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS idx_document_embedding;`);

        // 2. Clear old embeddings (optional but safer if dimensions conflict, though we want to keep data so let's try ALTER)
        // Actually, you typically can't ALTER column type from vector(384) to vector(768) without clearing data or casting (which implies data loss/change).
        // Since we want to update the schema for Gemini, old embeddings (384) are useless anyway for new searches (768).
        // So we should NULL them out.
        console.log('Nulling old embeddings (384 dims)...');
        await prisma.$executeRawUnsafe(`UPDATE document_chunks SET embedding = NULL;`);

        // 3. Alter column
        console.log('Altering column type...');
        await prisma.$executeRawUnsafe(`ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(768);`);

        // 4. Recreate index
        console.log('Recreating index...');
        await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_document_embedding 
        ON document_chunks USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `);

        // 5. Update function search_similar_documents (just in case)
        console.log('Updating search function...');
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

        console.log('✅ Migration successful!');
    } catch (error: any) {
        console.error('❌ Migration failed:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
