/**
 * Script d'importation des données depuis backup_data.json
 * Utilisé pour initialiser une nouvelle base de données Supabase
 * 
 * Usage: yarn tsx scripts/import-backup.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface BackupData {
  exportDate: string;
  documentChunks: any[];
  chatSessions: any[];
  usageQuotas: any[];
  gdprConsents: any[];
}

async function importBackup() {
  console.log('\n========================================');
  console.log('  IMPORTATION DES DONNÉES DE BACKUP');
  console.log('========================================\n');
  
  // Chercher le fichier backup
  const backupPaths = [
    path.join(__dirname, '../backup_data.json'),
    path.join(__dirname, '../../backup_data.json'),
    './backup_data.json'
  ];
  
  let backupPath: string | null = null;
  for (const p of backupPaths) {
    if (fs.existsSync(p)) {
      backupPath = p;
      break;
    }
  }
  
  if (!backupPath) {
    console.error('❌ Fichier backup_data.json introuvable!');
    console.log('   Chemins recherchés:', backupPaths);
    process.exit(1);
  }
  
  console.log(`📁 Fichier trouvé: ${backupPath}`);
  
  // Charger les données
  const data: BackupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  
  console.log(`📅 Date d'export: ${data.exportDate}`);
  console.log(`📚 Documents: ${data.documentChunks?.length || 0}`);
  console.log(`💬 Sessions: ${data.chatSessions?.length || 0}`);
  console.log(`📊 Quotas: ${data.usageQuotas?.length || 0}`);
  
  // Vérifier si la base est déjà remplie
  const existingCount = await prisma.documentChunk.count();
  if (existingCount > 0) {
    console.log(`\n⚠️  La base contient déjà ${existingCount} documents.`);
    console.log('   Pour réinitialiser, exécutez d\'abord: yarn prisma db push --force-reset');
    console.log('   Ou continuez pour ajouter les données (sans doublons).');
    
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    
    const answer = await new Promise<string>(resolve => {
      rl.question('\nContinuer l\'importation? (o/n): ', resolve);
    });
    rl.close();
    
    if (answer.toLowerCase() !== 'o') {
      console.log('\nImportation annulée.');
      process.exit(0);
    }
  }
  
  // Importer les documents
  if (data.documentChunks && data.documentChunks.length > 0) {
    console.log('\n📥 Importation des documents...');
    
    const BATCH_SIZE = 100;
    let imported = 0;
    let skipped = 0;
    
    for (let i = 0; i < data.documentChunks.length; i += BATCH_SIZE) {
      const batch = data.documentChunks.slice(i, i + BATCH_SIZE);
      
      for (const doc of batch) {
        try {
          await prisma.documentChunk.upsert({
            where: { id: doc.id },
            create: {
              id: doc.id,
              content: doc.content,
              reference: doc.reference,
              source: doc.source,
              metadata: doc.metadata || {},
              createdAt: new Date(doc.createdAt),
              updatedAt: new Date(doc.updatedAt)
            },
            update: {} // Ne pas mettre à jour si existe
          });
          imported++;
        } catch (e: any) {
          if (e.code === 'P2002') {
            skipped++;
          } else {
            console.error(`Erreur doc ${doc.id}:`, e.message);
          }
        }
      }
      
      console.log(`  ✓ ${Math.min(i + BATCH_SIZE, data.documentChunks.length)}/${data.documentChunks.length}`);
    }
    
    console.log(`✅ Documents importés: ${imported}, ignorés: ${skipped}`);
  }
  
  // Importer les quotas
  if (data.usageQuotas && data.usageQuotas.length > 0) {
    console.log('\n📥 Importation des quotas...');
    
    for (const quota of data.usageQuotas) {
      try {
        await prisma.usageQuota.upsert({
          where: { id: quota.id },
          create: {
            id: quota.id,
            identifier: quota.sessionId || quota.identifier || 'unknown',
            plan: quota.plan || 'free',
            dailyQueries: quota.dailyQueries || 0,
            totalQueries: quota.totalQueries || 0,
            lastQueryAt: quota.lastQueryAt ? new Date(quota.lastQueryAt) : null,
            quotaResetAt: quota.quotaResetAt ? new Date(quota.quotaResetAt) : new Date(),
            createdAt: new Date(quota.createdAt),
            updatedAt: new Date(quota.updatedAt)
          },
          update: {}
        });
      } catch (e) {}
    }
    
    console.log(`✅ Quotas importés: ${data.usageQuotas.length}`);
  }
  
  // Statistiques finales
  const finalCount = await prisma.documentChunk.count();
  const sourceStats = await prisma.documentChunk.groupBy({
    by: ['source'],
    _count: true
  });
  
  console.log('\n========================================');
  console.log('  IMPORTATION TERMINÉE');
  console.log('========================================');
  console.log(`📚 Total documents: ${finalCount}`);
  console.log('\n📊 Répartition par source:');
  sourceStats.forEach(s => {
    console.log(`  - ${s.source}: ${s._count}`);
  });
  
  await prisma.$disconnect();
}

importBackup().catch(e => {
  console.error('Erreur:', e);
  process.exit(1);
});
