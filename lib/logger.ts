/**
 * Système de logging structuré pour SIA
 * Capture les événements, erreurs et métriques
 */

import { prisma } from './db'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogCategory = 'chat' | 'session' | 'search' | 'escalate' | 'ingest' | 'admin' | 'auth' | 'system' | 'quota'

export interface LogEntry {
  level: LogLevel
  category: LogCategory
  message: string
  metadata?: Record<string, unknown>
  sessionId?: string
  userId?: string
  duration?: number
  timestamp?: Date
}

export interface MetricEntry {
  name: string
  value: number
  tags?: Record<string, string>
  timestamp?: Date
}

// In-memory buffer pour les logs (flush périodique en DB)
const logBuffer: LogEntry[] = []
const metricBuffer: MetricEntry[] = []
const BUFFER_SIZE = 50
const FLUSH_INTERVAL = 30000 // 30 secondes

/**
 * Log un événement
 */
export function log(entry: LogEntry): void {
  const fullEntry: LogEntry = {
    ...entry,
    timestamp: entry.timestamp || new Date()
  }
  
  // Console log pour le développement
  const logFn = entry.level === 'error' ? console.error 
    : entry.level === 'warn' ? console.warn 
    : console.log
  
  logFn(`[${fullEntry.level.toUpperCase()}] [${fullEntry.category}] ${fullEntry.message}`, fullEntry.metadata || '')
  
  // Ajouter au buffer
  logBuffer.push(fullEntry)
  
  // Flush si buffer plein
  if (logBuffer.length >= BUFFER_SIZE) {
    flushLogs()
  }
}

/**
 * Enregistre une métrique
 */
export function recordMetric(entry: MetricEntry): void {
  const fullEntry: MetricEntry = {
    ...entry,
    timestamp: entry.timestamp || new Date()
  }
  
  metricBuffer.push(fullEntry)
  
  if (metricBuffer.length >= BUFFER_SIZE) {
    flushMetrics()
  }
}

/**
 * Raccourcis pour les différents niveaux de log
 */
export const logger = {
  debug: (category: LogCategory, message: string, metadata?: Record<string, unknown>) => 
    log({ level: 'debug', category, message, metadata }),
  
  info: (category: LogCategory, message: string, metadata?: Record<string, unknown>) => 
    log({ level: 'info', category, message, metadata }),
  
  warn: (category: LogCategory, message: string, metadata?: Record<string, unknown>) => 
    log({ level: 'warn', category, message, metadata }),
  
  error: (category: LogCategory, message: string, metadata?: Record<string, unknown>) => 
    log({ level: 'error', category, message, metadata }),
  
  // Mesure de durée
  startTimer: () => Date.now(),
  endTimer: (start: number) => Date.now() - start,
}

/**
 * Enregistre les métriques de requête
 */
export function recordRequestMetrics(params: {
  endpoint: string
  method: string
  statusCode: number
  duration: number
  sessionId?: string
}): void {
  recordMetric({
    name: 'api_request',
    value: params.duration,
    tags: {
      endpoint: params.endpoint,
      method: params.method,
      status: String(params.statusCode),
      session: params.sessionId || 'none'
    }
  })
}

/**
 * Enregistre les métriques de chat
 */
export function recordChatMetrics(params: {
  intent: string
  confidence: number
  sourcesFound: number
  sourcesUsed: number
  responseTime: number
  sessionId: string
  turnCount: number
}): void {
  recordMetric({
    name: 'chat_interaction',
    value: params.responseTime,
    tags: {
      intent: params.intent,
      confidence_bucket: params.confidence >= 0.7 ? 'high' : params.confidence >= 0.4 ? 'medium' : 'low',
      sources_found: String(params.sourcesFound),
      sources_used: String(params.sourcesUsed),
      turn: String(params.turnCount)
    }
  })
}

/**
 * Flush les logs en base de données
 */
async function flushLogs(): Promise<void> {
  if (logBuffer.length === 0) return
  
  const logsToFlush = [...logBuffer]
  logBuffer.length = 0
  
  try {
    await prisma.systemLog.createMany({
      data: logsToFlush.map(l => ({
        level: l.level,
        category: l.category,
        message: l.message,
        metadata: l.metadata ? JSON.parse(JSON.stringify(l.metadata)) : undefined,
        sessionId: l.sessionId,
        userId: l.userId,
        duration: l.duration,
        createdAt: l.timestamp
      }))
    })
  } catch (error) {
    console.error('Erreur flush logs:', error)
    // Remettre les logs dans le buffer en cas d'erreur
    logBuffer.push(...logsToFlush)
  }
}

/**
 * Flush les métriques en base de données
 */
async function flushMetrics(): Promise<void> {
  if (metricBuffer.length === 0) return
  
  const metricsToFlush = [...metricBuffer]
  metricBuffer.length = 0
  
  try {
    await prisma.systemMetric.createMany({
      data: metricsToFlush.map(m => ({
        name: m.name,
        value: m.value,
        tags: m.tags ? JSON.parse(JSON.stringify(m.tags)) : undefined,
        createdAt: m.timestamp
      }))
    })
  } catch (error) {
    console.error('Erreur flush metrics:', error)
    metricBuffer.push(...metricsToFlush)
  }
}

/**
 * Récupère les statistiques agrégées
 */
export async function getAggregatedMetrics(timeRange: '1h' | '24h' | '7d' | '30d' = '24h') {
  const now = new Date()
  const rangeMs = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  }
  const since = new Date(now.getTime() - rangeMs[timeRange])
  
  // Compter les requêtes par endpoint
  const requestMetrics = await prisma.systemMetric.findMany({
    where: {
      name: 'api_request',
      createdAt: { gte: since }
    }
  })
  
  // Compter les interactions chat
  const chatMetrics = await prisma.systemMetric.findMany({
    where: {
      name: 'chat_interaction',
      createdAt: { gte: since }
    }
  })
  
  // Compter les erreurs
  const errorLogs = await prisma.systemLog.count({
    where: {
      level: 'error',
      createdAt: { gte: since }
    }
  })
  
  // Calculer les moyennes
  const avgResponseTime = chatMetrics.length > 0 
    ? chatMetrics.reduce((sum, m) => sum + m.value, 0) / chatMetrics.length 
    : 0
  
  // Grouper par intent
  const intentCounts: Record<string, number> = {}
  chatMetrics.forEach(m => {
    const tags = m.tags as Record<string, string> || {}
    const intent = tags.intent || 'unknown'
    intentCounts[intent] = (intentCounts[intent] || 0) + 1
  })
  
  return {
    time_range: timeRange,
    total_requests: requestMetrics.length,
    total_chats: chatMetrics.length,
    error_count: errorLogs,
    avg_response_time_ms: Math.round(avgResponseTime),
    intents: intentCounts,
    generated_at: now.toISOString()
  }
}

// Démarrer le flush périodique
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    flushLogs()
    flushMetrics()
  }, FLUSH_INTERVAL)
}
