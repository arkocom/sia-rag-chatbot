import { NextRequest, NextResponse } from 'next/server'
import { getAggregatedMetrics, logger } from '@/lib/logger'
import { verifyAdminAuth } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/metrics - Récupère les métriques agrégées
 * 
 * Requiert: x-admin-token ou x-admin-secret header
 */
export async function GET(request: NextRequest) {
  // Vérification de l'authentification admin
  const auth = verifyAdminAuth(request)
  if (!auth.authenticated) {
    logger.warn('admin', 'Accès non autorisé à /api/admin/metrics', {
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    })
    return NextResponse.json(
      { error: auth.error || 'Non autorisé', authenticated: false },
      { status: 401 }
    )
  }
  
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') as '1h' | '24h' | '7d' | '30d' || '24h'
    
    const metrics = await getAggregatedMetrics(range)
    
    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Erreur API metrics:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
