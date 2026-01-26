import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { eq, ilike, or, sql, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

interface IngestDocument {
  content: string
  source: 'coran' | 'hadith' | 'imam'
  reference: string
  metadata?: Record<string, unknown>
}

/**
 * POST /api/ingest - Ingère un ou plusieurs documents
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { documents: docs } = body as { documents: IngestDocument[] }

    if (!docs || !Array.isArray(docs) || docs.length === 0) {
      return NextResponse.json({ error: 'documents requis (array non vide)' }, { status: 400 })
    }

    const validSources = ['coran', 'hadith', 'imam']
    const errors: string[] = []

    docs.forEach((doc, idx) => {
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
      return NextResponse.json({ error: 'Validation échouée', details: errors }, { status: 400 })
    }

    // TODO: récupérer le user_id depuis Supabase Auth quand l'auth sera en place
    // Pour l'instant, on utilise un user_id par défaut
    const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000'

    const inserted = await db.insert(documents).values(
      docs.map(doc => ({
        userId: DEFAULT_USER_ID,
        content: doc.content.trim(),
        source: doc.source,
        reference: doc.reference.trim(),
        metadata: doc.metadata ?? null,
      }))
    ).returning({ id: documents.id })

    return NextResponse.json({
      success: true,
      message: `${inserted.length} document(s) ingéré(s)`,
      ingested_count: inserted.length,
      total_submitted: docs.length,
    })
  } catch (error) {
    console.error('Erreur API ingest:', error)
    return NextResponse.json({ error: "Erreur serveur lors de l'ingestion" }, { status: 500 })
  }
}

/**
 * DELETE /api/ingest?id=xxx ou ?source=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const docId = searchParams.get('id')
    const source = searchParams.get('source')

    if (docId) {
      await db.delete(documents).where(eq(documents.id, docId))
      return NextResponse.json({ success: true, message: 'Document supprimé', deleted_id: docId })
    }

    if (source) {
      const validSources = ['coran', 'hadith', 'imam']
      if (!validSources.includes(source)) {
        return NextResponse.json({ error: 'Source invalide' }, { status: 400 })
      }

      const deleted = await db.delete(documents).where(eq(documents.source, source)).returning({ id: documents.id })
      return NextResponse.json({
        success: true,
        message: `${deleted.length} document(s) supprimé(s) de la source ${source}`,
        deleted_count: deleted.length,
      })
    }

    return NextResponse.json({ error: 'Paramètre id ou source requis' }, { status: 400 })
  } catch (error) {
    console.error('Erreur DELETE ingest:', error)
    return NextResponse.json({ error: 'Document non trouvé ou erreur serveur' }, { status: 404 })
  }
}

/**
 * GET /api/ingest - Liste les documents
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
    const offset = (page - 1) * limit

    // Construire les conditions
    const conditions = []
    if (source) conditions.push(eq(documents.source, source))
    if (search) {
      conditions.push(
        or(
          ilike(documents.content, `%${search}%`),
          ilike(documents.reference, `%${search}%`)
        )!
      )
    }

    const whereClause = conditions.length > 0
      ? conditions.reduce((acc, cond) => sql`${acc} AND ${cond}`)
      : undefined

    const [docs, countResult] = await Promise.all([
      db
        .select({
          id: documents.id,
          source: documents.source,
          reference: documents.reference,
          content: documents.content,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(whereClause)
        .orderBy(desc(documents.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(documents)
        .where(whereClause),
    ])

    const total = Number(countResult[0]?.count ?? 0)

    return NextResponse.json({
      documents: docs.map(d => ({
        id: d.id,
        source: d.source,
        reference: d.reference,
        excerpt: d.content.substring(0, 300) + (d.content.length > 300 ? '...' : ''),
        content_length: d.content.length,
        created_at: d.createdAt,
      })),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Erreur GET ingest:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
