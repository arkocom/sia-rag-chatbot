import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { agents } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'
import { updateAgentSchema } from '@/lib/validations/agents'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/agents/:id — Détail d'un agent
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, auth.id)))
    .limit(1)

  if (!agent) {
    return NextResponse.json({ error: 'Agent non trouvé' }, { status: 404 })
  }

  return NextResponse.json({ agent })
}

/**
 * PUT /api/agents/:id — Modifier un agent
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const body = await request.json()
  const parsed = updateAgentSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const [updated] = await db
    .update(agents)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(and(eq(agents.id, id), eq(agents.userId, auth.id)))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Agent non trouvé' }, { status: 404 })
  }

  return NextResponse.json({ agent: updated })
}

/**
 * DELETE /api/agents/:id — Supprimer un agent
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  const [deleted] = await db
    .delete(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, auth.id)))
    .returning({ id: agents.id })

  if (!deleted) {
    return NextResponse.json({ error: 'Agent non trouvé' }, { status: 404 })
  }

  return NextResponse.json({ success: true, deletedId: deleted.id })
}
