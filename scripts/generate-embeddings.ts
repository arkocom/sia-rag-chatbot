/**
 * Génération des embeddings via le service centralisé (Gemini)
 * Configuration dans .env (EMBEDDING_PROVIDER="gemini")
 */

import { PrismaClient } from '@prisma/client';
import { generateEmbeddingsBatch, isEmbeddingEnabled } from '../lib/embedding-service';

const prisma = new PrismaClient();
const BATCH_SIZE = 10; // Batch size pour Gemini
const DELAY_MS = 1000; // Pause pour rate limiting

async function main() {
  console.log('\n========================================');
  console.log('  GÉNÉRATION DES EMBEDDINGS (GEMINI)');
  console.log('========================================\n');

  if (!isEmbeddingEnabled()) {
    console.error('❌ Aucun provider d\'embedding configuré. Vérifiez .env');
    process.exit(1);
  }

  // Récupérer les documents sans embedding via requête raw
  // Note: On vérifie si embedding IS NULL ou non valide (si on a changé de modèle, tout est à refaire idéalement)
  // Ici on prend ceux qui sont NULL.
  const docs: { id: string; content: string }[] = await prisma.$queryRaw`
    SELECT id, content 
    FROM document_chunks 
    WHERE embedding IS NULL
    LIMIT 2000
  `;

  console.log(`📄 Documents sans embeddings: ${docs.length}`);

  if (docs.length === 0) {
    console.log('✅ Tous les documents (du lot) ont déjà des embeddings!');
    await prisma.$disconnect();
    return;
  }

  let processed = 0;
  let errors = 0;

  // Traitement par batch
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const texts = batch.map(d => d.content);

    try {
      // Générer les embeddings via le service
      const results = await generateEmbeddingsBatch(texts);

      // Sauvegarder en DB
      for (const result of results) {
        const doc = batch.find(d => d.content === result.text);
        if (!doc) continue;

        if (!result.embedding || result.embedding.length === 0) {
          console.error(`  ✗ Embedding vide pour ${doc.id}`);
          errors++;
          continue;
        }

        const embeddingStr = `[${result.embedding.join(',')}]`;

        // Mise à jour brute pour pgvector
        await prisma.$executeRawUnsafe(`
           UPDATE document_chunks 
           SET embedding = $1::vector,
               embedding_json = $2
           WHERE id = $3
         `, embeddingStr, JSON.stringify(result.embedding), doc.id);

        processed++;
      }

      console.log(`  ✓ Batch ${Math.floor(i / BATCH_SIZE) + 1} - ${processed}/${docs.length} traités`);

      // Pause
      if (i + BATCH_SIZE < docs.length) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }

    } catch (error: any) {
      console.error(`  ✗ Erreur batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      errors += batch.length;
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log('\n========================================');
  console.log('  RÉSULTAT');
  console.log(`  ✅ Traités: ${processed}`);
  console.log(`  ❌ Erreurs: ${errors}`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Erreur:', e);
  process.exit(1);
});
