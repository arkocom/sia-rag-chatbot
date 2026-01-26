import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { conversations, agents } from '@/lib/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createConversationSchema = z.object({
  agentId: z.string().uuid('Agent ID invalide'),
  title: z.string().max(500).optional(),
})

/**
 * GET /api/conversations — Liste les conversations de l'utilisateur
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agentId')

  const conditions = [eq(conversations.userId, auth.id)]
  if (agentId) conditions.push(eq(conversations.agentId, agentId))

  const convs = await db
    .select({
      id: conversations.id,
      agentId: conversations.agentId,
      title: conversations.title,
      messageCount: conversations.messageCount,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(and(...conditions))
    .orderBy(desc(conversations.updatedAt))
    .limit(50)

  return NextResponse.json({ conversations: convs })
}

/**
 * POST /api/conversations — Créer une nouvelle conversation
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const parsed = createConversationSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  // Vérifier que l'agent appartient à l'utilisateur
  const [agent] = await db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(and(eq(agents.id, parsed.data.agentId), eq(agents.userId, auth.id)))
    .limit(1)

  if (!agent) {
    return NextResponse.json({ error: 'Agent non trouvé' }, { status: 404 })
  }

  const [conv] = await db
    .insert(conversations)
    .values({
      userId: auth.id,
      agentId: parsed.data.agentId,
      title: parsed.data.title ?? `Conversation avec ${agent.name}`,
    })
    .returning()

  return NextResponse.json({ conversation: conv }, { status: 201 })
}
