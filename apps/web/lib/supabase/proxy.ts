import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseEnvironment } from './env';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseEnvironment();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard')
    || request.nextUrl.pathname.startsWith('/passenger')
    || request.nextUrl.pathname.startsWith('/book')
    || request.nextUrl.pathname.startsWith('/booking')
    || request.nextUrl.pathname.startsWith('/history')
    || request.nextUrl.pathname.startsWith('/driver')
    || request.nextUrl.pathname.startsWith('/fleet')
    || request.nextUrl.pathname.startsWith('/admin');
  const isAuthRoute = request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup';

  if (!user && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('message', 'Please sign in to continue.');
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthRoute) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}
