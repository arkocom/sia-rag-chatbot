
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Testing connection to Supabase...');
    try {
        const count = await prisma.documentChunk.count();
        console.log(`✅ Connection successful!`);
        console.log(`📊 Validated: Found ${count} documents in the database.`);

        const sample = await prisma.documentChunk.findFirst({
            select: { id: true, source: true }
        });
        console.log(`📄 Sample document: ${JSON.stringify(sample)}`);

    } catch (error) {
        console.error('❌ Connection failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
