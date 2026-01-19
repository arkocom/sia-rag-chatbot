import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdminAuth } from '@/lib/admin-auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/escalations/[id] - Détail d'une escalade
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = verifyAdminAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }
  
  try {
    const escalation = await prisma.chatSession.findUnique({
      where: { id: params.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        },
        adminNotes: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })
    
    if (!escalation) {
      return NextResponse.json({ error: 'Escalade non trouvée' }, { status: 404 })
    }
    
    return NextResponse.json({ escalation })
    
  } catch (error) {
    logger.error('admin', 'Erreur récupération escalade', { error: String(error) })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/admin/escalations/[id]/note - Ajouter une note
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = verifyAdminAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }
  
  try {
    const body = await request.json()
    const { content, action } = body
    
    if (!content) {
      return NextResponse.json({ error: 'Contenu requis' }, { status: 400 })
    }
    
    const note = await prisma.adminNote.create({
      data: {
        sessionId: params.id,
        content,
        action: action || 'note',
        createdBy: 'admin'
      }
    })
    
    logger.info('admin', 'Note ajoutée', { sessionId: params.id, action })
    
    return NextResponse.json({ success: true, note })
    
  } catch (error) {
    logger.error('admin', 'Erreur ajout note', { error: String(error) })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/escalations/[id] - Fermer/supprimer une escalade
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = verifyAdminAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }
  
  try {
    // Marquer comme fermé plutôt que supprimer
    await prisma.chatSession.update({
      where: { id: params.id },
      data: { status: 'closed' }
    })
    
    await prisma.adminNote.create({
      data: {
        sessionId: params.id,
        content: 'Escalade fermée par l\'administrateur',
        action: 'resolved',
        createdBy: 'admin'
      }
    })
    
    logger.info('admin', 'Escalade fermée', { id: params.id })
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    logger.error('admin', 'Erreur fermeture escalade', { error: String(error) })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
