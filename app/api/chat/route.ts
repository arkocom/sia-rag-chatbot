import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ChatResponse, SourceReference, StreamEvent, API_VERSION } from '@/lib/types'

export const dynamic = 'force-dynamic'

// Extraction de mots-clés depuis la question
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

// Recherche par mots-clés dans les chunks
function searchChunksByKeywords(chunks: any[], keywords: string[]): any[] {
  if (keywords.length === 0) return []

  const scoredChunks = chunks.map(chunk => {
    const content = (chunk.content || '').toLowerCase()
    const reference = (chunk.reference || '').toLowerCase()
    const combined = content + ' ' + reference

    let score = 0
    for (const keyword of keywords) {
      const regex = new RegExp(keyword, 'gi')
      const matches = combined.match(regex)
      if (matches) {
        score += matches.length
      }
    }

    return { ...chunk, score }
  })

  return scoredChunks
    .filter(chunk => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
}

// Sélection des chunks pertinents via recherche + LLM (GEMINI)
async function selectRelevantChunks(
  userQuestion: string,
  allChunks: any[],
  limit: number = 8
) {
  const startTime = Date.now()
  const keywords = extractKeywords(userQuestion)
  console.log('Mots-clés extraits:', keywords)

  const keywordResults = searchChunksByKeywords(allChunks, keywords)
  console.log(`Résultats recherche: ${keywordResults.length} chunks trouvés`)

  // Diversifier les sources
  const coranChunks = keywordResults.filter(c => c.source === 'coran').slice(0, 20)
  const hadithChunks = keywordResults.filter(c => c.source === 'hadith').slice(0, 10)
  const imamChunks = keywordResults.filter(c => c.source === 'imam').slice(0, 15)

  let candidateChunks = [...coranChunks, ...hadithChunks, ...imamChunks]

  if (candidateChunks.length < 20) {
    const randomCoran = allChunks
      .filter(c => c.source === 'coran')
      .sort(() => Math.random() - 0.5)
      .slice(0, 10)
    const randomHadith = allChunks
      .filter(c => c.source === 'hadith')
      .slice(0, 5)
    const randomImam = allChunks
      .filter(c => c.source === 'imam')
      .sort(() => Math.random() - 0.5)
      .slice(0, 10)

    candidateChunks = [...candidateChunks, ...randomCoran, ...randomHadith, ...randomImam]
  }

  // Dédupliquer
  const seen = new Set()
  candidateChunks = candidateChunks.filter(chunk => {
    if (seen.has(chunk.id)) return false
    seen.add(chunk.id)
    return true
  }).slice(0, 45)

  console.log(`Candidats pour LLM: ${candidateChunks.length} chunks`)

  // Sélection finale par LLM (GEMINI)
  const chunksText = candidateChunks
    .map((chunk: any, idx: number) => `[${idx}] ${chunk?.reference}: ${chunk?.content?.substring(0, 250)}`)
    .join('\n\n')

  const selectionPrompt = `Tu es un expert en sources islamiques. Voici une liste de passages numérotés provenant du Coran, des Hadiths et des ouvrages des Imams.

QUESTION DE L'UTILISATEUR : "${userQuestion}"

PASSAGES DISPONIBLES :
${chunksText}

TÂCHE : Sélectionne les ${limit} passages les PLUS PERTINENTS pour répondre à cette question.
- Cherche des passages qui traitent DIRECTEMENT du sujet demandé
- Diversifie les sources si possible (Coran, Hadiths, Imams)
- Ne sélectionne PAS des passages hors-sujet

Réponds UNIQUEMENT avec les numéros entre crochets, séparés par des virgules. Exemple: [0],[5],[12],[23],[31]

Numéros sélectionnés:`

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(selectionPrompt);
    const selection = result.response.text();

    console.log('Sélection LLM:', selection)

    const selectedIndices = [...selection.matchAll(/\[(\d+)\]/g)].map(m => parseInt(m[1]))

    const selectedChunks = selectedIndices
      .filter(idx => idx >= 0 && idx < candidateChunks.length)
      .map(idx => candidateChunks[idx])
      .slice(0, limit)

    console.log(`Chunks finaux sélectionnés: ${selectedChunks.length}`)
    return {
      chunks: selectedChunks.length > 0 ? selectedChunks : candidateChunks.slice(0, limit),
      searchTime: Date.now() - startTime,
      totalSearched: allChunks.length,
      keywordMatchCount: keywordResults.length,
      extractedKeywords: keywords
    }
  } catch (error) {
    console.error('Erreur lors de la sélection (Gemini):', error)
    return {
      chunks: candidateChunks.slice(0, limit),
      searchTime: Date.now() - startTime,
      totalSearched: allChunks.length,
      keywordMatchCount: keywordResults.length,
      extractedKeywords: keywords
    }
  }
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now()

  try {
    const body = await request.json()
    const userMessage = body?.message

    if (!userMessage) {
      return new Response(
        JSON.stringify({ error: 'Message requis' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Récupérer tous les chunks
    const allChunks = await prisma.documentChunk.findMany({
      select: {
        id: true,
        content: true,
        source: true,
        reference: true,
      }
    })

    if (!allChunks || allChunks.length === 0) {
      const emptyResponse: ChatResponse = {
        response_text: "Je n'ai pas trouvé de passages dans les sources disponibles. La base de données semble vide.",
        sources: [],
        metadata: {
          processing_time_ms: Date.now() - requestStartTime,
          sources_searched: 0,
          sources_selected: 0,
          model: 'gemini-2.5-flash',
          api_version: API_VERSION,
          timestamp: new Date().toISOString()
        }
      }

      const streamEvent: StreamEvent = { status: 'completed', result: emptyResponse }

      return new Response(
        `data: ${JSON.stringify(streamEvent)}\n\n`,
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      )
    }

    // Sélectionner les chunks pertinents
    const { chunks: relevantChunks, totalSearched, keywordMatchCount, extractedKeywords } = await selectRelevantChunks(
      userMessage,
      allChunks,
      5
    )

    // Si un seul mot-clé et beaucoup de résultats, demander précisions
    if (extractedKeywords && extractedKeywords.length === 1 && keywordMatchCount && keywordMatchCount > 10) {
      const tooManyResponse: ChatResponse = {
        response_text: `J'ai trouvé ${keywordMatchCount} passages mentionnant "${extractedKeywords[0]}". C'est beaucoup !\n\nPourriez-vous préciser le contexte ou la situation qui vous intéresse concernant ce mot ?`,
        sources: [],
        metadata: {
          processing_time_ms: Date.now() - requestStartTime,
          sources_searched: totalSearched,
          sources_selected: 0,
          model: 'none',
          api_version: API_VERSION,
          timestamp: new Date().toISOString()
        }
      }

      const streamEvent: StreamEvent = { status: 'completed', result: tooManyResponse }

      return new Response(
        `data: ${JSON.stringify(streamEvent)}\n\n`,
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      )
    }

    if (!relevantChunks || relevantChunks.length === 0) {
      const noResultResponse: ChatResponse = {
        response_text: "Désolé, je n'ai trouvé aucune corrélation avec votre demande dans les sources disponibles. Veuillez reformuler votre question.",
        sources: [],
        metadata: {
          processing_time_ms: Date.now() - requestStartTime,
          sources_searched: totalSearched,
          sources_selected: 0,
          model: 'gemini-2.5-flash',
          api_version: API_VERSION,
          timestamp: new Date().toISOString()
        }
      }

      const streamEvent: StreamEvent = { status: 'completed', result: noResultResponse }

      return new Response(
        `data: ${JSON.stringify(streamEvent)}\n\n`,
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      )
    }

    // Construire les sources avec scores
    const sources: SourceReference[] = relevantChunks.map((chunk: any, idx: number) => ({
      id: chunk.id,
      score: Math.round((1 - idx * 0.1) * 100) / 100,
      snippet: chunk.content?.substring(0, 300) || '',
      reference: chunk.reference || '',
      source_type: chunk.source as 'coran' | 'hadith' | 'imam'
    }))

    // Construire le contexte
    const sourceContext = relevantChunks
      .map((chunk: any) => `[${chunk?.reference}]\n${chunk?.content}`)
      .join('\n\n---\n\n')

    // Prompt ULTRA-STRICT
    const systemPrompt = `Tu es SIA (Sources Islamiques Authentiques), un TRANSMETTEUR NEUTRE de textes authentiques.

## INTERDICTION ABSOLUE D'INTERPRÉTATION

Tu n'es PAS un savant. Tu n'es PAS un imam. Tu n'es PAS qualifié pour interpréter.
Tu es UNIQUEMENT un transmetteur fidèle des textes.

INTERDIT - Ne JAMAIS faire :
- "Ce verset signifie que..." -> INTERPRÉTATION
- "On peut comprendre que..." -> INTERPRÉTATION
- "Cela nous enseigne que..." -> INTERPRÉTATION
- "L'islam dit que..." -> INTERPRÉTATION
- "Le message est..." -> INTERPRÉTATION
- "En d'autres termes..." -> INTERPRÉTATION
- "Autrement dit..." -> INTERPRÉTATION
- "Cela veut dire..." -> INTERPRÉTATION
- Tirer des conclusions -> INTERPRÉTATION
- Donner des conseils -> INTERPRÉTATION
- Expliquer le "pourquoi" -> INTERPRÉTATION

AUTORISÉ - Tu peux UNIQUEMENT :
- Citer le texte EXACT de la source
- Donner la référence précise
- Traduire littéralement (pour l'arabe -> français)
- Dire "Les sources disponibles ne mentionnent pas ce sujet"

## SOURCES DISPONIBLES (les SEULES que tu peux citer)
- Le Noble Coran (texte arabe)
- Les Hadiths du Prophète (paix et salut sur lui)
- Riyad as-Salihin (An-Nawawi)
- Al-Adab al-Mufrad (Al-Bukhari)
- Ihya' Ulum al-Din (Al-Ghazali)
- La Risala (Al-Qayrawani)

## CONTEXTE - SEULES SOURCES À UTILISER
${sourceContext}

## QUESTION ACTUELLE
${userMessage}

## FORMAT DE RÉPONSE STRICT

Pour chaque source pertinente, utilise CE FORMAT EXACT :

**[Référence exacte]**
« [Citation EXACTE du texte] »
Traduction : « [Traduction LITTÉRALE si arabe] »

---

NE RIEN AJOUTER D'AUTRE. Pas d'introduction. Pas de conclusion. Pas de "en résumé". Pas de conseil.

Si la question demande ton avis ou une interprétation, réponds :
"Je ne suis pas habilité à interpréter les textes sacrés. Voici les sources qui abordent ce sujet : [citations]"

Si aucune source ne répond à la question, dis simplement :
"Les sources disponibles (Coran, Hadiths, ouvrages des Imams) ne contiennent pas de passage traitant directement de ce sujet."

RAPPEL FINAL : Tu TRANSMETS. Tu N'INTERPRÈTES JAMAIS.`

    // Appel à GEMINI API avec streaming
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.3,
      }
    });

    const result = await model.generateContentStream(systemPrompt);

    // Stream la réponse
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let buffer = ''

        try {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            buffer += chunkText;

            const partialResponseEvent = {
              choices: [{ delta: { content: chunkText } }]
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(partialResponseEvent)}\n\n`));
          }

          // Construire la réponse finale
          const finalResponse: ChatResponse = {
            response_text: buffer,
            sources: sources,
            metadata: {
              processing_time_ms: Date.now() - requestStartTime,
              sources_searched: totalSearched,
              sources_selected: relevantChunks.length,
              model: 'gemini-2.5-flash',
              api_version: API_VERSION,
              timestamp: new Date().toISOString()
            }
          }

          const finalEvent: StreamEvent = { status: 'completed', result: finalResponse }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalEvent)}\n\n`))
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close()

        } catch (error) {
          console.error('Stream error:', error)
          const errorEvent: StreamEvent = { status: 'error', error: 'Une erreur est survenue' }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Erreur dans /api/chat:', error)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
