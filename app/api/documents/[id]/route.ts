import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { saasDocuments, chunks } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/documents/:id — Détail d'un document avec ses chunks
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  const [doc] = await db
    .select()
    .from(saasDocuments)
    .where(and(eq(saasDocuments.id, id), eq(saasDocuments.userId, auth.id)))
    .limit(1)

  if (!doc) {
    return NextResponse.json({ error: 'Document non trouvé' }, { status: 404 })
  }

  const docChunks = await db
    .select({
      id: chunks.id,
      chunkIndex: chunks.chunkIndex,
      content: chunks.content,
      source: chunks.source,
      reference: chunks.reference,
      tokenCount: chunks.tokenCount,
    })
    .from(chunks)
    .where(eq(chunks.documentId, id))
    .orderBy(chunks.chunkIndex)

  return NextResponse.json({ document: doc, chunks: docChunks })
}

/**
 * DELETE /api/documents/:id — Supprimer un document et ses chunks (cascade)
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  const [deleted] = await db
    .delete(saasDocuments)
    .where(and(eq(saasDocuments.id, id), eq(saasDocuments.userId, auth.id)))
    .returning({ id: saasDocuments.id, title: saasDocuments.title })

  if (!deleted) {
    return NextResponse.json({ error: 'Document non trouvé' }, { status: 404 })
  }

  return NextResponse.json({ success: true, deleted })
}
