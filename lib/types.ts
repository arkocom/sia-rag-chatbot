// Types pour le MVP SaaS Chatbot RAG

// ==================== API RESPONSE FORMAT ====================

/**
 * Format standard de réponse JSON pour l'API /message
 * Conforme au brief technique MVP
 */
export interface ChatResponse {
  /** Texte de la réponse générée */
  response_text: string
  
  /** Sources citées avec scores de pertinence */
  sources: SourceReference[]
  
  /** Intention détectée dans la question */
  intent: IntentType
  
  /** Score de confiance (0.0 à 1.0) */
  confidence: number
  
  /** ID de session pour le suivi multi-tour */
  session_id: string
  
  /** Actions/intentions détectées */
  actions: ActionItem[]
  
  /** Métadonnées additionnelles */
  metadata: ResponseMetadata
}

/**
 * Référence à une source avec score
 */
export interface SourceReference {
  /** ID unique de la source */
  id: string
  
  /** Score de pertinence (0.0 à 1.0) */
  score: number
  
  /** Extrait du texte source */
  snippet: string
  
  /** Référence complète (ex: "Sourate Al-Baqara, verset 255") */
  reference: string
  
  /** Type de source */
  source_type: 'coran' | 'hadith' | 'imam'
}

/**
 * Types d'intentions détectables
 */
export type IntentType =
  | 'question_religious'      // Question sur un sujet religieux
  | 'search_verse'            // Recherche d'un verset spécifique
  | 'search_hadith'           // Recherche d'un hadith
  | 'explanation_request'     // Demande d'explication (redirigé)
  | 'greeting'                // Salutation
  | 'escalate'                // Demande d'escalade humaine
  | 'out_of_scope'            // Hors sujet
  | 'unknown'                 // Non déterminé

/**
 * Action à effectuer
 */
export interface ActionItem {
  /** Type d'action */
  type: 'cite_source' | 'human_handoff' | 'clarify' | 'none'
  
  /** Données associées */
  payload?: Record<string, unknown>
}

/**
 * Métadonnées de la réponse
 */
export interface ResponseMetadata {
  /** Temps de traitement (ms) */
  processing_time_ms: number
  
  /** Nombre de sources consultées */
  sources_searched: number
  
  /** Nombre de sources retenues */
  sources_selected: number
  
  /** Modèle LLM utilisé */
  model: string
  
  /** Version de l'API */
  api_version: string
  
  /** Timestamp de la réponse */
  timestamp: string
  
  /** Informations de quota (optionnel) */
  quota?: {
    plan: string
    dailyUsed: number
    dailyLimit: number
    remaining: number
    resetAt: string
  }
}

// ==================== SESSION MANAGEMENT ====================

/**
 * Structure de session utilisateur
 */
export interface UserSession {
  /** ID unique de session */
  id: string
  
  /** Historique des messages (max 10 derniers) */
  messages: SessionMessage[]
  
  /** Contexte accumulé */
  context: SessionContext
  
  /** Date de création */
  created_at: Date
  
  /** Dernière activité */
  last_activity: Date
  
  /** Statut de la session */
  status: 'active' | 'escalated' | 'closed'
}

/**
 * Message dans l'historique de session
 */
export interface SessionMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  intent?: IntentType
}

/**
 * Contexte de session
 */
export interface SessionContext {
  /** Sujets abordés */
  topics: string[]
  
  /** Dernières sources citées */
  last_sources: string[]
  
  /** Nombre d'échanges */
  turn_count: number
}

// ==================== API ENDPOINTS ====================

/**
 * Requête vers /api/message
 */
export interface MessageRequest {
  /** Message utilisateur */
  message: string
  
  /** ID de session (optionnel, créé si absent) */
  session_id?: string
  
  /** Paramètres de contrôle */
  options?: MessageOptions
}

/**
 * Options de contrôle pour l'API
 */
export interface MessageOptions {
  /** Forcer le grounding strict */
  force_grounding?: boolean
  
  /** Nombre max de tokens */
  max_tokens?: number
  
  /** Température du modèle */
  temperature?: number
  
  /** Nombre max de sources à retourner */
  max_sources?: number
}

// ==================== STREAMING ====================

/**
 * Format des événements SSE
 */
export interface StreamEvent {
  status: 'processing' | 'completed' | 'error'
  message?: string
  result?: ChatResponse
  error?: string
}

// ==================== UTILITIES ====================

/**
 * Génère un ID de session unique
 */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Calcule un score de confiance basé sur les sources
 */
export function calculateConfidence(
  sourcesFound: number,
  sourcesRelevant: number,
  intentClarity: number
): number {
  if (sourcesFound === 0) return 0.1
  
  const sourceRatio = Math.min(sourcesRelevant / Math.max(sourcesFound, 1), 1)
  const baseConfidence = 0.3 + (sourceRatio * 0.5) + (intentClarity * 0.2)
  
  return Math.round(baseConfidence * 100) / 100
}

/**
 * Seuil de confiance pour escalade humaine
 */
export const CONFIDENCE_THRESHOLD = 0.4

/**
 * Version de l'API
 */
export const API_VERSION = '1.0.0'
