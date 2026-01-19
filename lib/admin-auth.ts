import { NextRequest, NextResponse } from 'next/server'
import { logger } from './logger'

/**
 * Vérifie l'authentification admin via le header x-admin-token
 * ou x-admin-secret (pour les appels API directs)
 */
export function verifyAdminAuth(request: NextRequest): {
  authenticated: boolean
  error?: string
} {
  // Méthode 1: Token de session (depuis la page admin)
  const sessionToken = request.headers.get('x-admin-token')
  if (sessionToken) {
    try {
      const decoded = JSON.parse(Buffer.from(sessionToken, 'base64').toString('utf-8'))
      if (decoded.authenticated && decoded.expiresAt > Date.now()) {
        return { authenticated: true }
      }
      return { authenticated: false, error: 'Session expirée' }
    } catch {
      return { authenticated: false, error: 'Token invalide' }
    }
  }
  
  // Méthode 2: Secret admin (pour les appels API externes)
  const adminSecret = request.headers.get('x-admin-secret')
  if (adminSecret && adminSecret === process.env.ADMIN_SECRET) {
    return { authenticated: true }
  }
  
  return { authenticated: false, error: 'Authentification requise' }
}

/**
 * Wrapper pour protéger les routes admin
 */
export function withAdminAuth(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const auth = verifyAdminAuth(request)
    
    if (!auth.authenticated) {
      logger.warn('admin', 'Accès non autorisé', {
        path: request.nextUrl.pathname,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        error: auth.error
      })
      
      return NextResponse.json(
        { error: auth.error || 'Non autorisé', authenticated: false },
        { status: 401 }
      )
    }
    
    return handler(request)
  }
}
