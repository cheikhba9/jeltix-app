import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Protect private dashboard routes while leaving public events and PWA scanner accessible
  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/sales') ||
    pathname === '/events' ||
    pathname.startsWith('/events/new') ||
    pathname.startsWith('/scans') ||
    pathname.startsWith('/users') ||
    pathname.startsWith('/reports');

  // If the path is public or an API route, allow immediate pass-through
  if (!isProtectedPath) {
    return NextResponse.next({ request });
  }

  // Fast check: If local application session cookie is present, authorize immediately
  const hasAuthCookie = request.cookies.has('jeltix_auth_session');
  if (hasAuthCookie) {
    return NextResponse.next({ request });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // If Supabase is not configured, redirect to login for protected routes
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      return supabaseResponse;
    }
  } catch (err) {
    console.warn('Middleware auth verification notice:', err);
  }

  // Unauthenticated user attempting to access protected route
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('redirect', pathname);
  return NextResponse.redirect(url);
}
