import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { updateSessionStatus } from '@/lib/session-manager'

export const dynamic = 'force-dynamic'

interface EscalationRequest {
  session_id: string
  user_name?: string
  user_email?: string
  user_phone?: string
  reason: string
  urgency: 'low' | 'medium' | 'high'
  preferred_contact?: 'email' | 'phone'
}

/**
 * POST /api/escalate - Crée une demande d'escalade vers un humain
 */
export async function POST(request: NextRequest) {
  try {
    const body: EscalationRequest = await request.json()
    const { session_id, user_name, user_email, user_phone, reason, urgency, preferred_contact } = body
    
    // Validation
    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id requis' },
        { status: 400 }
      )
    }
    
    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'Raison requise (minimum 10 caractères)' },
        { status: 400 }
      )
    }
    
    // Récupérer la session et son historique
    const session = await prisma.chatSession.findUnique({
      where: { id: session_id },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    })
    
    if (!session) {
      return NextResponse.json(
        { error: 'Session non trouvée' },
        { status: 404 }
      )
    }
    
    // Mettre à jour le statut de la session
    await updateSessionStatus(session_id, 'escalated')
    
    // Préparer le résumé de la conversation
    const conversationSummary = session.messages
      .reverse()
      .map(m => `[${m.role.toUpperCase()}]: ${m.content.substring(0, 200)}${m.content.length > 200 ? '...' : ''}`)
      .join('\n\n')
    
    // Préparer l'email HTML
    const urgencyColors = {
      low: '#22c55e',
      medium: '#f59e0b',
      high: '#ef4444'
    }
    
    const urgencyLabels = {
      low: 'Faible',
      medium: 'Moyenne',
      high: 'Élevée'
    }
    
    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #f8fafc; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🚨 Demande d'Escalade - SIA</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Sources Islamiques Authentiques</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <span style="background: ${urgencyColors[urgency]}; color: white; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
              Urgence: ${urgencyLabels[urgency]}
            </span>
            <span style="background: #e0f2fe; color: #0369a1; padding: 6px 16px; border-radius: 20px; font-size: 14px;">
              Session: ${session_id.substring(0, 12)}...
            </span>
          </div>
          
          <h2 style="color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 0;">Informations Utilisateur</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; width: 140px;">Nom:</td>
              <td style="padding: 8px 0; color: #1e293b; font-weight: 500;">${user_name || 'Non renseigné'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Email:</td>
              <td style="padding: 8px 0;"><a href="mailto:${user_email}" style="color: #0d9488;">${user_email || 'Non renseigné'}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Téléphone:</td>
              <td style="padding: 8px 0; color: #1e293b;">${user_phone || 'Non renseigné'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Contact préféré:</td>
              <td style="padding: 8px 0; color: #1e293b;">${preferred_contact === 'phone' ? 'Téléphone' : 'Email'}</td>
            </tr>
          </table>
          
          <h2 style="color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 30px;">Raison de l'escalade</h2>
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #92400e;">${reason}</p>
          </div>
          
          <h2 style="color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 30px;">Historique de la conversation</h2>
          <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; font-family: monospace; font-size: 13px; white-space: pre-wrap; max-height: 400px; overflow-y: auto;">
${conversationSummary || 'Aucun message dans cette session'}
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="color: #64748b; font-size: 12px; margin: 0;">
              Envoyé depuis SIA (Sources Islamiques Authentiques) le ${new Date().toLocaleString('fr-FR')}
            </p>
            <p style="color: #94a3b8; font-size: 11px; margin: 5px 0 0 0;">
              Sujets abordés: ${session.topics.length > 0 ? session.topics.join(', ') : 'Aucun'} | Tours: ${session.turnCount}
            </p>
          </div>
        </div>
      </div>
    `
    
    // Envoyer l'email de notification
    try {
      const appUrl = process.env.NEXTAUTH_URL || 'https://sia2026.abacusai.app'
      const appName = 'SIA'
      
      const emailResponse = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deployment_token: process.env.ABACUSAI_API_KEY,
          subject: `🚨 [${urgencyLabels[urgency]}] Demande d'escalade SIA - ${user_name || 'Utilisateur anonyme'}`,
          body: htmlBody,
          is_html: true,
          recipient_email: 'nicolasdubois.info@gmail.com',
          sender_email: `noreply@sia2026.abacusai.app`,
          sender_alias: appName,
        }),
      })
      
      const emailResult = await emailResponse.json()
      
      if (!emailResult.success) {
        console.error('Erreur envoi email:', emailResult)
      }
    } catch (emailError) {
      console.error('Erreur email escalade:', emailError)
      // Continue même si l'email échoue
    }
    
    return NextResponse.json({
      success: true,
      message: 'Demande d\'escalade enregistrée. Un spécialiste vous contactera bientôt.',
      escalation_id: `esc_${Date.now()}`,
      session_id,
      status: 'escalated'
    })
    
  } catch (error) {
    console.error('Erreur API escalate:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors de l\'escalade' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/escalate - Liste les escalades (admin)
 */
export async function GET(request: NextRequest) {
  try {
    const escalatedSessions = await prisma.chatSession.findMany({
      where: { status: 'escalated' },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 3
        },
        _count: {
          select: { messages: true }
        }
      }
    })
    
    return NextResponse.json({
      escalations: escalatedSessions.map(s => ({
        session_id: s.id,
        topics: s.topics,
        turn_count: s.turnCount,
        message_count: s._count.messages,
        last_messages: s.messages.map(m => ({
          role: m.role,
          excerpt: m.content.substring(0, 100) + '...',
          created_at: m.createdAt
        })),
        escalated_at: s.updatedAt
      })),
      total: escalatedSessions.length
    })
    
  } catch (error) {
    console.error('Erreur GET escalate:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
