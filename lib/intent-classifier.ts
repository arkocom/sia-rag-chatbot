import { IntentType } from './types'

/**
 * Classificateur d'intentions avancé
 * Combine règles + LLM fallback pour une meilleure précision
 */

// ==================== PATTERNS ====================

const INTENT_PATTERNS: Record<IntentType, RegExp[]> = {
  greeting: [
    /^(salam|salut|bonjour|bonsoir|hello|hi|assalam)/i,
    /^(salem|paix|bénédiction)/i,
    /^(wa alaykoum|wa alaykum)/i,
  ],
  
  search_verse: [
    /verset|sourate|ayat|aya|coran/i,
    /récite|réciter|lire/i,
    /al-baqara|al-fatiha|al-ikhlas|yassin|yasin/i,
    /quelle sourate|quel verset/i,
  ],
  
  search_hadith: [
    /hadith|hadiths|prophète.*dit|rapporté/i,
    /bukhari|muslim|tirmidhi|nawawi/i,
    /sunnah|sunna/i,
    /tradition prophétique/i,
  ],
  
  question_religious: [
    /que dit|qu'est-ce que|comment|pourquoi|quel|quelle/i,
    /islam|musulman|religion|foi|croyance/i,
    /prière|salat|zakat|ramadan|jeûne|hajj|pèlerinage/i,
    /halal|haram|licite|illicite|interdit|permis/i,
    /patience|sincérité|repentir|pardon|miséricorde/i,
    /bon comportement|parents|famille|voisin/i,
    /cœur|âme|spiritualité|purification/i,
    /ablution|wudu|tayammum|ghusl/i,
    /mariage|divorce|héritage|testament/i,
  ],
  
  explanation_request: [
    /explique|expliquer|signifie|signification|veut dire/i,
    /interprète|interprétation|comprendre|sens/i,
    /ton avis|penses-tu|crois-tu/i,
    /que veux-tu dire|c'est quoi/i,
  ],
  
  escalate: [
    /parler.*humain|contact.*personne|imam|savant|mufti/i,
    /besoin.*aide|urgence|urgent/i,
    /pas.*compris|comprends.*pas/i,
    /contacter|appeler|joindre/i,
    /spécialiste|expert|autorité/i,
  ],
  
  out_of_scope: [
    /météo|sport|politique|actualité|news/i,
    /film|musique|jeu|divertissement/i,
    /code|programmation|tech/i,
    /recette|cuisine|voyage/i,
    /argent|investissement|crypto/i,
  ],
  
  unknown: [],
}

// Mots-clés avec poids
const KEYWORD_WEIGHTS: Record<string, { intent: IntentType; weight: number }> = {
  // Questions religieuses
  'patience': { intent: 'question_religious', weight: 0.8 },
  'sincérité': { intent: 'question_religious', weight: 0.8 },
  'prière': { intent: 'question_religious', weight: 0.9 },
  'salat': { intent: 'question_religious', weight: 0.9 },
  'jeûne': { intent: 'question_religious', weight: 0.9 },
  'ramadan': { intent: 'question_religious', weight: 0.9 },
  'zakat': { intent: 'question_religious', weight: 0.9 },
  'parents': { intent: 'question_religious', weight: 0.7 },
  'colère': { intent: 'question_religious', weight: 0.7 },
  'repentir': { intent: 'question_religious', weight: 0.8 },
  'pardon': { intent: 'question_religious', weight: 0.7 },
  'halal': { intent: 'question_religious', weight: 0.9 },
  'haram': { intent: 'question_religious', weight: 0.9 },
  'mariage': { intent: 'question_religious', weight: 0.7 },
  'mort': { intent: 'question_religious', weight: 0.7 },
  'paradis': { intent: 'question_religious', weight: 0.8 },
  'enfer': { intent: 'question_religious', weight: 0.8 },
  'âme': { intent: 'question_religious', weight: 0.7 },
  'cœur': { intent: 'question_religious', weight: 0.6 },
  
  // Recherche versets
  'verset': { intent: 'search_verse', weight: 0.9 },
  'sourate': { intent: 'search_verse', weight: 0.9 },
  'coran': { intent: 'search_verse', weight: 0.7 },
  'ayat': { intent: 'search_verse', weight: 0.9 },
  
  // Recherche hadiths
  'hadith': { intent: 'search_hadith', weight: 0.9 },
  'hadiths': { intent: 'search_hadith', weight: 0.9 },
  'prophète': { intent: 'search_hadith', weight: 0.6 },
  'sunnah': { intent: 'search_hadith', weight: 0.8 },
  
  // Escalade
  'humain': { intent: 'escalate', weight: 0.8 },
  'imam': { intent: 'escalate', weight: 0.7 },
  'mufti': { intent: 'escalate', weight: 0.8 },
  'savant': { intent: 'escalate', weight: 0.7 },
  'urgence': { intent: 'escalate', weight: 0.9 },
  'urgent': { intent: 'escalate', weight: 0.9 },
}

