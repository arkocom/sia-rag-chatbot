import { z } from 'zod'

// ==================== SCHEMAS ====================

/**
 * Variables serveur (secrètes, jamais exposées au client)
 */
const serverSchema = z.object({
  DATABASE_URL: z
    .string({ required_error: 'DATABASE_URL est obligatoire' })
    .url('DATABASE_URL doit être une URL PostgreSQL valide'),

  GEMINI_API_KEY: z
    .string({ required_error: 'GEMINI_API_KEY est obligatoire' })
    .min(1, 'GEMINI_API_KEY ne peut pas être vide'),

  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .optional(),

  ANTHROPIC_API_KEY: z
    .string()
    .optional(),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
})

/**
 * Variables client (préfixées NEXT_PUBLIC_, accessibles côté navigateur)
 */
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({ required_error: 'NEXT_PUBLIC_SUPABASE_URL est obligatoire' })
    .url('NEXT_PUBLIC_SUPABASE_URL doit être une URL valide'),

  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string({ required_error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY est obligatoire' })
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY ne peut pas être vide'),

  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default('http://localhost:3000'),
})

// ==================== VALIDATION ====================

function validateEnv() {
  // Variables client (disponibles partout)
  const clientResult = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  })

  if (!clientResult.success) {
    const errors = clientResult.error.flatten().fieldErrors
    const missing = Object.entries(errors)
      .map(([key, msgs]) => `  - ${key}: ${msgs?.join(', ')}`)
      .join('\n')
    throw new Error(
      `❌ Variables d'environnement client manquantes ou invalides:\n${missing}\n\nVoir .env.example pour le template.`
    )
  }

  // Variables serveur (seulement côté Node.js)
  if (typeof window === 'undefined') {
    const serverResult = serverSchema.safeParse({
      DATABASE_URL: process.env.DATABASE_URL,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      NODE_ENV: process.env.NODE_ENV,
    })

    if (!serverResult.success) {
      const errors = serverResult.error.flatten().fieldErrors
      const missing = Object.entries(errors)
        .map(([key, msgs]) => `  - ${key}: ${msgs?.join(', ')}`)
        .join('\n')
      throw new Error(
        `❌ Variables d'environnement serveur manquantes ou invalides:\n${missing}\n\nVoir .env.example pour le template.`
      )
    }

    return {
      ...clientResult.data,
      ...serverResult.data,
    }
  }

  return clientResult.data
}

// ==================== EXPORTS ====================

/**
 * Variables d'environnement validées et typées.
 * Lance une erreur explicite au démarrage si une variable manque.
 */
export const env = validateEnv()

/**
 * Variables client (safe à utiliser côté navigateur)
 */
export const clientEnv = {
  SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  APP_URL: env.NEXT_PUBLIC_APP_URL,
} as const

/**
 * Variables serveur (uniquement côté API/server components)
 * Retourne undefined côté client.
 */
export const serverEnv = typeof window === 'undefined'
  ? {
      DATABASE_URL: (env as z.infer<typeof serverSchema> & z.infer<typeof clientSchema>).DATABASE_URL,
      GEMINI_API_KEY: (env as z.infer<typeof serverSchema> & z.infer<typeof clientSchema>).GEMINI_API_KEY,
      SUPABASE_SERVICE_ROLE_KEY: (env as z.infer<typeof serverSchema> & z.infer<typeof clientSchema>).SUPABASE_SERVICE_ROLE_KEY,
      ANTHROPIC_API_KEY: (env as z.infer<typeof serverSchema> & z.infer<typeof clientSchema>).ANTHROPIC_API_KEY,
      NODE_ENV: (env as z.infer<typeof serverSchema> & z.infer<typeof clientSchema>).NODE_ENV,
    } as const
  : undefined
