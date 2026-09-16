import { NextResponse, type NextRequest } from 'next/server';
import { parseIntent } from '@/lib/auth/journey';
import { authCallbackUrl } from '@/lib/auth/redirects';
import { clearRecoveryCookies, createRecoveryClient } from '@/lib/supabase/recovery';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const configured = authCallbackUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (!configured) return NextResponse.json({ error: 'Recovery is unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const destination = new URL('/forgot-password', configured);
  const intent = parseIntent(request.nextUrl.searchParams.get('intent'));
  if (intent) destination.searchParams.set('intent', intent);
  const code = request.nextUrl.searchParams.get('code');
  const flowId = request.nextUrl.searchParams.get('sb_flow_id');
  let valid = false;
  try {
    if (code) {
      const client = await createRecoveryClient();
      const { data, error } = await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      if (!error && 'redirectType' in data && data.redirectType === 'recovery') {
        const { data: { user }, error: userError } = await client.auth.getUser();
        valid = !userError && !!user;
      }
    }
  } catch { /* Invalid/expired/unavailable recovery produces the same safe redirect. */ }
  if (valid) destination.pathname = '/reset-password';
  else {
    await clearRecoveryCookies();
    destination.searchParams.set('error', 'The recovery link is invalid, expired, or opened in a different browser. Request a new link and open it in the browser that requested it.');
  }
  // No query-controlled next target, codes, tokens or provider errors survive.
  const response = NextResponse.redirect(destination);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
