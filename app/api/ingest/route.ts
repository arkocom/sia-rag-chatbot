import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface IngestDocument {
  content: string
  source: 'coran' | 'hadith' | 'imam'
  reference: string
  metadata?: Record<string, unknown>
}

/**
 * POST /api/ingest - Ingère un ou plusieurs documents
 * Body: { documents: IngestDocument[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { documents } = body as { documents: IngestDocument[] }
    
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        { error: 'documents requis (array non vide)' },
        { status: 400 }
      )
    }
    
    // Valider chaque document
    const validSources = ['coran', 'hadith', 'imam']
    const errors: string[] = []
    
    documents.forEach((doc, idx) => {
      if (!doc.content || doc.content.trim().length < 10) {
        errors.push(`Document ${idx}: content requis (min 10 caractères)`)
      }
      if (!doc.source || !validSources.includes(doc.source)) {
        errors.push(`Document ${idx}: source invalide (coran, hadith, imam)`)
      }
      if (!doc.reference || doc.reference.trim().length < 3) {
        errors.push(`Document ${idx}: reference requise (min 3 caractères)`)
      }
    })
    
    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation échouée', details: errors },
        { status: 400 }
      )
    }
    
    // Insérer les documents
    const results = await prisma.documentChunk.createMany({
      data: documents.map(doc => ({
        content: doc.content.trim(),
        source: doc.source,
        reference: doc.reference.trim(),
        metadata: doc.metadata ? JSON.parse(JSON.stringify(doc.metadata)) : undefined,
      })),
      skipDuplicates: true
    })
    
    return NextResponse.json({
      success: true,
      message: `${results.count} document(s) ingéré(s)`,
      ingested_count: results.count,
      total_submitted: documents.length
    })
    
  } catch (error) {
    console.error('Erreur API ingest:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors de l\'ingestion' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/ingest?id=xxx - Supprime un document
 * DELETE /api/ingest?source=xxx - Supprime tous les documents d'une source
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const docId = searchParams.get('id')
    const source = searchParams.get('source')
    
    if (docId) {
      // Supprimer un document spécifique
      await prisma.documentChunk.delete({
        where: { id: docId }
      })
      
      return NextResponse.json({
        success: true,
        message: 'Document supprimé',
        deleted_id: docId
      })
    }
    
    if (source) {
      // Supprimer tous les documents d'une source
      const validSources = ['coran', 'hadith', 'imam']
      if (!validSources.includes(source)) {
        return NextResponse.json(
          { error: 'Source invalide' },
          { status: 400 }
        )
      }
      
      const result = await prisma.documentChunk.deleteMany({
        where: { source }
      })
      
      return NextResponse.json({
        success: true,
        message: `${result.count} document(s) supprimé(s) de la source ${source}`,
        deleted_count: result.count
      })
    }
    
    return NextResponse.json(
      { error: 'Paramètre id ou source requis' },
      { status: 400 }
    )
    
  } catch (error) {
    console.error('Erreur DELETE ingest:', error)
    return NextResponse.json(
      { error: 'Document non trouvé ou erreur serveur' },
      { status: 404 }
    )
  }
}

/**
 * GET /api/ingest - Récupère la liste des documents
 * GET /api/ingest?source=xxx - Filtre par source
 * GET /api/ingest?search=xxx - Recherche dans le contenu
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    
    const where: any = {}
    
    if (source) {
      where.source = source
    }
    
    if (search) {
      where.OR = [
        { content: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } }
      ]
    }
    
    const [documents, total] = await Promise.all([
      prisma.documentChunk.findMany({
        where,
        select: {
          id: true,
          source: true,
          reference: true,
          content: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.documentChunk.count({ where })
    ])
    
    return NextResponse.json({
      documents: documents.map(d => ({
        id: d.id,
        source: d.source,
        reference: d.reference,
        excerpt: d.content.substring(0, 300) + (d.content.length > 300 ? '...' : ''),
        content_length: d.content.length,
        created_at: d.createdAt
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    })
    
  } catch (error) {
    console.error('Erreur GET ingest:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
