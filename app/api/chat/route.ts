import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { documents } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'
import type { ChatResponse, SourceReference, StreamEvent } from '@/lib/types'

export const dynamic = 'force-dynamic'

const API_VERSION = '1.0.0'

function extractKeywords(question: string): string[] {
  const stopWords = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'que', 'qui', 'quoi',
    'est', 'sont', 'a', 'ont', 'dans', 'sur', 'pour', 'par', 'avec', 'sans', 'ce', 'cette',
    'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'votre', 'leur',
    'dit', 'dire', 'fait', 'faire', 'peut', 'doit', 'faut', 'comment', 'pourquoi', 'quand',
    'quel', 'quelle', 'quels', 'quelles', 'tout', 'tous', 'toute', 'toutes', 'selon',
    'islam', 'coran', 'hadith', 'hadiths', 'prophète', 'allah', 'dieu', 'sources'
  ])

  const words = question
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))

  return [...new Set(words)]
}

interface ChunkRow {
  id: string
  content: string
  source: string
  reference: string
  score?: number
}

function searchChunksByKeywords(chunks: ChunkRow[], keywords: string[]): (ChunkRow & { score: number })[] {
  if (keywords.length === 0) return []

  return chunks
    .map(chunk => {
      const combined = `${chunk.content} ${chunk.reference}`.toLowerCase()
      let score = 0
      for (const keyword of keywords) {
        const matches = combined.match(new RegExp(keyword, 'gi'))
        if (matches) score += matches.length
      }
      return { ...chunk, score }
    })
    .filter(chunk => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
}

async function selectRelevantChunks(
  userQuestion: string,
  allChunks: ChunkRow[],
  limit: number = 8
) {
  const startTime = Date.now()
  const keywords = extractKeywords(userQuestion)
  const keywordResults = searchChunksByKeywords(allChunks, keywords)

  const coranChunks = keywordResults.filter(c => c.source === 'coran').slice(0, 40)
  const hadithChunks = keywordResults.filter(c => c.source === 'hadith').slice(0, 20)
  const imamChunks = keywordResults.filter(c => c.source === 'imam').slice(0, 20)

  let candidateChunks: ChunkRow[] = [...coranChunks, ...hadithChunks, ...imamChunks]

  const seen = new Set<string>()
  candidateChunks = candidateChunks.filter(chunk => {
    if (seen.has(chunk.id)) return false
    seen.add(chunk.id)
    return true
  }).slice(0, 80)

  const chunksText = candidateChunks
    .map((chunk, idx) => `[${idx}] ${chunk.reference}: ${chunk.content.substring(0, 300)}`)
    .join('\n\n')

  const selectionPrompt = `Tu es un expert en sources islamiques. Voici une liste de passages numérotés.

QUESTION DE L'UTILISATEUR : "${userQuestion}"

PASSAGES DISPONIBLES :
${chunksText}

TÂCHE : Sélectionne TOUS les passages qui sont PERTINENTS pour répondre à cette question (jusqu'à ${limit} maximum).
- Inclus TOUT passage qui traite directement ou indirectement du sujet demandé
- Ne rejette un passage que s'il est clairement hors-sujet
- Diversifie les sources si possible (Coran, Hadiths, Imams)

Réponds UNIQUEMENT avec les numéros entre crochets, séparés par des virgules. Exemple: [0],[5],[12],[3],[18]

Numéros sélectionnés:`

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const result = await model.generateContent(selectionPrompt)
    const selection = result.response.text()

    const selectedIndices = [...selection.matchAll(/\[(\d+)\]/g)].map(m => parseInt(m[1]))
    const selectedChunks = selectedIndices
      .filter(idx => idx >= 0 && idx < candidateChunks.length)
      .map(idx => candidateChunks[idx])
      .slice(0, limit)

    return {
      chunks: selectedChunks.length > 0 ? selectedChunks : candidateChunks.slice(0, limit),
      searchTime: Date.now() - startTime,
      totalSearched: allChunks.length,
      keywordMatchCount: keywordResults.length,
      extractedKeywords: keywords,
    }
  } catch (error) {
    console.error('Erreur sélection Gemini:', error)
    return {
      chunks: candidateChunks.slice(0, limit),
      searchTime: Date.now() - startTime,
      totalSearched: allChunks.length,
      keywordMatchCount: keywordResults.length,
      extractedKeywords: keywords,
    }
  }
}

function sendSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now()

  try {
    const body = await request.json()
    const userMessage: string | undefined = body?.message

    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'Message requis' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Récupérer tous les documents via Drizzle
    const allChunks = await db
      .select({
        id: documents.id,
        content: documents.content,
        source: documents.source,
        reference: documents.reference,
      })
      .from(documents)

    if (allChunks.length === 0) {
      const emptyResponse: ChatResponse = {
        response_text: "Je n'ai pas trouvé de passages dans les sources disponibles. La base de données semble vide.",
        sources: [],
        metadata: {
          processing_time_ms: Date.now() - requestStartTime,
          sources_searched: 0,
          sources_selected: 0,
          model: 'gemini-2.5-flash',
          api_version: API_VERSION,
          timestamp: new Date().toISOString(),
        },
      }
      return new Response(sendSSE({ status: 'completed', result: emptyResponse }), {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      })
    }

    const { chunks: relevantChunks, totalSearched, keywordMatchCount } =
      await selectRelevantChunks(userMessage, allChunks, 20)

    if (relevantChunks.length === 0) {
      const noResultResponse: ChatResponse = {
        response_text: "Désolé, je n'ai trouvé aucune corrélation dans les sources disponibles. Veuillez reformuler votre question.",
        sources: [],
        metadata: {
          processing_time_ms: Date.now() - requestStartTime,
          sources_searched: totalSearched,
          sources_selected: 0,
          model: 'gemini-2.5-flash',
          api_version: API_VERSION,
          timestamp: new Date().toISOString(),
        },
      }
      return new Response(sendSSE({ status: 'completed', result: noResultResponse }), {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      })
    }

    const sources: SourceReference[] = relevantChunks.map((chunk, idx) => ({
      id: chunk.id,
      score: Math.round((1 - idx * 0.05) * 100) / 100,
      snippet: chunk.content.substring(0, 500),
      reference: chunk.reference,
      source_type: chunk.source as 'coran' | 'hadith' | 'imam',
    }))

    const sourceContext = relevantChunks
      .map(chunk => `[${chunk.reference}]\n${chunk.content}`)
      .join('\n\n---\n\n')

    const systemPrompt = `Tu es SIA (Sources Islamiques Authentiques), un TRANSMETTEUR NEUTRE.

## RÈGLE ABSOLUE : BASE DE DONNÉES UNIQUEMENT

Tu ne dois JAMAIS utiliser tes propres connaissances. TOUT ce que tu affiches doit provenir EXCLUSIVEMENT des SOURCES DISPONIBLES ci-dessous. Si une information n'est pas dans les sources fournies, elle N'EXISTE PAS pour toi.

INTERDIT ABSOLUMENT :
- Ajouter un verset, hadith ou texte qui n'est PAS dans les sources ci-dessous
- Compléter ou enrichir avec tes connaissances personnelles
- Citer une source que tu connais mais qui n'est pas fournie
- Inventer ou reformuler le contenu d'un passage
- Donner une interprétation, explication, conseil ou conclusion
- Ajouter une introduction ou conclusion

## LANGUE : FRANÇAIS

Réponds en français. Si le texte source est en arabe, présente-le ainsi :
1. Référence en français
2. Traduction française littérale
3. Texte arabe original sur sa propre ligne

## SOURCES DISPONIBLES (BASE DE DONNÉES)
${sourceContext}

## QUESTION
${userMessage}

## FORMAT

Pour CHAQUE source ci-dessus qui est pertinente :

**[Référence exacte]**
Traduction : « [Traduction LITTÉRALE en français] »
[Texte arabe original]

---

Cite TOUS les passages pertinents des SOURCES DISPONIBLES ci-dessus. N'en omets aucun.
N'ajoute RIEN qui ne vient pas des sources ci-dessus. RIEN.

Si aucune source ci-dessus ne traite du sujet :
"Les sources disponibles ne contiennent pas de passage traitant directement de ce sujet."`

    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { maxOutputTokens: 8000, temperature: 0.1 },
    })

    const result = await model.generateContentStream(systemPrompt)

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let buffer = ''

        try {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text()
            buffer += chunkText
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunkText } }] })}\n\n`)
            )
          }

          const finalResponse: ChatResponse = {
            response_text: buffer,
            sources,
            metadata: {
              processing_time_ms: Date.now() - requestStartTime,
              sources_searched: totalSearched,
              sources_selected: relevantChunks.length,
              model: 'gemini-2.5-flash',
              api_version: API_VERSION,
              timestamp: new Date().toISOString(),
            },
          }

          controller.enqueue(encoder.encode(sendSSE({ status: 'completed', result: finalResponse })))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('Stream error:', error)
          controller.enqueue(encoder.encode(sendSSE({ status: 'error', error: 'Erreur de génération' })))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    })
  } catch (error) {
    console.error('Erreur /api/chat:', error)
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
