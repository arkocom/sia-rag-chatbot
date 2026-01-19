import { PrismaClient, Prisma } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

// Structure des sourates du Coran (114 sourates avec leur nombre de versets)
const SOURATES = [
  { num: 1, nom: 'Al-Fatiha', versets: 7 },
  { num: 2, nom: 'Al-Baqara', versets: 286 },
  { num: 3, nom: 'Al-Imran', versets: 200 },
  { num: 4, nom: 'An-Nisa', versets: 176 },
  { num: 5, nom: 'Al-Ma\'ida', versets: 120 },
  { num: 6, nom: 'Al-An\'am', versets: 165 },
  { num: 7, nom: 'Al-A\'raf', versets: 206 },
  { num: 8, nom: 'Al-Anfal', versets: 75 },
  { num: 9, nom: 'At-Tawba', versets: 129 },
  { num: 10, nom: 'Yunus', versets: 109 },
  { num: 11, nom: 'Hud', versets: 123 },
  { num: 12, nom: 'Yusuf', versets: 111 },
  { num: 13, nom: 'Ar-Ra\'d', versets: 43 },
  { num: 14, nom: 'Ibrahim', versets: 52 },
  { num: 15, nom: 'Al-Hijr', versets: 99 },
  { num: 16, nom: 'An-Nahl', versets: 128 },
  { num: 17, nom: 'Al-Isra', versets: 111 },
  { num: 18, nom: 'Al-Kahf', versets: 110 },
  { num: 19, nom: 'Maryam', versets: 98 },
  { num: 20, nom: 'Ta-Ha', versets: 135 },
  { num: 21, nom: 'Al-Anbiya', versets: 112 },
  { num: 22, nom: 'Al-Hajj', versets: 78 },
  { num: 23, nom: 'Al-Mu\'minun', versets: 118 },
  { num: 24, nom: 'An-Nur', versets: 64 },
  { num: 25, nom: 'Al-Furqan', versets: 77 },
  { num: 26, nom: 'Ash-Shu\'ara', versets: 227 },
  { num: 27, nom: 'An-Naml', versets: 93 },
  { num: 28, nom: 'Al-Qasas', versets: 88 },
  { num: 29, nom: 'Al-Ankabut', versets: 69 },
  { num: 30, nom: 'Ar-Rum', versets: 60 },
  { num: 31, nom: 'Luqman', versets: 34 },
  { num: 32, nom: 'As-Sajda', versets: 30 },
  { num: 33, nom: 'Al-Ahzab', versets: 73 },
  { num: 34, nom: 'Saba', versets: 54 },
  { num: 35, nom: 'Fatir', versets: 45 },
  { num: 36, nom: 'Ya-Sin', versets: 83 },
  { num: 37, nom: 'As-Saffat', versets: 182 },
  { num: 38, nom: 'Sad', versets: 88 },
  { num: 39, nom: 'Az-Zumar', versets: 75 },
  { num: 40, nom: 'Ghafir', versets: 85 },
  { num: 41, nom: 'Fussilat', versets: 54 },
  { num: 42, nom: 'Ash-Shura', versets: 53 },
  { num: 43, nom: 'Az-Zukhruf', versets: 89 },
  { num: 44, nom: 'Ad-Dukhan', versets: 59 },
  { num: 45, nom: 'Al-Jathiya', versets: 37 },
  { num: 46, nom: 'Al-Ahqaf', versets: 35 },
  { num: 47, nom: 'Muhammad', versets: 38 },
  { num: 48, nom: 'Al-Fath', versets: 29 },
  { num: 49, nom: 'Al-Hujurat', versets: 18 },
  { num: 50, nom: 'Qaf', versets: 45 },
  { num: 51, nom: 'Adh-Dhariyat', versets: 60 },
  { num: 52, nom: 'At-Tur', versets: 49 },
  { num: 53, nom: 'An-Najm', versets: 62 },
  { num: 54, nom: 'Al-Qamar', versets: 55 },
  { num: 55, nom: 'Ar-Rahman', versets: 78 },
  { num: 56, nom: 'Al-Waqi\'a', versets: 96 },
  { num: 57, nom: 'Al-Hadid', versets: 29 },
  { num: 58, nom: 'Al-Mujadila', versets: 22 },
  { num: 59, nom: 'Al-Hashr', versets: 24 },
  { num: 60, nom: 'Al-Mumtahina', versets: 13 },
  { num: 61, nom: 'As-Saff', versets: 14 },
  { num: 62, nom: 'Al-Jumu\'a', versets: 11 },
  { num: 63, nom: 'Al-Munafiqun', versets: 11 },
  { num: 64, nom: 'At-Taghabun', versets: 18 },
  { num: 65, nom: 'At-Talaq', versets: 12 },
  { num: 66, nom: 'At-Tahrim', versets: 12 },
  { num: 67, nom: 'Al-Mulk', versets: 30 },
  { num: 68, nom: 'Al-Qalam', versets: 52 },
  { num: 69, nom: 'Al-Haqqa', versets: 52 },
  { num: 70, nom: 'Al-Ma\'arij', versets: 44 },
  { num: 71, nom: 'Nuh', versets: 28 },
  { num: 72, nom: 'Al-Jinn', versets: 28 },
  { num: 73, nom: 'Al-Muzzammil', versets: 20 },
  { num: 74, nom: 'Al-Muddaththir', versets: 56 },
  { num: 75, nom: 'Al-Qiyama', versets: 40 },
  { num: 76, nom: 'Al-Insan', versets: 31 },
  { num: 77, nom: 'Al-Mursalat', versets: 50 },
  { num: 78, nom: 'An-Naba', versets: 40 },
  { num: 79, nom: 'An-Nazi\'at', versets: 46 },
  { num: 80, nom: '\'Abasa', versets: 42 },
  { num: 81, nom: 'At-Takwir', versets: 29 },
  { num: 82, nom: 'Al-Infitar', versets: 19 },
  { num: 83, nom: 'Al-Mutaffifin', versets: 36 },
  { num: 84, nom: 'Al-Inshiqaq', versets: 25 },
  { num: 85, nom: 'Al-Buruj', versets: 22 },
  { num: 86, nom: 'At-Tariq', versets: 17 },
  { num: 87, nom: 'Al-A\'la', versets: 19 },
  { num: 88, nom: 'Al-Ghashiya', versets: 26 },
  { num: 89, nom: 'Al-Fajr', versets: 30 },
  { num: 90, nom: 'Al-Balad', versets: 20 },
  { num: 91, nom: 'Ash-Shams', versets: 15 },
  { num: 92, nom: 'Al-Layl', versets: 21 },
  { num: 93, nom: 'Ad-Duha', versets: 11 },
  { num: 94, nom: 'Ash-Sharh', versets: 8 },
  { num: 95, nom: 'At-Tin', versets: 8 },
  { num: 96, nom: 'Al-\'Alaq', versets: 19 },
  { num: 97, nom: 'Al-Qadr', versets: 5 },
  { num: 98, nom: 'Al-Bayyina', versets: 8 },
  { num: 99, nom: 'Az-Zalzala', versets: 8 },
  { num: 100, nom: 'Al-\'Adiyat', versets: 11 },
  { num: 101, nom: 'Al-Qari\'a', versets: 11 },
  { num: 102, nom: 'At-Takathur', versets: 8 },
  { num: 103, nom: 'Al-\'Asr', versets: 3 },
  { num: 104, nom: 'Al-Humaza', versets: 9 },
  { num: 105, nom: 'Al-Fil', versets: 5 },
  { num: 106, nom: 'Quraysh', versets: 4 },
  { num: 107, nom: 'Al-Ma\'un', versets: 7 },
  { num: 108, nom: 'Al-Kawthar', versets: 3 },
  { num: 109, nom: 'Al-Kafirun', versets: 6 },
  { num: 110, nom: 'An-Nasr', versets: 3 },
  { num: 111, nom: 'Al-Masad', versets: 5 },
  { num: 112, nom: 'Al-Ikhlas', versets: 4 },
  { num: 113, nom: 'Al-Falaq', versets: 5 },
  { num: 114, nom: 'An-Nas', versets: 6 },
]

