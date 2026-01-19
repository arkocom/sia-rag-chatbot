import { prisma } from './db'
import { logger } from './logger'

// Limites par plan (questions/jour)
export const PLAN_LIMITS: Record<string, number> = {
  free: 10,
  essential: -1, // Illimité
  premium: -1,   // Illimité
  institutional: -1 // Illimité
}

export interface QuotaStatus {
  allowed: boolean
  plan: string
  dailyUsed: number
  dailyLimit: number
  remaining: number
  resetAt: Date
  message?: string
}

/**
 * Vérifie et met à jour le quota d'un utilisateur
 */
export async function checkAndUpdateQuota(identifier: string): Promise<QuotaStatus> {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  try {
    // Récupérer ou créer le quota
    let quota = await prisma.usageQuota.findUnique({
      where: { identifier }
    })

    if (!quota) {
      // Nouveau utilisateur - créer un quota gratuit
      quota = await prisma.usageQuota.create({
        data: {
          identifier,
          plan: 'free',
          dailyQueries: 0,
          totalQueries: 0,
          quotaResetAt: startOfDay
        }
      })
      logger.info('quota', 'New quota created', { identifier, plan: 'free' })
    }

    // Vérifier si on doit reset le compteur journalier
    const quotaResetDate = new Date(quota.quotaResetAt)
    if (quotaResetDate < startOfDay) {
      // Nouveau jour - reset le compteur
      quota = await prisma.usageQuota.update({
        where: { identifier },
        data: {
          dailyQueries: 0,
          quotaResetAt: startOfDay
        }
      })
      logger.info('quota', 'Daily quota reset', { identifier })
    }

    const limit = PLAN_LIMITS[quota.plan] ?? 10
    const isUnlimited = limit === -1
    const remaining = isUnlimited ? -1 : Math.max(0, limit - quota.dailyQueries)
    const allowed = isUnlimited || quota.dailyQueries < limit

    // Calculer l'heure de reset (minuit prochain)
    const resetAt = new Date(startOfDay)
    resetAt.setDate(resetAt.getDate() + 1)

    if (!allowed) {
      logger.warn('quota', 'Quota exceeded', { identifier, plan: quota.plan, used: quota.dailyQueries })
      return {
        allowed: false,
        plan: quota.plan,
        dailyUsed: quota.dailyQueries,
        dailyLimit: limit,
        remaining: 0,
        resetAt,
        message: `Quota journalier atteint (${limit} questions/jour). Passez à l'offre Essentiel pour un accès illimité.`
      }
    }

    // Incrémenter les compteurs
    await prisma.usageQuota.update({
      where: { identifier },
      data: {
        dailyQueries: quota.dailyQueries + 1,
        totalQueries: quota.totalQueries + 1,
        lastQueryAt: now
      }
    })

    return {
      allowed: true,
      plan: quota.plan,
      dailyUsed: quota.dailyQueries + 1,
      dailyLimit: limit,
      remaining: isUnlimited ? -1 : remaining - 1,
      resetAt
    }
  } catch (error) {
    logger.error('quota', 'Error checking quota', { identifier, error: String(error) })
    // En cas d'erreur, autoriser par défaut (fail open)
    return {
      allowed: true,
      plan: 'free',
      dailyUsed: 0,
      dailyLimit: 10,
      remaining: 10,
      resetAt: new Date()
    }
  }
}

/**
 * Récupère le statut du quota sans incrémenter
 */
export async function getQuotaStatus(identifier: string): Promise<QuotaStatus> {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  try {
    const quota = await prisma.usageQuota.findUnique({
      where: { identifier }
    })

    if (!quota) {
      const resetAt = new Date(startOfDay)
      resetAt.setDate(resetAt.getDate() + 1)
      return {
        allowed: true,
        plan: 'free',
        dailyUsed: 0,
        dailyLimit: 10,
        remaining: 10,
        resetAt
      }
    }

    const limit = PLAN_LIMITS[quota.plan] ?? 10
    const isUnlimited = limit === -1
    
    // Vérifier si c'est un nouveau jour
    const quotaResetDate = new Date(quota.quotaResetAt)
    const dailyUsed = quotaResetDate < startOfDay ? 0 : quota.dailyQueries
    
    const remaining = isUnlimited ? -1 : Math.max(0, limit - dailyUsed)
    const allowed = isUnlimited || dailyUsed < limit

    const resetAt = new Date(startOfDay)
    resetAt.setDate(resetAt.getDate() + 1)

    return {
      allowed,
      plan: quota.plan,
      dailyUsed,
      dailyLimit: limit,
      remaining,
      resetAt
    }
  } catch (error) {
    return {
      allowed: true,
      plan: 'free',
      dailyUsed: 0,
      dailyLimit: 10,
      remaining: 10,
      resetAt: new Date()
    }
  }
}

/**
 * Met à jour le plan d'un utilisateur
 */
export async function updateUserPlan(identifier: string, plan: string): Promise<void> {
  await prisma.usageQuota.upsert({
    where: { identifier },
    create: {
      identifier,
      plan,
      dailyQueries: 0,
      totalQueries: 0
    },
    update: { plan }
  })
  logger.info('quota', 'Plan updated', { identifier, plan })
}

/**
 * Statistiques globales des quotas pour l'admin
 */
export async function getQuotaStats() {
  const stats = await prisma.usageQuota.groupBy({
    by: ['plan'],
    _count: { id: true },
    _sum: { totalQueries: true, dailyQueries: true }
  })

  const totalUsers = await prisma.usageQuota.count()
  const activeToday = await prisma.usageQuota.count({
    where: {
      lastQueryAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    }
  })

  return {
    totalUsers,
    activeToday,
    byPlan: stats.map(s => ({
      plan: s.plan,
      count: s._count.id,
      totalQueries: s._sum.totalQueries ?? 0,
      dailyQueries: s._sum.dailyQueries ?? 0
    }))
  }
}
