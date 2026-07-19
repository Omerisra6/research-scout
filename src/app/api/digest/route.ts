import { NextResponse } from 'next/server';
import { runDailyDigest } from '@/lib/digest';
import { getLastDigest } from '@/lib/db';

export async function GET() {
  const last = getLastDigest();
  return NextResponse.json({ last_sent: last ?? null });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const outcome = await runDailyDigest({ force: body.force === true });
  const status = outcome.status === 'error' ? 500 : 200;
  return NextResponse.json(outcome, { status });
}
