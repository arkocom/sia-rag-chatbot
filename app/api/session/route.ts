import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionStats, updateSessionStatus, cleanupExpiredSessions } from '@/lib/session-manager'

export const dynamic = 'force-dynamic'

/**
 * GET /api/session?id=xxx - Récupère les détails d'une session
 * GET /api/session?action=cleanup - Nettoie les sessions expirées
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('id')
    const action = searchParams.get('action')
    
    // Action de nettoyage
    if (action === 'cleanup') {
      const deletedCount = await cleanupExpiredSessions()
      return NextResponse.json({
        success: true,
        message: `${deletedCount} session(s) expirée(s) supprimée(s)`,
        deleted_count: deletedCount
      })
    }
    
    // Récupérer une session spécifique
    if (sessionId) {
      const stats = await getSessionStats(sessionId)
      
      if (!stats) {
        return NextResponse.json(
          { error: 'Session non trouvée' },
          { status: 404 }
        )
      }
      
      // Récupérer les messages de la session
      const messages = await prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          intent: true,
          confidence: true,
          createdAt: true,
        }
      })
      
      return NextResponse.json({
        ...stats,
        messages
      })
    }
    
    // Lister toutes les sessions actives
    const sessions = await prisma.chatSession.findMany({
      where: { status: 'active' },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        turnCount: true,
        topics: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { messages: true }
        }
      }
    })
    
    return NextResponse.json({
      sessions: sessions.map(s => ({
        id: s.id,
        status: s.status,
        turn_count: s.turnCount,
        message_count: s._count.messages,
        topics: s.topics,
        created_at: s.createdAt,
        updated_at: s.updatedAt
      })),
      total: sessions.length
    })
    
  } catch (error) {
    console.error('Erreur API session:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/session - Met à jour le statut d'une session
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id, status } = body
    
    if (!session_id || !status) {
      return NextResponse.json(
        { error: 'session_id et status requis' },
        { status: 400 }
      )
    }
    
    if (!['active', 'escalated', 'closed'].includes(status)) {
      return NextResponse.json(
        { error: 'Statut invalide. Valeurs acceptées: active, escalated, closed' },
        { status: 400 }
      )
    }
    
    await updateSessionStatus(session_id, status)
    
    return NextResponse.json({
      success: true,
      session_id,
      new_status: status
    })
    
  } catch (error) {
    console.error('Erreur PATCH session:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/session?id=xxx - Supprime une session
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('id')
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'ID de session requis' },
        { status: 400 }
      )
    }
    
    // Supprimer la session (les messages sont supprimés en cascade)
    await prisma.chatSession.delete({
      where: { id: sessionId }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Session supprimée',
      session_id: sessionId
    })
    
  } catch (error) {
    console.error('Erreur DELETE session:', error)
    return NextResponse.json(
      { error: 'Session non trouvée ou erreur serveur' },
      { status: 404 }
    )
  }
}
