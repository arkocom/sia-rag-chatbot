import { prisma } from './db'
import type { IntentType } from './types'

// ==================== CONSTANTS ====================

/** Nombre maximum de messages dans l'historique pour le contexte */
export const MAX_CONTEXT_MESSAGES = 10

/** Durée d'expiration d'une session (24 heures) */
export const SESSION_EXPIRY_HOURS = 24

/** Nombre maximum de tours avant suggestion d'escalade */
export const MAX_TURNS_BEFORE_ESCALATE = 10

// ==================== TYPES ====================

export interface SessionData {
  id: string
  status: 'active' | 'escalated' | 'closed'
  turnCount: number
  topics: string[]
  lastSources: string[]
  messages: MessageData[]
  createdAt: Date
  updatedAt: Date
}

export interface MessageData {
  id: string
  role: 'user' | 'assistant'
  content: string
  intent?: string
  confidence?: number
  sources?: any[]
  createdAt: Date
}

export interface ContextSummary {
  /** Résumé des sujets abordés */
  topics: string[]
  /** Historique formaté pour le LLM */
  formattedHistory: string
  /** Nombre de tours */
  turnCount: number
  /** Sources déjà citées */
  previousSources: string[]
}

// ==================== SESSION MANAGEMENT ====================

/**
 * Crée une nouvelle session ou récupère une session existante
 */
export async function getOrCreateSession(sessionId?: string): Promise<SessionData> {
  // Si un ID est fourni, essayer de récupérer la session
  if (sessionId) {
    const existing = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: MAX_CONTEXT_MESSAGES * 2, // user + assistant = 2 messages par tour
        }
      }
    })
    
    if (existing && existing.status === 'active') {
      // Vérifier si la session n'est pas expirée
      const expiryTime = new Date(existing.createdAt)
      expiryTime.setHours(expiryTime.getHours() + SESSION_EXPIRY_HOURS)
      
      if (new Date() < expiryTime) {
        return {
          id: existing.id,
          status: existing.status as 'active' | 'escalated' | 'closed',
          turnCount: existing.turnCount,
          topics: existing.topics,
          lastSources: existing.lastSources,
          messages: existing.messages.map(m => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            intent: m.intent || undefined,
            confidence: m.confidence || undefined,
            sources: m.sources as any[] || undefined,
            createdAt: m.createdAt
          })),
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt
        }
      }
    }
  }
  
  // Créer une nouvelle session
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS)
  
  const newSession = await prisma.chatSession.create({
    data: {
      status: 'active',
      turnCount: 0,
      topics: [],
      lastSources: [],
      expiresAt
    },
    include: {
      messages: true
    }
  })
  
  return {
    id: newSession.id,
    status: 'active',
    turnCount: 0,
    topics: [],
    lastSources: [],
    messages: [],
    createdAt: newSession.createdAt,
    updatedAt: newSession.updatedAt
  }
}

/**
 * Ajoute un message utilisateur à la session
 */
export async function addUserMessage(
  sessionId: string,
  content: string,
  intent?: IntentType
): Promise<MessageData> {
  const message = await prisma.chatMessage.create({
    data: {
      sessionId,
      role: 'user',
      content,
      intent
    }
  })
  
  return {
    id: message.id,
    role: 'user',
    content: message.content,
    intent: message.intent || undefined,
    createdAt: message.createdAt
  }
}

/**
 * Ajoute une réponse assistant à la session
 */
export async function addAssistantMessage(
  sessionId: string,
  content: string,
  intent: IntentType,
  confidence: number,
  sources: any[]
): Promise<MessageData> {
  const message = await prisma.chatMessage.create({
    data: {
      sessionId,
      role: 'assistant',
      content,
      intent,
      confidence,
      sources: sources as any
    }
  })
  
  // Mettre à jour la session
  const sourceRefs = sources.map(s => s.reference).filter(Boolean)
  
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      turnCount: { increment: 1 },
      lastSources: sourceRefs.slice(0, 5),
      updatedAt: new Date()
    }
  })
  
  return {
    id: message.id,
    role: 'assistant',
    content: message.content,
    intent: message.intent || undefined,
    confidence: message.confidence || undefined,
    sources: sources,
    createdAt: message.createdAt
  }
}

/**
 * Extrait un résumé du contexte pour le LLM
 */
export function getContextSummary(session: SessionData): ContextSummary {
  // Prendre les derniers messages pour le contexte
  const recentMessages = session.messages.slice(-MAX_CONTEXT_MESSAGES)
  
  // Formater l'historique pour le LLM
  const formattedHistory = recentMessages
    .map(m => {
      if (m.role === 'user') {
        return `UTILISATEUR: ${m.content}`
      } else {
        // Résumer la réponse assistant (premiers 300 caractères)
        const summary = m.content.length > 300 
          ? m.content.substring(0, 300) + '...'
          : m.content
        return `ASSISTANT: ${summary}`
      }
    })
    .join('\n\n')
  
  // Extraire les sujets uniques des messages
  const topics = extractTopics(recentMessages)
  
  // Récupérer les sources déjà citées
  const previousSources = recentMessages
    .filter(m => m.role === 'assistant' && m.sources)
    .flatMap(m => m.sources?.map((s: any) => s.reference) || [])
    .filter((v, i, a) => a.indexOf(v) === i) // Unique
  
  return {
    topics,
    formattedHistory,
    turnCount: session.turnCount,
    previousSources
  }
}

/**
 * Extrait les sujets principaux des messages
 */
function extractTopics(messages: MessageData[]): string[] {
  const topicKeywords = [
    'patience', 'sincérité', 'prière', 'salat', 'jeûne', 'ramadan',
    'zakat', 'hajj', 'parents', 'famille', 'colère', 'repentir',
    'pardon', 'miséricorde', 'cœur', 'âme', 'foi', 'iman',
    'halal', 'haram', 'mariage', 'mort', 'paradis', 'enfer'
  ]
  
  const foundTopics: string[] = []
  
  for (const message of messages) {
    if (message.role === 'user') {
      const lowerContent = message.content.toLowerCase()
      for (const keyword of topicKeywords) {
        if (lowerContent.includes(keyword) && !foundTopics.includes(keyword)) {
          foundTopics.push(keyword)
        }
      }
    }
  }
  
  return foundTopics.slice(0, 5) // Max 5 sujets
}

/**
 * Met à jour le statut d'une session
 */
export async function updateSessionStatus(
  sessionId: string,
  status: 'active' | 'escalated' | 'closed'
): Promise<void> {
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { status }
  })
}

/**
 * Récupère les statistiques d'une session
 */
export async function getSessionStats(sessionId: string) {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      _count: {
        select: { messages: true }
      },
      messages: {
        where: { role: 'assistant' },
        select: { confidence: true }
      }
    }
  })
  
  if (!session) return null
  
  const confidences = session.messages
    .filter(m => m.confidence !== null)
    .map(m => m.confidence as number)
  
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0
  
  return {
    sessionId,
    status: session.status,
    messageCount: session._count.messages,
    turnCount: session.turnCount,
    averageConfidence: Math.round(avgConfidence * 100) / 100,
    createdAt: session.createdAt,
    topics: session.topics
  }
}

/**
 * Nettoie les sessions expirées (pour cron job)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.chatSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        {
          AND: [
            { status: 'closed' },
            { updatedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } // 7 jours
          ]
        }
      ]
    }
  })
  
  return result.count
}
