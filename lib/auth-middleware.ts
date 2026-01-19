import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './db'
import { logger } from './logger'

export type Permission = 'read' | 'write' | 'admin'

export interface AuthResult {
  authenticated: boolean
  tokenId?: string
  tokenName?: string
  permissions: Permission[]
  error?: string
}

/**
 * Vérifie l'authentification via token API
 * Token attendu dans le header: Authorization: Bearer sia_xxx
 */
export async function verifyApiToken(
  request: NextRequest,
  requiredPermission?: Permission
): Promise<AuthResult> {
  try {
    const authHeader = request.headers.get('authorization')
    
    // Si pas de header d'auth, mode public (lecture seule limitée)
    if (!authHeader) {
      return {
        authenticated: false,
        permissions: [],
        error: 'Token d\'authentification requis'
      }
    }
    
    // Extraire le token
    const [scheme, token] = authHeader.split(' ')
    
    if (scheme.toLowerCase() !== 'bearer' || !token) {
      return {
        authenticated: false,
        permissions: [],
        error: 'Format d\'authentification invalide. Utilisez: Bearer <token>'
      }
    }
    
    // Vérifier le format du token SIA
    if (!token.startsWith('sia_')) {
      return {
        authenticated: false,
        permissions: [],
        error: 'Format de token invalide'
      }
    }
    
    // Rechercher le token en base
    const apiToken = await prisma.apiToken.findUnique({
      where: { token }
    })
    
    if (!apiToken) {
      logger.warn('auth', 'Token inconnu utilisé', { tokenPrefix: token.substring(0, 10) })
      return {
        authenticated: false,
        permissions: [],
        error: 'Token invalide ou inconnu'
      }
    }
    
    // Vérifier si le token est actif
    if (!apiToken.isActive) {
      logger.warn('auth', 'Token inactif utilisé', { tokenId: apiToken.id })
      return {
        authenticated: false,
        permissions: [],
        error: 'Token révoqué'
      }
    }
    
    // Vérifier l'expiration
    if (apiToken.expiresAt && new Date() > apiToken.expiresAt) {
      logger.warn('auth', 'Token expiré utilisé', { tokenId: apiToken.id })
      return {
        authenticated: false,
        permissions: [],
        error: 'Token expiré'
      }
    }
    
    // Vérifier la permission requise
    const permissions = apiToken.permissions as Permission[]
    
    if (requiredPermission && !permissions.includes(requiredPermission) && !permissions.includes('admin')) {
      logger.warn('auth', 'Permission insuffisante', { 
        tokenId: apiToken.id, 
        required: requiredPermission,
        has: permissions
      })
      return {
        authenticated: true,
        tokenId: apiToken.id,
        tokenName: apiToken.name,
        permissions,
        error: `Permission '${requiredPermission}' requise`
      }
    }
    
    // Mettre à jour lastUsedAt
    await prisma.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() }
    })
    
    logger.debug('auth', 'Authentification réussie', { tokenId: apiToken.id })
    
    return {
      authenticated: true,
      tokenId: apiToken.id,
      tokenName: apiToken.name,
      permissions
    }
    
  } catch (error) {
    logger.error('auth', 'Erreur vérification token', { error: String(error) })
    return {
      authenticated: false,
      permissions: [],
      error: 'Erreur d\'authentification'
    }
  }
}

/**
 * Middleware pour protéger les routes API
 */
export function withAuth(requiredPermission?: Permission) {
  return async (request: NextRequest, handler: (req: NextRequest, auth: AuthResult) => Promise<NextResponse>) => {
    const auth = await verifyApiToken(request, requiredPermission)
    
    if (!auth.authenticated || auth.error) {
      return NextResponse.json(
        { 
          error: auth.error || 'Non autorisé',
          authenticated: false
        },
        { status: 401 }
      )
    }
    
    return handler(request, auth)
  }
}

/**
 * Vérifie le secret admin (pour les opérations sensibles)
 */
export function verifyAdminSecret(request: NextRequest): boolean {
  const adminSecret = request.headers.get('x-admin-secret')
  return adminSecret === process.env.ADMIN_SECRET
}
