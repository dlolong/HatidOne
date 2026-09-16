export const dynamic = 'force-dynamic';

// Liveness only: deliberately makes no claim about database/providers or staffing.
export function GET() {
  return Response.json({ status: 'alive' }, { headers: { 'Cache-Control': 'no-store' } });
}
