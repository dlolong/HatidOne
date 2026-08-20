import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const destination = request.nextUrl.clone();

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      destination.pathname = '/dashboard';
      destination.search = '';
      return NextResponse.redirect(destination);
    }
  }

  destination.pathname = '/login';
  destination.search = '';
  destination.searchParams.set('error', 'The confirmation link is invalid or has expired.');
  return NextResponse.redirect(destination);
}
