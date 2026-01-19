import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/gdpr/consent - Enregistre le consentement RGPD
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id, consent_given, purposes = [] } = body
    
    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id requis' },
        { status: 400 }
      )
    }
    
    // Récupérer l'IP et le User-Agent
    const forwarded = request.headers.get('x-forwarded-for')
    const ipAddress = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    
    // Upsert du consentement
    const consent = await prisma.gdprConsent.upsert({
      where: { sessionId: session_id },
      update: {
        consentGiven: consent_given === true,
        purposes,
        ipAddress,
        userAgent
      },
      create: {
        sessionId: session_id,
        consentGiven: consent_given === true,
        purposes,
        ipAddress,
        userAgent
      }
    })
    
    logger.info('system', 'Consentement RGPD enregistré', {
      sessionId: session_id,
      consentGiven: consent_given
    })
    
    return NextResponse.json({
      success: true,
      session_id,
      consent_given: consent.consentGiven,
      purposes: consent.purposes,
      recorded_at: consent.updatedAt
    })
    
  } catch (error) {
    logger.error('system', 'Erreur enregistrement consentement', { error: String(error) })
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gdpr?session_id=xxx - Vérifie le statut du consentement
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id requis' },
        { status: 400 }
      )
    }
    
    const consent = await prisma.gdprConsent.findUnique({
      where: { sessionId }
    })
    
    if (!consent) {
      return NextResponse.json({
        session_id: sessionId,
        consent_given: false,
        purposes: [],
        message: 'Aucun consentement enregistré'
      })
    }
    
    return NextResponse.json({
      session_id: sessionId,
      consent_given: consent.consentGiven,
      purposes: consent.purposes,
      recorded_at: consent.updatedAt
    })
    
  } catch (error) {
    logger.error('system', 'Erreur vérification consentement', { error: String(error) })
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
