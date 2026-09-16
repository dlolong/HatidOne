import { authCallbackUrl } from '@/lib/auth/redirects';
import { journeyDestination, journeyNotice } from '@/lib/auth/journey';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const configured = authCallbackUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (!configured) return NextResponse.json({ error: 'Account confirmation is unavailable.' }, { status: 503 });
  const query = request.nextUrl.searchParams;
  let valid = false;
  try {
    const code = query.get('code');
    if (code) {
      const client = await createClient({ requireCookieWrite: true });
      const flowId = query.get('sb_flow_id');
      const { data, error } = await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      // Recovery has its own isolated session and must use its own callback.
      if (!error && data.session && (!('redirectType' in data) || data.redirectType !== 'recovery')) {
        const { data: { user }, error: userError } = await client.auth.getUser();
        valid = !userError && !!user;
      }
    }
  } catch { /* Invalid/expired/cross-browser PKCE links share an actionable recovery. */ }
  const target = valid ? journeyDestination(query.get('intent'), query.get('next')) : journeyNotice('/login', query.get('intent'), query.get('next'), 'error', 'The confirmation link is invalid, expired, or opened in another browser. If confirmed, sign in here. Otherwise request a new confirmation link and open it in the browser that requested it.');
  const response = NextResponse.redirect(new URL(target, configured));
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
