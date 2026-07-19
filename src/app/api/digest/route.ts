import { NextResponse } from 'next/server';
import { runDailyDigest } from '@/lib/digest';
import { getLastDigest, getLastDigestAttempt } from '@/lib/db';

export async function GET() {
  const last = getLastDigest();
  const lastAttempt = getLastDigestAttempt();
  return NextResponse.json({ last_sent: last ?? null, last_attempt: lastAttempt ?? null });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const outcome = await runDailyDigest({ force: body.force === true });
  const status = outcome.status === 'error' ? 500 : 200;
  return NextResponse.json(outcome, { status });
}
