import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/docs - Documentation API
 */
export async function GET() {
  const documentation = {
    openapi: '3.0.3',
    info: {
      title: 'SIA - Sources Islamiques Authentiques API',
      version: '1.0.0',
      description: 'API pour le chatbot RAG basé sur des sources islamiques authentiques (Coran, Hadiths, Ouvrages des Imams).',
    },
    endpoints: {
      chat: {
        '/api/chat': {
          POST: {
            summary: 'Envoyer un message au chatbot',
            description: 'Point d\'entrée principal pour interagir avec le chatbot SIA.',
            request: {
              body: {
                message: { type: 'string', required: true, description: 'Message de l\'utilisateur' },
              },
              example: {
                message: 'Que dit le Coran sur la patience ?',
              }
            },
            response: {
              format: 'text/event-stream (SSE)',
              final_event: {
                response_text: 'Réponse du chatbot avec citations',
                sources: [{ source_type: 'coran', reference: 'Sourate 2, Verset 153', snippet: '...' }],
                metadata: { processing_time_ms: 1200, sources_searched: 6372, sources_selected: 5 }
              }
            }
          }
        }
      },
      ingest: {
        '/api/ingest': {
          GET: {
            summary: 'Lister les documents indexés',
            parameters: {
              source: { type: 'string', enum: ['coran', 'hadith', 'imam'], description: 'Filtrer par source' },
              search: { type: 'string', description: 'Recherche dans le contenu' },
              page: { type: 'integer', default: 1 },
              limit: { type: 'integer', default: 20, max: 100 }
            }
          },
          POST: {
            summary: 'Ingérer de nouveaux documents',
            request: {
              body: {
                documents: {
                  type: 'array',
                  items: {
                    content: { type: 'string', required: true, minLength: 10 },
                    source: { type: 'string', enum: ['coran', 'hadith', 'imam'], required: true },
                    reference: { type: 'string', required: true, minLength: 3 },
                    metadata: { type: 'object', required: false }
                  }
                }
              }
            }
          },
          DELETE: {
            summary: 'Supprimer un document ou une source entière',
            parameters: {
              id: { type: 'string', description: 'ID du document' },
              source: { type: 'string', enum: ['coran', 'hadith', 'imam'] }
            }
          }
        }
      },
      health: {
        '/api/health': {
          GET: {
            summary: 'Vérifier l\'état du système',
            description: 'Vérifie la connexion à la base de données et à l\'API Gemini.'
          }
        }
      }
    },
    errors: {
      400: { description: 'Requête invalide' },
      500: { description: 'Erreur serveur' }
    }
  }

  return NextResponse.json(documentation)
}
