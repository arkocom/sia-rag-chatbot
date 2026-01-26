import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { conversations, agents, messages, chunks } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

// ─── Helpers ──────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface ChunkRow {
  id: string
  content: string
  source: string
  reference: string
  score?: number
}

function searchByKeywords(allChunks: ChunkRow[], keywords: string[]): (ChunkRow & { score: number })[] {
  const safe = keywords.map(k => escapeRegex(k)).filter(k => k.length > 1)
  if (safe.length === 0) return []

  return allChunks
    .map(chunk => {
      const combined = `${chunk.content} ${chunk.reference}`.toLowerCase()
      let score = 0
      for (const kw of safe) {
        try {
          const m = combined.match(new RegExp(kw, 'gi'))
          if (m) score += m.length
        } catch {
          if (combined.includes(kw.toLowerCase())) score += 1
        }
      }
      return { ...chunk, score }
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
}

async function generateSearchTerms(
  question: string,
  genAI: InstanceType<typeof import('@google/generative-ai').GoogleGenerativeAI>
): Promise<string[]> {
  const stopWords = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'que', 'qui',
    'est', 'sont', 'dans', 'sur', 'pour', 'par', 'avec', 'ce', 'cette', 'comment',
    'pourquoi', 'quand', 'quel', 'quelle', 'tout', 'tous',
  ])
  const frenchKw = question
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(
      `Donne-moi les mots-clés de recherche pour trouver des passages coraniques, hadiths et textes islamiques sur ce sujet.
Question : "${question}"
Réponds UNIQUEMENT avec une liste de mots-clés séparés par des virgules (arabe + français).
Mots-clés :`
    )
    const terms = result.response.text().split(',').map(t => t.trim()).filter(t => t.length > 1)
    return [...new Set([...frenchKw, ...terms])]
  } catch {
    return frenchKw
  }
}

// ─── POST /api/conversations/:id/chat ─────────────────────

