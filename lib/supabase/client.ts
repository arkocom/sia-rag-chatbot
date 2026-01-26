import { createBrowserClient } from '@supabase/ssr'

/**
 * Client Supabase côté navigateur (Client Components).
 * Utilise les clés publiques NEXT_PUBLIC_*.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
