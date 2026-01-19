
/**
 * Script d'importation de PDF dans la base de données Supabase
 * Usage: npx tsx scripts/import-pdf.ts <chemin_fichier> <source_nom> <type_source>
 * Exemple: npx tsx scripts/import-pdf.ts "./docs/mon_fichier.pdf" "Tafsir Al-Mizan" "imam"
 */

import fs from 'fs';
import pdf from 'pdf-parse';
import { PrismaClient } from '@prisma/client';
import { generateEmbeddingsBatch } from '../lib/embedding-service';

const prisma = new PrismaClient();

// Configuration du chunking
const CHUNK_SIZE = 1000; // Caractères par chunk
const OVERLAP = 200;     // Chevauchement pour garder le contexte

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('❌ Usage: npx tsx scripts/import-pdf.ts <chemin_pdf> <nom_source> [type_source]');
        console.error('Types de source: coran, hadith, imam (défaut: imam)');
        process.exit(1);
    }

    const filePath = args[0];
    const sourceName = args[1]; // Ex: "Tafsir Ibn Kathir"
    const sourceType = args[2] || 'imam'; // 'coran', 'hadith', 'imam'

    console.log(`\n========================================`);
    console.log(`  IMPORTATION PDF: ${sourceName}`);
    console.log(`========================================`);
    console.log(`📄 Fichier: ${filePath}`);
    console.log(`🏷️  Type: ${sourceType}`);

    if (!fs.existsSync(filePath)) {
        console.error(`❌ Fichier introuvable: ${filePath}`);
        process.exit(1);
    }

    try {
        // 1. Lire le PDF
        console.log(`\n📖 Lecture du PDF...`);
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);

        console.log(`✅ Lecture terminée. Pages: ${data.numpages}, Info: ${JSON.stringify(data.info)}`);
        const fullText = data.text;
        console.log(`📝 Taille du texte: ${fullText.length} caractères`);

        // 2. Découper en chunks
        console.log(`\n✂️  Découpage en morceaux (chunks)...`);
        const chunks: { content: string; page?: number }[] = [];

        // Note: pdf-parse donne tout le texte d'un coup. Pour avoir les pages exactes, c'est plus complexe.
        // Ici on fait un chunking simple sur le texte global.
        // Pour améliorer: on pourrait utiliser le render de pdf-parse par page.
        // Pour l'instant, restons simples : sliding window sur le texte complet.

        for (let i = 0; i < fullText.length; i += (CHUNK_SIZE - OVERLAP)) {
            let chunkText = fullText.slice(i, i + CHUNK_SIZE).replace(/\s+/g, ' ').trim();

            // Essayer de couper proprement à la fin d'une phrase si possible
            if (chunkText.length === CHUNK_SIZE) {
                const lastPeriod = chunkText.lastIndexOf('.');
                if (lastPeriod > CHUNK_SIZE * 0.8) {
                    chunkText = chunkText.substring(0, lastPeriod + 1);
                    i -= (CHUNK_SIZE - (lastPeriod + 1)); // Ajuster l'index pour le prochain tour
                }
            }

            if (chunkText.length > 50) { // Ignorer les trop petits fragments
                chunks.push({ content: chunkText });
            }
        }

        console.log(`🧩 Chunks générés: ${chunks.length}`);

        // 3. Générer les embeddings et sauvegarder par lots
        console.log(`\n🧠 Génération des embeddings (Gemini) et sauvegarde...`);

        let processed = 0;
        const BATCH_SIZE = 10;

        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            const texts = batch.map(c => c.content);

            try {
                const embeddings = await generateEmbeddingsBatch(texts);

                for (let j = 0; j < batch.length; j++) {
                    const embeddingResult = embeddings.find(e => e.text === texts[j]);
                    const embedding = embeddingResult?.embedding || [];

                    if (embedding.length === 0) continue;

                    // Créer l'enregistrement
                    const embeddingStr = `[${embedding.join(',')}]`;

                    // On génère un ID unique basé sur le temps + index
                    // Mais Prisma le fait avec cuid()

                    // Utilisation de rawQuery pour le type vector
                    // On doit d'abord insérer sans le vecteur, puis updater, ou tout faire en raw.
                    // Faisons tout en raw pour simplifier l'insertion vectorielle.

                    // 1. Créer ID
                    const { id } = await prisma.documentChunk.create({
                        data: {
                            content: texts[j],
                            source: sourceType,
                            reference: `${sourceName} - Partie ${(processed + j + 1)}`,
                            metadata: { type: 'pdf_import', originalFile: filePath }
                        },
                        select: { id: true }
                    });

                    // 2. Mettre à jour vecteur
                    await prisma.$executeRawUnsafe(`
                UPDATE document_chunks 
                SET embedding = $1::vector,
                    embedding_json = $2::jsonb
                WHERE id = $3
             `, embeddingStr, JSON.stringify(embedding), id);
                }

                processed += batch.length;
                process.stdout.write(`\r✅ Progression: ${processed}/${chunks.length} chunks`);

                // Pause rate limit
                await new Promise(r => setTimeout(r, 1000));

            } catch (err: any) {
                console.error(`\n❌ Erreur batch:`, err.message);
            }
        }

        console.log(`\n\n🎉 Importation terminée avec succès !`);

    } catch (error: any) {
        console.error(`\n❌ Erreur:`, error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
