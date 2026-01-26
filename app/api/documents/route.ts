import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { saasDocuments, chunks, agents } from '@/lib/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'
import { createDocumentSchema } from '@/lib/validations/documents'
import { chunkText } from '@/lib/chunking'

export const dynamic = 'force-dynamic'

/**
 * GET /api/documents — Liste les documents de l'utilisateur
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agentId')
  const status = searchParams.get('status')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
  const offset = (page - 1) * limit

  const conditions = [eq(saasDocuments.userId, auth.id)]
  if (agentId) conditions.push(eq(saasDocuments.agentId, agentId))
  if (status) {
    const validStatuses = ['pending', 'processing', 'ready', 'error'] as const
    if (validStatuses.includes(status as typeof validStatuses[number])) {
      conditions.push(eq(saasDocuments.status, status as typeof validStatuses[number]))
    }
  }

  const whereClause = and(...conditions)

  const [docs, countResult] = await Promise.all([
    db
      .select()
      .from(saasDocuments)
      .where(whereClause)
      .orderBy(desc(saasDocuments.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(saasDocuments)
      .where(whereClause),
  ])

  const total = Number(countResult[0]?.count ?? 0)

  return NextResponse.json({
    documents: docs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
}

/**
 * POST /api/documents — Créer un document et le découper en chunks
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const parsed = createDocumentSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { title, fileType, agentId, content, source, metadata } = parsed.data

  // Vérifier que l'agent appartient à l'utilisateur
  if (agentId) {
    const [agent] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, auth.id)))
      .limit(1)

    if (!agent) {
      return NextResponse.json({ error: 'Agent non trouvé' }, { status: 404 })
    }
  }

  // Créer le document
  const [doc] = await db
    .insert(saasDocuments)
    .values({
      userId: auth.id,
      agentId: agentId ?? null,
      title,
      fileType,
      fileSize: new Blob([content]).size,
      status: 'processing',
      metadata: metadata ?? null,
    })
    .returning()

  // Découper en chunks
  const textChunks = chunkText(content, {
    maxTokens: 500,
    overlap: 50,
    source,
    reference: title,
  })

  // Insérer les chunks
  if (textChunks.length > 0) {
    await db.insert(chunks).values(
      textChunks.map((chunk) => ({
        documentId: doc.id,
        userId: auth.id,
        content: chunk.content,
        source: chunk.source,
        reference: chunk.reference,
        chunkIndex: chunk.chunkIndex,
        tokenCount: chunk.tokenCount,
      }))
    )
  }

  // Mettre à jour le statut et le nombre de chunks
  const [updated] = await db
    .update(saasDocuments)
    .set({
      status: 'ready',
      chunkCount: textChunks.length,
      updatedAt: new Date(),
    })
    .where(eq(saasDocuments.id, doc.id))
    .returning()

  return NextResponse.json(
    {
      document: updated,
      chunksCreated: textChunks.length,
    },
    { status: 201 }
  )
}