// Fonction pour extraire le texte d'un PDF
async function extractPdfText(pdfPath: string): Promise<string> {
  console.log(`Extraction du PDF: ${pdfPath}`)
  const fileBuffer = fs.readFileSync(pdfPath)
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(fileBuffer)
  return data?.text || ''
}

// Parser le Coran arabe (fichier texte avec 1 verset par ligne)
function parseQuranText(text: string): Array<{ content: string; reference: string }> {
  const lines = text.split('\n').filter(line => line.trim().length > 0)
  const chunks: Array<{ content: string; reference: string }> = []
  
  let lineIndex = 0
  for (const sourate of SOURATES) {
    for (let verset = 1; verset <= sourate.versets; verset++) {
      if (lineIndex < lines.length) {
        const content = lines[lineIndex].trim()
        if (content.length > 0) {
          chunks.push({
            content: content,
            reference: `Sourate ${sourate.num} (${sourate.nom}), Verset ${verset}`
          })
        }
        lineIndex++
      }
    }
  }
  
  console.log(`${chunks.length} versets du Coran parsés`)
  return chunks
}

// Parser les Hadiths
function parseHadithsText(text: string): Array<{ content: string; reference: string }> {
  const chunks: Array<{ content: string; reference: string }> = []
  
  // Essayer de détecter les hadiths par numéro
  const hadithPattern = /(?:Hadith|N°|n°)\s*(\d+)[^\d]([\s\S]*?)(?=(?:Hadith|N°|n°)\s*\d+|$)/gi
  let match
  
  while ((match = hadithPattern.exec(text)) !== null) {
    const num = match[1]
    const content = match[2].trim()
    if (content.length > 50) {
      chunks.push({
        content: content.substring(0, 2000),
        reference: `Hadith N°${num}`
      })
    }
  }
  
  // Si pas de pattern trouvé, chunker par taille
  if (chunks.length === 0) {
    const cleanText = text.replace(/\s+/g, ' ').trim()
    const chunkSize = 1000
    let position = 0
    let chunkIndex = 0
    
    while (position < cleanText.length) {
      const end = Math.min(position + chunkSize, cleanText.length)
      let chunkText = cleanText.substring(position, end)
      
      if (end < cleanText.length) {
        const lastSpace = chunkText.lastIndexOf(' ')
        if (lastSpace > chunkSize * 0.7) {
          chunkText = chunkText.substring(0, lastSpace)
        }
      }
      
      if (chunkText.trim().length > 50) {
        chunks.push({
          content: chunkText.trim(),
          reference: `Hadith (extrait ${chunkIndex + 1})`
        })
        chunkIndex++
      }
      
      position += chunkSize - 200
    }
  }
  
  console.log(`${chunks.length} extraits de Hadiths parsés`)
  return chunks
}