export async function POST(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now()

  // 1. Auth
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const { id: conversationId } = await params
  const body = await request.json()
  const userMessage: string | undefined = body?.message

  if (!userMessage?.trim()) {
    return new Response(JSON.stringify({ error: 'Message requis' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 2. Charger la conversation + agent
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, auth.id)))
    .limit(1)

  if (!conv) {
    return new Response(JSON.stringify({ error: 'Conversation non trouvée' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let agentConfig = {
    systemPrompt: null as string | null,
    temperature: 0.1,
    maxSources: 20,
    tone: 'neutre' as string,
    name: 'SIA',
  }

  if (conv.agentId) {
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, conv.agentId))
      .limit(1)

    if (agent) {
      agentConfig = {
        systemPrompt: agent.systemPrompt,
        temperature: agent.temperature,
        maxSources: agent.maxSources,
        tone: agent.tone,
        name: agent.name,
      }
    }
  }

  // 3. Sauvegarder le message utilisateur
  await db.insert(messages).values({
    conversationId,
    role: 'user',
    content: userMessage,
  })

  // 4. Charger les chunks de l'utilisateur
  const userChunks = await db
    .select({
      id: chunks.id,
      content: chunks.content,
      source: chunks.source,
      reference: chunks.reference,
    })
    .from(chunks)
    .where(eq(chunks.userId, auth.id))

  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

  if (userChunks.length === 0) {
    const noDataMsg = "Aucun document n'a encore été indexé. Veuillez d'abord ajouter des documents."
    await db.insert(messages).values({
      conversationId,
      role: 'assistant',
      content: noDataMsg,
    })
    await db.update(conversations).set({
      messageCount: sql`${conversations.messageCount} + 2`,
      updatedAt: new Date(),
    }).where(eq(conversations.id, conversationId))

    return new Response(
      `data: ${JSON.stringify({ choices: [{ delta: { content: noDataMsg } }] })}\n\ndata: [DONE]\n\n`,
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } }
    )
  }

  // 5. Recherche bilingue + sélection Gemini
  const searchTerms = await generateSearchTerms(userMessage, genAI)
  const kwResults = searchByKeywords(userChunks, searchTerms)

  let candidates: ChunkRow[] = kwResults.slice(0, 60)

  if (candidates.length < 30) {
    const existingIds = new Set(candidates.map(c => c.id))
    const remaining = userChunks.filter(c => !existingIds.has(c.id))
    const sample = remaining.sort(() => Math.random() - 0.5).slice(0, 50)
    candidates = [...candidates, ...sample]
  }

  // Dédup
  const seen = new Set<string>()
  candidates = candidates.filter(c => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  }).slice(0, 80)

  // Sélection Gemini
  let selectedChunks: ChunkRow[] = candidates.slice(0, agentConfig.maxSources)

  if (candidates.length > agentConfig.maxSources) {
    try {
      const chunksText = candidates
        .map((c, i) => `[${i}] ${c.reference}: ${c.content.substring(0, 300)}`)
        .join('\n\n')

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
      const selResult = await model.generateContent(
        `Tu es un expert en sources islamiques. Tu comprends l'arabe et le français.
QUESTION : "${userMessage}"
PASSAGES :\n${chunksText}
Sélectionne TOUS les passages pertinents (max ${agentConfig.maxSources}).
Réponds UNIQUEMENT avec les numéros entre crochets. Ex: [0],[5],[12]
Numéros :`
      )
      const indices = [...selResult.response.text().matchAll(/\[(\d+)\]/g)]
        .map(m => parseInt(m[1]))
        .filter(i => i >= 0 && i < candidates.length)

      if (indices.length > 0) {
        selectedChunks = indices.map(i => candidates[i]).slice(0, agentConfig.maxSources)
      }
    } catch {
      // fallback : garder les premiers candidats
    }
  }

  // 6. Construire le prompt système
  const sourceContext = selectedChunks
    .map(c => `[${c.reference}]\n${c.content}`)
    .join('\n\n---\n\n')

  const defaultPrompt = `Tu es ${agentConfig.name}, un TRANSMETTEUR NEUTRE de sources islamiques authentiques.

## RÈGLE ABSOLUE : BASE DE DONNÉES UNIQUEMENT
Tu ne dois JAMAIS utiliser tes propres connaissances. TOUT doit provenir EXCLUSIVEMENT des SOURCES ci-dessous.

INTERDIT : ajouter, compléter, interpréter, inventer quoi que ce soit.

## LANGUE : FRANÇAIS
Si le texte est en arabe : référence → traduction française → texte arabe original.

## SOURCES DISPONIBLES
${sourceContext}

## FORMAT
Pour CHAQUE source pertinente :
**[Référence]**
Traduction : « [Traduction littérale] »
[Texte arabe original]
---

Si aucune source ne traite du sujet : "Les sources disponibles ne contiennent pas de passage sur ce sujet."`

  const systemPrompt = agentConfig.systemPrompt
    ? `${agentConfig.systemPrompt}\n\n## SOURCES DISPONIBLES\n${sourceContext}`
    : defaultPrompt

  // 7. Streamer la réponse
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      maxOutputTokens: 8000,
      temperature: agentConfig.temperature,
    },
  })

  const genResult = await model.generateContentStream(
    `${systemPrompt}\n\n## QUESTION\n${userMessage}`
  )

  const citations = selectedChunks.map((c, i) => ({
    chunkId: c.id,
    documentId: '',
    reference: c.reference,
    sourceType: c.source,
    snippet: c.content.substring(0, 500),
    score: Math.round((1 - i * 0.03) * 100) / 100,
  }))

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let fullResponse = ''

      try {
        for await (const chunk of genResult.stream) {
          const text = chunk.text()
          fullResponse += text
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`)
          )
        }

        // Sauvegarder la réponse assistant
        await db.insert(messages).values({
          conversationId,
          role: 'assistant',
          content: fullResponse,
          citations,
          metadata: {
            processingTimeMs: Date.now() - startTime,
            sourcesSearched: userChunks.length,
            sourcesSelected: selectedChunks.length,
            model: 'gemini-2.5-flash',
          },
        })

        // Incrémenter le compteur
        await db.update(conversations).set({
          messageCount: sql`${conversations.messageCount} + 2`,
          updatedAt: new Date(),
        }).where(eq(conversations.id, conversationId))

        // Envoyer les sources en fin de stream
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            sources: citations,
            metadata: {
              processing_time_ms: Date.now() - startTime,
              sources_searched: userChunks.length,
              sources_selected: selectedChunks.length,
            },
          })}\n\n`)
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        console.error('Stream error:', error)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: 'Erreur de génération' })}\n\n`)
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