// ==================== TYPES ====================

export interface IntentClassification {
  intent: IntentType
  confidence: number
  matched_patterns: string[]
  sub_intent?: string
  entities?: ExtractedEntities
  routing?: RoutingDecision
}

export interface ExtractedEntities {
  topics: string[]
  sources_mentioned: string[]
  specific_references: string[]
}

export interface RoutingDecision {
  flow: 'rag_search' | 'greeting_response' | 'escalate_human' | 'clarify_question' | 'out_of_scope_response'
  priority: 'low' | 'medium' | 'high'
  suggested_action: string
}

// ==================== CLASSIFICATION ====================

/**
 * Classifie l'intention d'un message utilisateur (version avancée)
 */
export function classifyIntent(message: string): IntentClassification {
  const normalizedMessage = message.toLowerCase().trim()
  const scores: Record<IntentType, number> = {
    greeting: 0,
    search_verse: 0,
    search_hadith: 0,
    question_religious: 0,
    explanation_request: 0,
    escalate: 0,
    out_of_scope: 0,
    unknown: 0,
  }
  const matchedPatterns: string[] = []
  
  // Vérifier les patterns regex
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedMessage)) {
        scores[intent as IntentType] += 1
        matchedPatterns.push(pattern.source)
      }
    }
  }
  
  // Ajouter les poids des mots-clés
  const words = normalizedMessage.split(/\s+/)
  for (const word of words) {
    const cleanWord = word.replace(/[^a-zàâäéèêëïîôùûüçœ]/gi, '')
    if (KEYWORD_WEIGHTS[cleanWord]) {
      const { intent, weight } = KEYWORD_WEIGHTS[cleanWord]
      scores[intent] += weight
    }
  }
  
  // Trouver l'intention avec le score le plus élevé
  let maxIntent: IntentType = 'unknown'
  let maxScore = 0
  
  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score
      maxIntent = intent as IntentType
    }
  }
  
  // Si aucun pattern trouvé mais c'est une question
  if (maxScore === 0 && /\?|que |qu'|comment|pourquoi/.test(normalizedMessage)) {
    maxIntent = 'question_religious'
    maxScore = 0.5
  }
  
  // Calculer la confiance
  const confidence = Math.min(maxScore / 3, 1)
  
  // Extraire les entités
  const entities = extractEntities(normalizedMessage)
  
  // Déterminer le routing
  const routing = determineRouting(maxIntent, confidence, entities)
  
  // Déterminer le sous-intent
  const subIntent = determineSubIntent(maxIntent, normalizedMessage)
  
  return {
    intent: maxIntent,
    confidence: Math.round(confidence * 100) / 100,
    matched_patterns: matchedPatterns,
    sub_intent: subIntent,
    entities,
    routing,
  }
}

/**
 * Extrait les entités nommées du message
 */
