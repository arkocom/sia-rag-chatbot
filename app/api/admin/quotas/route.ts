import { NextRequest, NextResponse } from 'next/server'
import { getQuotaStats } from '@/lib/quota-manager'
import { verifyAdminAuth } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/quotas - Statistiques des quotas utilisateurs
 * 
 * Requiert: x-admin-token ou x-admin-secret header
 */
export async function GET(request: NextRequest) {
  // Vérification de l'authentification admin
  const auth = verifyAdminAuth(request)
  if (!auth.authenticated) {
    logger.warn('admin', 'Accès non autorisé à /api/admin/quotas', {
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    })
    return NextResponse.json(
      { error: auth.error || 'Non autorisé', authenticated: false },
      { status: 401 }
    )
  }

  try {
    const stats = await getQuotaStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Erreur récupération stats quotas:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
