/**
 * Script de migration des données vers Supabase
 * Étape 1: Migration des données sans embeddings
 */

import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();
const BACKUP_FILE = '/home/ubuntu/rag_islamique/backup_data.json';
const BATCH_SIZE = 100;

async function migrate() {
  console.log('\n========================================');
  console.log('  MIGRATION SUPABASE - ÉTAPE 1');
  console.log('  (Données sans embeddings)');
  console.log('========================================\n');
  
  // Charger le backup
  console.log('📂 Chargement du backup...');
  const backupData = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));
  console.log(`  - DocumentChunks: ${backupData.documentChunks.length}`);
  console.log(`  - ChatSessions: ${backupData.chatSessions.length}`);
  
  // Migrer les DocumentChunks
  console.log('\n📦 Migration des DocumentChunks...');
  
  const chunks = backupData.documentChunks;
  let migrated = 0;
  let errors = 0;
  
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    
    try {
      for (const chunk of batch) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO document_chunks (id, content, content_arabic, source, reference, grade, themes, isnad, metadata, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            content = $2,
            source = $4,
            reference = $5,
            updated_at = NOW()
        `,
          chunk.id,
          chunk.content,
          chunk.contentArabic || null,
          chunk.source,
          chunk.reference,
          chunk.grade || null,
          chunk.themes || [],
          chunk.isnad || null,
          chunk.metadata ? JSON.stringify(chunk.metadata) : null,
          new Date(chunk.createdAt),
          new Date()
        );
        migrated++;
      }
      
      console.log(`  ✓ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} - ${migrated} documents`);
      
    } catch (error: any) {
      console.error(`  ✗ Erreur batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
      errors += batch.length;
    }
  }
  
  console.log(`\n✅ DocumentChunks migrés: ${migrated}`);
  if (errors > 0) console.log(`⚠️  Erreurs: ${errors}`);
  
  // Migrer les ChatSessions
  console.log('\n💬 Migration des ChatSessions...');
  let sessionsMigrated = 0;
  
  for (const session of backupData.chatSessions) {
    try {
      // Vérifier si la session existe déjà
      const existing = await prisma.chatSession.findUnique({ where: { id: session.id } });
      if (existing) continue;
      
      await prisma.chatSession.create({
        data: {
          id: session.id,
          status: session.status || 'active',
          turnCount: session.turnCount || 0,
          topics: session.topics || [],
          lastSources: session.lastSources || [],
          metadata: session.metadata || Prisma.JsonNull,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt),
          expiresAt: session.expiresAt ? new Date(session.expiresAt) : null,
          userEmail: session.userEmail || null,
          userIdentifier: session.userIdentifier || null,
          escalatedAt: session.escalatedAt ? new Date(session.escalatedAt) : null,
          escalationReason: session.escalationReason || null,
          priority: session.priority || 'normal',
          assignedTo: session.assignedTo || null,
          messages: {
            create: (session.messages || []).map((msg: any) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              intent: msg.intent || null,
              confidence: msg.confidence || null,
              sources: msg.sources || Prisma.JsonNull,
              metadata: msg.metadata || Prisma.JsonNull,
              createdAt: new Date(msg.createdAt)
            }))
          }
        }
      });
      sessionsMigrated++;
    } catch (e: any) {
      // Session peut déjà exister
    }
  }
  console.log(`✅ ChatSessions migrées: ${sessionsMigrated}`);
  
  // Migrer les UsageQuotas
  console.log('\n📊 Migration des UsageQuotas...');
  for (const quota of backupData.usageQuotas || []) {
    try {
      await prisma.usageQuota.upsert({
        where: { identifier: quota.identifier },
        create: {
          ...quota,
          lastQueryAt: quota.lastQueryAt ? new Date(quota.lastQueryAt) : null,
          quotaResetAt: new Date(quota.quotaResetAt),
          createdAt: new Date(quota.createdAt),
          updatedAt: new Date(quota.updatedAt)
        },
        update: {}
      });
    } catch (e) {}
  }
  console.log(`✅ UsageQuotas migrés: ${backupData.usageQuotas?.length || 0}`);
  
  // Vérifier les résultats
  console.log('\n========================================');
  console.log('  VÉRIFICATION FINALE');
  console.log('========================================');
  
  const stats: any = await prisma.$queryRaw`
    SELECT 
      COUNT(*) as total,
      COUNT(embedding) as with_embeddings
    FROM document_chunks
  `;
  
  console.log(`\n📊 Statistiques Supabase:`);
  console.log(`  - Documents totaux: ${stats[0].total}`);
  console.log(`  - Avec embeddings: ${stats[0].with_embeddings}`);
  console.log(`  - Sans embeddings: ${Number(stats[0].total) - Number(stats[0].with_embeddings)}`);
  
  await prisma.$disconnect();
  console.log('\n✅ Migration Étape 1 terminée!\n');
  console.log('👉 Prochaine étape: Générer les embeddings avec HuggingFace');
}

migrate().catch(e => {
  console.error('\n❌ Erreur de migration:', e);
  process.exit(1);
});
