import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { messages, conversations } from '@/lib/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/conversations/:id/messages — Historique des messages
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  // Vérifier propriété de la conversation
  const [conv] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, auth.id)))
    .limit(1)

  if (!conv) {
    return NextResponse.json({ error: 'Conversation non trouvée' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt))
    .limit(limit)

  return NextResponse.json({ messages: msgs })
}