async function seed() {
  try {
    console.log('=== Début de l\'indexation SIA ===')
    
    // Nettoyer la base
    console.log('Nettoyage de la base de données...')
    await prisma.documentChunk.deleteMany({})
    
    // 1. Indexer le Coran (fichier texte arabe)
    const quranTextPath = '/home/ubuntu/Uploads/quran-simple.txt'
    if (fs.existsSync(quranTextPath)) {
      console.log('\n=== Traitement du Coran (texte arabe) ===')
      const quranText = fs.readFileSync(quranTextPath, 'utf-8')
      const quranChunks = parseQuranText(quranText)
      
      console.log(`Indexation de ${quranChunks.length} versets...`)
      
      // Indexer par lots de 100
      for (let i = 0; i < quranChunks.length; i += 100) {
        const batch = quranChunks.slice(i, i + 100)
        await prisma.documentChunk.createMany({
          data: batch.map(chunk => ({
            content: chunk.content,
            source: 'coran',
            reference: chunk.reference,
            metadata: {},
          }))
        })
        console.log(`  ${Math.min(i + 100, quranChunks.length)}/${quranChunks.length} versets indexés`)
      }
      console.log('✓ Coran indexé avec succès')
    }
    
    // 2. Indexer les Hadiths (PDF)
    const hadithsPath = '/home/ubuntu/Uploads/french_99_hadiths_du_Prophete_Muhammad.pdf'
    if (fs.existsSync(hadithsPath)) {
      console.log('\n=== Traitement des Hadiths ===')
      const hadithsText = await extractPdfText(hadithsPath)
      const hadithsChunks = parseHadithsText(hadithsText)
      
      for (const chunk of hadithsChunks) {
        await prisma.documentChunk.create({
          data: {
            content: chunk.content,
            source: 'hadith',
            reference: chunk.reference,
            metadata: {},
          }
        })
      }
      console.log('✓ Hadiths indexés avec succès')
    }
    
    // Résumé
    const totalCoran = await prisma.documentChunk.count({ where: { source: 'coran' } })
    const totalHadith = await prisma.documentChunk.count({ where: { source: 'hadith' } })
    
    console.log('\n=== Indexation terminée ===')
    console.log(`Versets du Coran: ${totalCoran}`)
    console.log(`Extraits de Hadiths: ${totalHadith}`)
    console.log(`Total: ${totalCoran + totalHadith}`)
    
  } catch (error) {
    console.error('Erreur lors de l\'indexation:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seed()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
