import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { agents } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'
import { createAgentSchema } from '@/lib/validations/agents'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agents — Liste les agents de l'utilisateur
 */
export async function GET() {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const userAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.userId, auth.id))
    .orderBy(desc(agents.createdAt))

  return NextResponse.json({ agents: userAgents })
}

/**
 * POST /api/agents — Créer un nouvel agent
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const parsed = createAgentSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const [agent] = await db
    .insert(agents)
    .values({
      userId: auth.id,
      name: parsed.data.name,
      description: parsed.data.description,
      tone: parsed.data.tone,
      systemPrompt: parsed.data.systemPrompt,
      temperature: parsed.data.temperature,
      maxSources: parsed.data.maxSources,
    })
    .returning()

  return NextResponse.json({ agent }, { status: 201 })
}
