import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/gdpr/export - Demande d'export des données (RGPD Art. 20)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id, email, request_type = 'export' } = body
    
    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id requis' },
        { status: 400 }
      )
    }
    
    if (!['export', 'delete'].includes(request_type)) {
      return NextResponse.json(
        { error: 'request_type doit être "export" ou "delete"' },
        { status: 400 }
      )
    }
    
    // Créer la demande
    const exportRequest = await prisma.dataExportRequest.create({
      data: {
        sessionId: session_id,
        email: email || null,
        requestType: request_type,
        status: 'pending'
      }
    })
    
    logger.info('system', `Demande RGPD créée: ${request_type}`, {
      sessionId: session_id,
      requestId: exportRequest.id
    })
    
    // Si c'est un export immédiat, exécuter maintenant
    if (request_type === 'export') {
      const data = await exportUserData(session_id)
      
      // Marquer comme complété
      await prisma.dataExportRequest.update({
        where: { id: exportRequest.id },
        data: { status: 'completed', completedAt: new Date() }
      })
      
      return NextResponse.json({
        success: true,
        request_id: exportRequest.id,
        request_type,
        status: 'completed',
        data,
        message: 'Vos données ont été exportées conformément au RGPD (Art. 20)'
      })
    }
    
    // Pour la suppression, retourner un statut "pending"
    return NextResponse.json({
      success: true,
      request_id: exportRequest.id,
      request_type,
      status: 'pending',
      message: 'Votre demande de suppression sera traitée sous 30 jours conformément au RGPD (Art. 17)'
    })
    
  } catch (error) {
    logger.error('system', 'Erreur demande RGPD', { error: String(error) })
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gdpr/export?request_id=xxx - Statut d'une demande
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('request_id')
    
    if (!requestId) {
      return NextResponse.json(
        { error: 'request_id requis' },
        { status: 400 }
      )
    }
    
    const exportRequest = await prisma.dataExportRequest.findUnique({
      where: { id: requestId }
    })
    
    if (!exportRequest) {
      return NextResponse.json(
        { error: 'Demande non trouvée' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      request_id: exportRequest.id,
      session_id: exportRequest.sessionId,
      request_type: exportRequest.requestType,
      status: exportRequest.status,
      created_at: exportRequest.createdAt,
      completed_at: exportRequest.completedAt
    })
    
  } catch (error) {
    logger.error('system', 'Erreur statut demande RGPD', { error: String(error) })
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/gdpr/export - Exécute une demande de suppression (Art. 17)
 * Nécessite le ADMIN_SECRET
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
    const sessionId = searchParams.get('session_id')
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id requis' },
        { status: 400 }
      )
    }
    
    // Supprimer toutes les données de la session
    const [deletedSession, deletedConsent, deletedLogs] = await Promise.all([
      prisma.chatSession.deleteMany({ where: { id: sessionId } }),
      prisma.gdprConsent.deleteMany({ where: { sessionId } }),
      prisma.systemLog.deleteMany({ where: { sessionId } })
    ])
    
    // Marquer les demandes comme complétées
    await prisma.dataExportRequest.updateMany({
      where: { sessionId, requestType: 'delete', status: 'pending' },
      data: { status: 'completed', completedAt: new Date() }
    })
    
    logger.info('system', 'Données supprimées (RGPD Art. 17)', {
      sessionId,
      deletedSession: deletedSession.count,
      deletedConsent: deletedConsent.count,
      deletedLogs: deletedLogs.count
    })
    
    return NextResponse.json({
      success: true,
      message: 'Données supprimées conformément au RGPD (Art. 17)',
      deleted: {
        sessions: deletedSession.count,
        consents: deletedConsent.count,
        logs: deletedLogs.count
      }
    })
    
  } catch (error) {
    logger.error('system', 'Erreur suppression RGPD', { error: String(error) })
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * Exporte toutes les données d'un utilisateur (session)
 */
async function exportUserData(sessionId: string) {
  const [session, consent, messages, logs] = await Promise.all([
    prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: { messages: true }
    }),
    prisma.gdprConsent.findUnique({ where: { sessionId } }),
    prisma.chatMessage.findMany({ where: { sessionId } }),
    prisma.systemLog.findMany({ 
      where: { sessionId },
      select: {
        level: true,
        category: true,
        message: true,
        createdAt: true
      }
    })
  ])
  
  return {
    export_date: new Date().toISOString(),
    session_id: sessionId,
    session: session ? {
      status: session.status,
      turn_count: session.turnCount,
      topics: session.topics,
      created_at: session.createdAt,
      updated_at: session.updatedAt
    } : null,
    consent: consent ? {
      consent_given: consent.consentGiven,
      purposes: consent.purposes,
      recorded_at: consent.updatedAt
    } : null,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
      intent: m.intent,
      created_at: m.createdAt
    })),
    activity_logs: logs.map(l => ({
      level: l.level,
      category: l.category,
      message: l.message,
      created_at: l.createdAt
    }))
  }
}
