import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/docs - Documentation API OpenAPI-like
 */
export async function GET() {
  const documentation = {
    openapi: '3.0.3',
    info: {
      title: 'SIA - Sources Islamiques Authentiques API',
      version: '1.0.0',
      description: 'API RESTful pour le chatbot RAG basé sur des sources islamiques authentiques (Coran, Hadiths, Ouvrages des Imams).',
      contact: {
        name: 'Support SIA',
        email: 'nicolasdubois.info@gmail.com'
      }
    },
    servers: [
      {
        url: 'https://sia2026.abacusai.app',
        description: 'Production'
      }
    ],
    
    // ==================== AUTHENTIFICATION ====================
    authentication: {
      description: 'Certains endpoints nécessitent une authentification via token API.',
      methods: {
        bearer_token: {
          type: 'http',
          scheme: 'bearer',
          description: 'Token API dans le header Authorization: Bearer sia_xxx',
          example: 'Authorization: Bearer sia_abc123def456...'
        },
        admin_secret: {
          type: 'apiKey',
          in: 'header',
          name: 'x-admin-secret',
          description: 'Secret administrateur pour les opérations sensibles'
        }
      }
    },
    
    // ==================== ENDPOINTS ====================
    endpoints: {
      
      // ===== CHAT =====
      chat: {
        '/api/chat': {
          POST: {
            summary: 'Envoyer un message au chatbot',
            description: 'Point d\'entrée principal pour interagir avec le chatbot SIA.',
            authentication: 'Optionnelle',
            request: {
              body: {
                message: { type: 'string', required: true, description: 'Message de l\'utilisateur' },
                session_id: { type: 'string', required: false, description: 'ID de session pour continuer une conversation' }
              },
              example: {
                message: 'Que dit le Coran sur la patience ?',
                session_id: 'sess_abc123'
              }
            },
            response: {
              success: {
                response_text: 'Réponse du chatbot',
                sources: [{ source: 'coran', reference: 'Sourate 2, Verset 153', content: '...', relevance_score: 0.95 }],
                intent: 'question_religious',
                confidence: 0.85,
                session_id: 'sess_abc123',
                turn_count: 3,
                metadata: { processing_time_ms: 1200 }
              }
            }
          }
        }
      },
      
      // ===== SESSION =====
      session: {
        '/api/session': {
          GET: {
            summary: 'Lister les sessions actives ou obtenir les détails d\'une session',
            authentication: 'Recommandée',
            parameters: {
              id: { type: 'string', required: false, description: 'ID de session spécifique' },
              action: { type: 'string', enum: ['cleanup'], description: 'Action spéciale' }
            },
            examples: [
              { url: '/api/session', description: 'Liste toutes les sessions actives' },
              { url: '/api/session?id=sess_xxx', description: 'Détails d\'une session' },
              { url: '/api/session?action=cleanup', description: 'Nettoie les sessions expirées' }
            ]
          },
          PATCH: {
            summary: 'Mettre à jour le statut d\'une session',
            request: {
              body: {
                session_id: { type: 'string', required: true },
                status: { type: 'string', enum: ['active', 'escalated', 'closed'], required: true }
              }
            }
          },
          DELETE: {
            summary: 'Supprimer une session',
            parameters: {
              id: { type: 'string', required: true, description: 'ID de la session à supprimer' }
            }
          }
        }
      },
      
      // ===== INGEST =====
      ingest: {
        '/api/ingest': {
          GET: {
            summary: 'Lister les documents indexés',
            authentication: 'Recommandée',
            parameters: {
              source: { type: 'string', enum: ['coran', 'hadith', 'imam'], description: 'Filtrer par source' },
              search: { type: 'string', description: 'Recherche dans le contenu' },
              page: { type: 'integer', default: 1 },
              limit: { type: 'integer', default: 20, max: 100 }
            }
          },
          POST: {
            summary: 'Ingérer de nouveaux documents',
            authentication: 'Requise (write)',
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
              },
              example: {
                documents: [
                  {
                    content: 'Texte du verset ou hadith...',
                    source: 'coran',
                    reference: 'Sourate 112, Verset 1-4',
                    metadata: { theme: 'tawhid' }
                  }
                ]
              }
            }
          },
          DELETE: {
            summary: 'Supprimer un document ou une source entière',
            authentication: 'Requise (admin)',
            parameters: {
              id: { type: 'string', description: 'ID du document' },
              source: { type: 'string', enum: ['coran', 'hadith', 'imam'], description: 'Supprimer tous les documents d\'une source' }
            }
          }
        }
      },
      
      // ===== ADMIN =====
      admin: {
        '/api/admin': {
          GET: {
            summary: 'Dashboard et statistiques',
            authentication: 'Recommandée',
            parameters: {
              action: { type: 'string', enum: ['stats', 'sources'], description: 'Type de données à récupérer' }
            },
            examples: [
              { url: '/api/admin', description: 'Dashboard général' },
              { url: '/api/admin?action=stats', description: 'Statistiques détaillées' },
              { url: '/api/admin?action=sources', description: 'Liste des sources' }
            ]
          }
        },
        '/api/admin/metrics': {
          GET: {
            summary: 'Métriques agrégées',
            parameters: {
              range: { type: 'string', enum: ['1h', '24h', '7d', '30d'], default: '24h' }
            }
          }
        }
      },
      
      // ===== ESCALADE =====
      escalate: {
        '/api/escalate': {
          POST: {
            summary: 'Créer une demande d\'escalade humaine',
            description: 'Permet à un utilisateur de demander à parler à un spécialiste (imam/savant).',
            request: {
              body: {
                session_id: { type: 'string', required: true },
                user_name: { type: 'string', required: false },
                user_email: { type: 'string', required: false },
                user_phone: { type: 'string', required: false },
                reason: { type: 'string', required: true, minLength: 10 },
                urgency: { type: 'string', enum: ['low', 'medium', 'high'], required: true },
                preferred_contact: { type: 'string', enum: ['email', 'phone'], default: 'email' }
              }
            }
          },
          GET: {
            summary: 'Lister les escalades en attente',
            authentication: 'Requise (admin)'
          }
        }
      },
      
      // ===== AUTH =====
      auth: {
        '/api/auth/token': {
          POST: {
            summary: 'Créer un nouveau token API',
            authentication: 'Requise (admin_secret)',
            request: {
              headers: { 'x-admin-secret': 'Secret administrateur' },
              body: {
                name: { type: 'string', required: true, minLength: 3 },
                permissions: { type: 'array', items: 'string', enum: ['read', 'write', 'admin'], default: ['read'] },
                expires_in_days: { type: 'integer', required: false, description: 'Expiration en jours (null = jamais)' }
              }
            }
          },
          GET: {
            summary: 'Lister les tokens existants',
            authentication: 'Requise (admin_secret)'
          },
          DELETE: {
            summary: 'Révoquer un token',
            authentication: 'Requise (admin_secret)',
            parameters: {
              id: { type: 'string', required: true }
            }
          }
        }
      },
      
      // ===== RGPD =====
      gdpr: {
        '/api/gdpr': {
          POST: {
            summary: 'Enregistrer le consentement RGPD',
            request: {
              body: {
                session_id: { type: 'string', required: true },
                consent_given: { type: 'boolean', required: true },
                purposes: { type: 'array', items: 'string', required: false }
              }
            }
          },
          GET: {
            summary: 'Vérifier le statut du consentement',
            parameters: {
              session_id: { type: 'string', required: true }
            }
          }
        },
        '/api/gdpr/export': {
          POST: {
            summary: 'Demander l\'export ou la suppression des données (RGPD Art. 17 & 20)',
            request: {
              body: {
                session_id: { type: 'string', required: true },
                email: { type: 'string', required: false },
                request_type: { type: 'string', enum: ['export', 'delete'], default: 'export' }
              }
            }
          },
          GET: {
            summary: 'Vérifier le statut d\'une demande',
            parameters: {
              request_id: { type: 'string', required: true }
            }
          },
          DELETE: {
            summary: 'Exécuter une suppression de données',
            authentication: 'Requise (admin_secret)',
            parameters: {
              session_id: { type: 'string', required: true }
            }
          }
        }
      }
    },
    
    // ==================== CODES D'ERREUR ====================
    errors: {
      400: { description: 'Requête invalide - Paramètres manquants ou incorrects' },
      401: { description: 'Non autorisé - Token invalide ou expiré' },
      403: { description: 'Interdit - Permissions insuffisantes' },
      404: { description: 'Non trouvé - Ressource inexistante' },
      500: { description: 'Erreur serveur - Contactez le support' }
    },
    
    // ==================== RATE LIMITING ====================
    rate_limits: {
      description: 'Limites de requêtes par endpoint',
      limits: {
        '/api/chat': '30 requêtes/minute',
        '/api/ingest': '10 requêtes/minute',
        'autres': '60 requêtes/minute'
      }
    }
  }
  
  return NextResponse.json(documentation)
}
