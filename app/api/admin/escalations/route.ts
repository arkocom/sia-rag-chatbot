import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminAuth } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/escalations - Liste des escalades
 * 
 * Query params:
 * - status: filtre par statut (escalated, in_progress, resolved)
 * - priority: filtre par priorité (low, normal, high, urgent)
 * - limit: nombre de résultats (default: 50)
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }
  
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const limit = parseInt(searchParams.get('limit') || '50')
    
    const where: any = {
      status: { in: ['escalated', 'in_progress', 'resolved'] }
    }
    
    if (status) {
      where.status = status
    }
    
    if (priority) {
      where.priority = priority
    }
    
    const escalations = await prisma.chatSession.findMany({
      where,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 20
        },
        adminNotes: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { escalatedAt: 'desc' }
      ],
      take: limit
    })
    
    // Statistiques
    const stats = await prisma.chatSession.groupBy({
      by: ['status'],
      where: {
        status: { in: ['escalated', 'in_progress', 'resolved'] }
      },
      _count: { id: true }
    })
    
    const priorityStats = await prisma.chatSession.groupBy({
      by: ['priority'],
      where: {
        status: { in: ['escalated', 'in_progress'] }
      },
      _count: { id: true }
    })
    
    return NextResponse.json({
      escalations: escalations.map(e => ({
        id: e.id,
        status: e.status,
        priority: e.priority,
        turnCount: e.turnCount,
        topics: e.topics,
        userEmail: e.userEmail,
        userIdentifier: e.userIdentifier,
        escalatedAt: e.escalatedAt,
        escalationReason: e.escalationReason,
        assignedTo: e.assignedTo,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        messages: e.messages,
        adminNotes: e.adminNotes,
        messageCount: e.messages.length
      })),
      stats: {
        byStatus: stats.reduce((acc, s) => ({ ...acc, [s.status]: s._count.id }), {}),
        byPriority: priorityStats.reduce((acc, p) => ({ ...acc, [p.priority]: p._count.id }), {})
      },
      total: escalations.length
    })
    
  } catch (error) {
    logger.error('admin', 'Erreur récupération escalades', { error: String(error) })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/escalations - Mettre à jour une escalade
 * 
 * Body:
 * - id: ID de l'escalade
 * - status: nouveau statut
 * - priority: nouvelle priorité
 * - assignedTo: admin assigné
 * - note: note à ajouter
 */
export async function PATCH(request: NextRequest) {
  const auth = verifyAdminAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }
  
  try {
    const body = await request.json()
    const { id, status, priority, assignedTo, note, action } = body
    
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }
    
    // Vérifier que l'escalade existe
    const existing = await prisma.chatSession.findUnique({
      where: { id }
    })
    
    if (!existing) {
      return NextResponse.json({ error: 'Escalade non trouvée' }, { status: 404 })
    }
    
    // Préparer les mises à jour
    const updateData: any = { updatedAt: new Date() }
    
    if (status) {
      updateData.status = status
    }
    
    if (priority) {
      updateData.priority = priority
    }
    
    if (assignedTo !== undefined) {
      updateData.assignedTo = assignedTo
    }
    
    // Mettre à jour l'escalade
    const updated = await prisma.chatSession.update({
      where: { id },
      data: updateData,
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        adminNotes: { orderBy: { createdAt: 'desc' } }
      }
    })
    
    // Ajouter une note si fournie
    if (note) {
      await prisma.adminNote.create({
        data: {
          sessionId: id,
          content: note,
          action: action || 'note',
          createdBy: 'admin'
        }
      })
    }
    
    // Ajouter une note automatique pour le changement de statut
    if (status && status !== existing.status) {
      await prisma.adminNote.create({
        data: {
          sessionId: id,
          content: `Statut changé: ${existing.status} → ${status}`,
          action: 'status_change',
          createdBy: 'admin'
        }
      })
    }
    
    logger.info('admin', 'Escalade mise à jour', { id, status, priority })
    
    return NextResponse.json({
      success: true,
      escalation: updated
    })
    
  } catch (error) {
    logger.error('admin', 'Erreur mise à jour escalade', { error: String(error) })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
