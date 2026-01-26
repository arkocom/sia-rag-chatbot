import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware Next.js : rafraîchit la session Supabase sur chaque requête.
 * Protège les routes /api/* (sauf /api/health et /api/docs) en exigeant une session.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Rafraîchir la session (important pour renouveler les tokens expirés)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Routes API protégées : exiger une session authentifiée
  const isProtectedApi =
    request.nextUrl.pathname.startsWith('/api/') &&
    !request.nextUrl.pathname.startsWith('/api/health') &&
    !request.nextUrl.pathname.startsWith('/api/docs') &&
    !request.nextUrl.pathname.startsWith('/api/chat') &&
    !request.nextUrl.pathname.startsWith('/api/ingest')

  if (isProtectedApi && !user) {
    return NextResponse.json(
      { error: 'Non authentifié' },
      { status: 401 }
    )
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Toutes les routes sauf fichiers statiques et _next
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
