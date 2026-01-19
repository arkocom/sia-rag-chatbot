import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

/**
 * POST /api/admin/auth - Vérifie le mot de passe admin
 */
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    
    const adminPassword = process.env.ADMIN_PASSWORD
    
    if (!adminPassword) {
      logger.error('admin', 'ADMIN_PASSWORD non configuré')
      return NextResponse.json(
        { error: 'Configuration serveur manquante' },
        { status: 500 }
      )
    }
    
    if (password === adminPassword) {
      logger.info('admin', 'Connexion admin réussie', {
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      })
      
      // Générer un token de session simple (valide 24h)
      const sessionToken = Buffer.from(
        JSON.stringify({
          authenticated: true,
          timestamp: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000
        })
      ).toString('base64')
      
      return NextResponse.json({
        success: true,
        token: sessionToken,
        expiresIn: 86400 // 24 heures
      })
    }
    
    logger.warn('admin', 'Tentative de connexion admin échouée', {
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    })
    
    return NextResponse.json(
      { error: 'Mot de passe incorrect' },
      { status: 401 }
    )
    
  } catch (error) {
    logger.error('admin', 'Erreur authentification admin', { error: String(error) })
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}


