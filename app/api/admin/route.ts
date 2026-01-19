import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminAuth } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin - Dashboard et statistiques
 * GET /api/admin?action=stats - Statistiques détaillées
 * GET /api/admin?action=sources - Liste des sources
 * 
 * Requiert: x-admin-token ou x-admin-secret header
 */
export async function GET(request: NextRequest) {
  // Vérification de l'authentification admin
  const auth = verifyAdminAuth(request)
  if (!auth.authenticated) {
    logger.warn('admin', 'Accès non autorisé à /api/admin', {
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    })
    return NextResponse.json(
      { error: auth.error || 'Non autorisé', authenticated: false },
      { status: 401 }
    )
  }
  
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    // Statistiques détaillées
    if (action === 'stats') {
      // Compter les documents par source
      const documentStats = await prisma.documentChunk.groupBy({
        by: ['source'],
        _count: { id: true }
      })
      
      // Compter les sessions
      const sessionStats = await prisma.chatSession.groupBy({
        by: ['status'],
        _count: { id: true }
      })
      
      // Compter les messages
      const messageCount = await prisma.chatMessage.count()
      
      // Messages par jour (7 derniers jours)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const recentMessages = await prisma.chatMessage.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true }
      })
      
      // Grouper par jour
      const messagesByDay: Record<string, number> = {}
      recentMessages.forEach(m => {
        const day = m.createdAt.toISOString().split('T')[0]
        messagesByDay[day] = (messagesByDay[day] || 0) + 1
      })
      
      // Confiance moyenne
      const confidenceData = await prisma.chatMessage.aggregate({
        where: { confidence: { not: null } },
        _avg: { confidence: true },
        _min: { confidence: true },
        _max: { confidence: true }
      })
      
      // Top sujets des sessions
      const sessions = await prisma.chatSession.findMany({
        select: { topics: true }
      })
      const topicCounts: Record<string, number> = {}
      sessions.forEach(s => {
        s.topics.forEach(t => {
          topicCounts[t] = (topicCounts[t] || 0) + 1
        })
      })
      const topTopics = Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([topic, count]) => ({ topic, count }))
      
      return NextResponse.json({
        documents: {
          total: documentStats.reduce((sum, d) => sum + d._count.id, 0),
          by_source: documentStats.map(d => ({
            source: d.source,
            count: d._count.id
          }))
        },
        sessions: {
          total: sessionStats.reduce((sum, s) => sum + s._count.id, 0),
          by_status: sessionStats.map(s => ({
            status: s.status,
            count: s._count.id
          }))
        },
        messages: {
          total: messageCount,
          by_day: messagesByDay
        },
        confidence: {
          average: Math.round((confidenceData._avg.confidence || 0) * 100) / 100,
          min: Math.round((confidenceData._min.confidence || 0) * 100) / 100,
          max: Math.round((confidenceData._max.confidence || 0) * 100) / 100
        },
        top_topics: topTopics,
        generated_at: new Date().toISOString()
      })
    }
    
    // Liste des sources
    if (action === 'sources') {
      const sources = await prisma.documentChunk.findMany({
        select: {
          id: true,
          source: true,
          reference: true,
          content: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      })
      
      return NextResponse.json({
        sources: sources.map(s => ({
          id: s.id,
          source: s.source,
          reference: s.reference,
          excerpt: s.content.substring(0, 200) + '...',
          created_at: s.createdAt
        })),
        total: sources.length
      })
    }
    
    // Dashboard par défaut
    const [docCount, sessionCount, messageCount] = await Promise.all([
      prisma.documentChunk.count(),
      prisma.chatSession.count(),
      prisma.chatMessage.count()
    ])
    
    // Sessions actives
    const activeSessions = await prisma.chatSession.count({
      where: { status: 'active' }
    })
    
    // Sessions escalées
    const escalatedSessions = await prisma.chatSession.count({
      where: { status: 'escalated' }
    })
    
    return NextResponse.json({
      status: 'ok',
      version: '1.0.0',
      stats: {
        documents: docCount,
        sessions: {
          total: sessionCount,
          active: activeSessions,
          escalated: escalatedSessions
        },
        messages: messageCount
      },
      endpoints: {
        chat: '/api/chat',
        session: '/api/session',
        admin: '/api/admin',
        ingest: '/api/ingest'
      }
    })
    
  } catch (error) {
    console.error('Erreur API admin:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
