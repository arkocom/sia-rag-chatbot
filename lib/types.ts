// Types pour le chatbot RAG SIA

/**
 * Format de réponse de l'API /api/chat
 */
export interface ChatResponse {
  response_text: string
  sources: SourceReference[]
  metadata: ResponseMetadata
}

/**
 * Référence à une source
 */
export interface SourceReference {
  id: string
  score: number
  snippet: string
  reference: string
  source_type: 'coran' | 'hadith' | 'imam'
}

/**
 * Métadonnées de la réponse
 */
export interface ResponseMetadata {
  processing_time_ms: number
  sources_searched: number
  sources_selected: number
  model: string
  api_version: string
  timestamp: string
}

/**
 * Format des événements SSE
 */
export interface StreamEvent {
  status: 'processing' | 'completed' | 'error'
  message?: string
  result?: ChatResponse
  error?: string
}

export const API_VERSION = '1.0.0'
