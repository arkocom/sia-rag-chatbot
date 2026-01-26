import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export type AuthUser = {
  id: string
  email: string
}

/**
 * Récupère l'utilisateur authentifié depuis la session Supabase.
 * Retourne AuthUser ou NextResponse(401).
 *
 * Usage:
 *   const auth = await requireAuth()
 *   if (auth instanceof NextResponse) return auth
 *   // auth: AuthUser garanti
 */
export async function requireAuth(): Promise<AuthUser | NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  return { id: user.id, email: user.email! }
}

/**
 * Récupère l'utilisateur depuis la table `users` (profil complet).
 * Crée le profil automatiquement si absent (premier login).
 */
export async function requireUserProfile() {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, auth.id))
    .limit(1)

  if (existing) return existing

  const [created] = await db
    .insert(users)
    .values({ id: auth.id, email: auth.email })
    .returning()

  return created
}
