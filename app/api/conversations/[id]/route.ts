import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { conversations } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/conversations/:id — Détail d'une conversation
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, auth.id)))
    .limit(1)

  if (!conv) {
    return NextResponse.json({ error: 'Conversation non trouvée' }, { status: 404 })
  }

  return NextResponse.json({ conversation: conv })
}

/**
 * DELETE /api/conversations/:id — Supprimer une conversation (cascade messages)
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  const [deleted] = await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, auth.id)))
    .returning({ id: conversations.id })

  if (!deleted) {
    return NextResponse.json({ error: 'Conversation non trouvée' }, { status: 404 })
  }

  return NextResponse.json({ success: true, deletedId: deleted.id })
}
