import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { authJourneyHref, journeyDestination } from '@/lib/auth/journey';
import { getSupabaseEnvironment } from './env';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const protectedRoots = ['/dashboard', '/passenger', '/book', '/booking', '/history', '/driver', '/fleet', '/admin', '/organizations', '/notifications', '/referrals', '/driver-application', '/account'];
  const isProtectedRoute = protectedRoots.some(root => request.nextUrl.pathname === root || request.nextUrl.pathname.startsWith(`${root}/`));
  const needsSession = isProtectedRoute || ['/login', '/signup'].includes(request.nextUrl.pathname);
  if (!needsSession) return response;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.redirect(new URL('/setup', request.url));
  }
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
  const isAuthRoute = request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup';

  function redirectWithCookies(path: string) {
    const redirected = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
    return redirected;
  }
  if (!user && isProtectedRoute) {
    const driverJourney = request.nextUrl.pathname === '/driver-application' || request.nextUrl.pathname === '/driver/onboarding';
    if (driverJourney) return redirectWithCookies('/signup?intent=driver');
    const next = request.nextUrl.pathname + request.nextUrl.search;
    const intent = /^\/(book|booking|passenger)(\/|$)/.test(request.nextUrl.pathname) ? 'passenger' : null;
    return redirectWithCookies(authJourneyHref('/login', intent, next));
  }
  if (user && isAuthRoute) {
    return redirectWithCookies(journeyDestination(request.nextUrl.searchParams.get('intent'), request.nextUrl.searchParams.get('next')));
  }

  return response;
}
