import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * Génère un token API sécurisé
 */
function generateApiToken(): string {
  return `sia_${crypto.randomBytes(32).toString('hex')}`
}

/**
 * POST /api/auth/token - Crée un nouveau token API
 * Nécessite le ADMIN_SECRET dans le header
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier le secret admin
    const adminSecret = request.headers.get('x-admin-secret')
    if (adminSecret !== process.env.ADMIN_SECRET) {
      logger.warn('auth', 'Tentative de création de token non autorisée')
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { name, permissions = ['read'], expires_in_days } = body
    
    if (!name || name.trim().length < 3) {
      return NextResponse.json(
        { error: 'Nom requis (minimum 3 caractères)' },
        { status: 400 }
      )
    }
    
    // Valider les permissions
    const validPermissions = ['read', 'write', 'admin']
    const filteredPermissions = permissions.filter((p: string) => validPermissions.includes(p))
    
    if (filteredPermissions.length === 0) {
      return NextResponse.json(
        { error: 'Au moins une permission valide requise (read, write, admin)' },
        { status: 400 }
      )
    }
    
    // Calculer la date d'expiration
    let expiresAt: Date | null = null
    if (expires_in_days && expires_in_days > 0) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expires_in_days)
    }
    
    // Générer et sauvegarder le token
    const token = generateApiToken()
    
    const apiToken = await prisma.apiToken.create({
      data: {
        name: name.trim(),
        token,
        permissions: filteredPermissions,
        expiresAt
      }
    })
    
    logger.info('auth', `Token API créé: ${name}`, { tokenId: apiToken.id })
    
    return NextResponse.json({
      success: true,
      token_id: apiToken.id,
      token, // Affiché UNE SEULE FOIS
      name: apiToken.name,
      permissions: apiToken.permissions,
      expires_at: apiToken.expiresAt,
      created_at: apiToken.createdAt,
      warning: 'Conservez ce token précieusement, il ne sera plus affiché.'
    })
    
  } catch (error) {
    logger.error('auth', 'Erreur création token', { error: String(error) })
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/auth/token - Liste les tokens (sans les afficher)
 */
export async function GET(request: NextRequest) {
  try {
    const adminSecret = request.headers.get('x-admin-secret')
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      )
    }
    
    const tokens = await prisma.apiToken.findMany({
      select: {
        id: true,
        name: true,
        permissions: true,
        expiresAt: true,
        lastUsedAt: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return NextResponse.json({
      tokens: tokens.map(t => ({
        id: t.id,
        name: t.name,
        permissions: t.permissions,
        expires_at: t.expiresAt,
        last_used_at: t.lastUsedAt,
        is_active: t.isActive,
        is_expired: t.expiresAt ? new Date() > t.expiresAt : false,
        created_at: t.createdAt
      })),
      total: tokens.length
    })
    
  } catch (error) {
    logger.error('auth', 'Erreur listing tokens', { error: String(error) })
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/auth/token?id=xxx - Révoque un token
 */
export async function DELETE(request: NextRequest) {
  try {
    const adminSecret = request.headers.get('x-admin-secret')
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    const tokenId = searchParams.get('id')
    
    if (!tokenId) {
      return NextResponse.json(
        { error: 'ID du token requis' },
        { status: 400 }
      )
    }
    
    // Désactiver le token (soft delete)
    await prisma.apiToken.update({
      where: { id: tokenId },
      data: { isActive: false }
    })
    
    logger.info('auth', `Token révoqué: ${tokenId}`)
    
    return NextResponse.json({
      success: true,
      message: 'Token révoqué',
      token_id: tokenId
    })
    
  } catch (error) {
    logger.error('auth', 'Erreur révocation token', { error: String(error) })
    return NextResponse.json(
      { error: 'Token non trouvé ou erreur serveur' },
      { status: 404 }
    )
  }
}