function extractEntities(message: string): ExtractedEntities {
  const topics: string[] = []
  const sourcesMentioned: string[] = []
  const specificReferences: string[] = []
  
  // Détection des sujets
  const topicKeywords = [
    'patience', 'sincérité', 'prière', 'salat', 'jeûne', 'ramadan',
    'zakat', 'hajj', 'parents', 'famille', 'colère', 'repentir',
    'pardon', 'miséricorde', 'cœur', 'âme', 'foi', 'iman',
    'halal', 'haram', 'mariage', 'mort', 'paradis', 'enfer',
    'ablution', 'purification', 'voisin', 'charité'
  ]
  
  for (const keyword of topicKeywords) {
    if (message.includes(keyword)) {
      topics.push(keyword)
    }
  }
  
  // Détection des sources mentionnées
  if (/coran|quran/i.test(message)) sourcesMentioned.push('coran')
  if (/hadith|sunnah/i.test(message)) sourcesMentioned.push('hadith')
  if (/nawawi|riyad/i.test(message)) sourcesMentioned.push('Riyad as-Salihin')
  if (/ghazali|ihya/i.test(message)) sourcesMentioned.push('Ihya Ulum al-Din')
  if (/bukhari|adab/i.test(message)) sourcesMentioned.push('Al-Adab al-Mufrad')
  if (/qayrawani|risala/i.test(message)) sourcesMentioned.push('La Risala')
  
  // Détection des références spécifiques
  const souratMatch = message.match(/sourate\s+([\w-]+)/i)
  if (souratMatch) specificReferences.push(`Sourate ${souratMatch[1]}`)
  
  const versetMatch = message.match(/verset\s+(\d+)/i)
  if (versetMatch) specificReferences.push(`Verset ${versetMatch[1]}`)
  
  return {
    topics: topics.slice(0, 5),
    sources_mentioned: sourcesMentioned,
    specific_references: specificReferences,
  }
}

/**
 * Détermine le routing basé sur l'intention
 */
function determineRouting(
  intent: IntentType, 
  confidence: number,
  entities: ExtractedEntities
): RoutingDecision {
  switch (intent) {
    case 'greeting':
      return {
        flow: 'greeting_response',
        priority: 'low',
        suggested_action: 'Répondre avec une salutation islamique'
      }
    
    case 'search_verse':
    case 'search_hadith':
    case 'question_religious':
      return {
        flow: 'rag_search',
        priority: entities.topics.length > 0 ? 'high' : 'medium',
        suggested_action: 'Rechercher dans les sources et citer'
      }
    
    case 'explanation_request':
      return {
        flow: 'clarify_question',
        priority: 'medium',
        suggested_action: 'Rappeler que SIA ne fait pas d\'interprétation'
      }
    
    case 'escalate':
      return {
        flow: 'escalate_human',
        priority: 'high',
        suggested_action: 'Proposer le contact avec un spécialiste'
      }
    
    case 'out_of_scope':
      return {
        flow: 'out_of_scope_response',
        priority: 'low',
        suggested_action: 'Expliquer le périmètre de SIA'
      }
    
    default:
      if (confidence < 0.3) {
        return {
          flow: 'clarify_question',
          priority: 'medium',
          suggested_action: 'Demander une reformulation'
        }
      }
      return {
        flow: 'rag_search',
        priority: 'medium',
        suggested_action: 'Tenter une recherche dans les sources'
      }
  }
}

/**
 * Détermine un sous-intent plus précis
 */
