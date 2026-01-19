import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();
const BACKUP_FILE = '/home/ubuntu/rag_islamique/backup_data.json';
const BATCH_SIZE = 100;

async function migrate() {
  console.log('\n========================================');
  console.log('  MIGRATION SUPABASE');
  console.log('========================================\n');

  const backupData = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));
  console.log(`📂 DocumentChunks à migrer: ${backupData.documentChunks.length}`);

  const chunks = backupData.documentChunks;
  let migrated = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    try {
      await prisma.documentChunk.createMany({
        data: batch.map((c: any) => ({
          id: c.id,
          content: c.content,
          contentArabic: c.contentArabic || null,
          source: c.source,
          reference: c.reference,
          grade: c.grade || null,
          themes: c.themes || [],
          isnad: c.isnad || null,
          metadata: c.metadata || Prisma.JsonNull,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date()
        })),
        skipDuplicates: true
      });

      migrated += batch.length;
      console.log(`  ✓ ${migrated}/${chunks.length} documents`);
    } catch (e: any) {
      console.error(`  ✗ Erreur:`, e.message.slice(0, 200));
    }
  }

  // Vérification
  const count = await prisma.documentChunk.count();
  console.log(`\n✅ Total en base: ${count} documents`);

  // Migrer sessions
  console.log('\n📂 Migration des sessions...');
  for (const session of backupData.chatSessions) {
    try {
      await prisma.chatSession.create({
        data: {
          id: session.id,
          status: session.status || 'active',
          turnCount: session.turnCount || 0,
          topics: session.topics || [],
          lastSources: session.lastSources || [],
          metadata: session.metadata || Prisma.JsonNull,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(),
          messages: {
            create: (session.messages || []).map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              intent: m.intent,
              confidence: m.confidence,
              sources: m.sources || Prisma.JsonNull,
              metadata: m.metadata || Prisma.JsonNull,
              createdAt: new Date(m.createdAt)
            }))
          }
        }
      });
    } catch (e) { }
  }

  const sessionCount = await prisma.chatSession.count();
  console.log(`✅ Sessions: ${sessionCount}`);

  await prisma.$disconnect();
  console.log('\n✅ Migration terminée!\n');
}

migrate().catch(e => {
  console.error('Erreur:', e);
  process.exit(1);
});
