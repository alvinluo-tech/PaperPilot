import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Replace this with your actual admin email, or use process.env.NEXT_PUBLIC_ADMIN_EMAIL
const ADMIN_EMAILS = [process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@paperpilot.com'];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isFactoryRoute = request.nextUrl.pathname.startsWith('/factory');
  const isFactoryLogin = request.nextUrl.pathname === '/factory/login';
  
  const isMainRoute = request.nextUrl.pathname === '/';
  const isLoginRoute = request.nextUrl.pathname === '/login';

  // 1. Protect Factory Routes (Admin Only)
  if (isFactoryRoute && !isFactoryLogin) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/factory/login';
      return NextResponse.redirect(url);
    }
    // Check if user is admin
    if (!ADMIN_EMAILS.includes(user.email || '')) {
      const url = request.nextUrl.clone();
      url.pathname = '/'; // Or a 403 page
      return NextResponse.redirect(url);
    }
  }

  // 2. Manage /factory/login
  if (isFactoryLogin && user) {
    const url = request.nextUrl.clone();
    if (ADMIN_EMAILS.includes(user.email || '')) {
      url.pathname = '/factory';
    } else {
      url.pathname = '/';
    }
    return NextResponse.redirect(url);
  }

  // 3. Protect Main User Portal (Users Only)
  if (isMainRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 4. Redirect authenticated users away from /login
  if (isLoginRoute && user) {
    const url = request.nextUrl.clone();
    if (ADMIN_EMAILS.includes(user.email || '')) {
      url.pathname = '/factory';
    } else {
      url.pathname = '/';
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