function determineSubIntent(intent: IntentType, message: string): string | undefined {
  if (intent === 'question_religious') {
    if (/prière|salat|namaz/i.test(message)) return 'prayer_related'
    if (/jeûne|ramadan|siyam/i.test(message)) return 'fasting_related'
    if (/zakat|aumône|charité/i.test(message)) return 'charity_related'
    if (/hajj|pèlerinage|omra/i.test(message)) return 'pilgrimage_related'
    if (/parents|famille|enfants/i.test(message)) return 'family_related'
    if (/mariage|divorce|couple/i.test(message)) return 'marriage_related'
    if (/mort|funérailles|tombe/i.test(message)) return 'death_related'
    if (/halal|haram|interdit/i.test(message)) return 'permissibility_related'
    if (/cœur|âme|spiritualité/i.test(message)) return 'spiritual_related'
  }
  
  if (intent === 'search_verse') {
    if (/fatiha/i.test(message)) return 'surah_fatiha'
    if (/baqara/i.test(message)) return 'surah_baqara'
    if (/yassin|yasin/i.test(message)) return 'surah_yassin'
    if (/ikhlas/i.test(message)) return 'surah_ikhlas'
  }
  
  return undefined
}

/**
 * Détermine si une escalade humaine est recommandée
 */
export function shouldEscalate(classification: IntentClassification): boolean {
  return (
    classification.intent === 'escalate' ||
    classification.intent === 'explanation_request' ||
    classification.routing?.flow === 'escalate_human' ||
    (classification.intent === 'unknown' && classification.confidence < 0.3)
  )
}

/**
 * Génère une réponse pré-définie pour certaines intentions
 */
export function getPreDefinedResponse(classification: IntentClassification): string | null {
  if (classification.intent === 'greeting') {
    return "Wa alaykoum assalam wa rahmatullahi wa barakatuh ! \ud83c\udf19\n\nJe suis SIA (Sources Islamiques Authentiques). Je peux vous aider \u00e0 trouver des passages du Coran, des Hadiths et des ouvrages des grands Imams.\n\nQuelle est votre question ?"
  }
  
  if (classification.intent === 'out_of_scope') {
    return "Je suis SIA, sp\u00e9cialis\u00e9 uniquement dans les sources islamiques authentiques (Coran, Hadiths, ouvrages des Imams).\n\nJe ne suis pas en mesure de r\u00e9pondre \u00e0 des questions hors de ce p\u00e9rim\u00e8tre.\n\nPuis-je vous aider avec une question sur l'Islam ?"
  }
  
  if (classification.intent === 'explanation_request') {
    return "Je ne suis pas habilit\u00e9 \u00e0 interpr\u00e9ter les textes sacr\u00e9s. Mon r\u00f4le est uniquement de transmettre fid\u00e8lement les sources authentiques.\n\nPour une interpr\u00e9tation, je vous recommande de consulter un imam ou un savant qualifi\u00e9.\n\nSouhaitez-vous que je recherche des passages sur un sujet particulier ?"
  }
  
  return null
}

/**
 * Classification avancée via LLM (fallback pour cas complexes)
 */
export async function classifyIntentWithLLM(
  message: string,
  apiKey: string
): Promise<IntentClassification> {
  // Essayer d'abord la classification par règles
  const ruleBasedResult = classifyIntent(message)
  
  // Si confiance suffisante, retourner le résultat
  if (ruleBasedResult.confidence >= 0.5) {
    return ruleBasedResult
  }
  
  // Sinon, utiliser le LLM pour affiner
  try {
    const prompt = `Classifie l'intention de ce message utilisateur pour un chatbot islamique.

Message: "${message}"

Catégories possibles:
- greeting: Salutation
- search_verse: Recherche d'un verset du Coran
- search_hadith: Recherche d'un hadith
- question_religious: Question religieuse générale
- explanation_request: Demande d'explication/interprétation
- escalate: Besoin de parler à un humain
- out_of_scope: Question hors sujet (non religieuse)
- unknown: Impossible à déterminer

Réponds UNIQUEMENT avec le nom de la catégorie, rien d'autre.`

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      const llmIntent = data?.choices?.[0]?.message?.content?.trim()?.toLowerCase() as IntentType
      
      if (llmIntent && llmIntent in INTENT_PATTERNS) {
        return {
          ...ruleBasedResult,
          intent: llmIntent,
          confidence: 0.7, // Confiance LLM
        }
      }
    }
  } catch (error) {
    console.error('Erreur classification LLM:', error)
  }
  
  return ruleBasedResult
}
