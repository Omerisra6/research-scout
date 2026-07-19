import { NextResponse } from 'next/server';
import { runScoring } from '@/lib/scan';

export async function POST(request: Request) {
  const { limit = 100 } = await request.json().catch(() => ({}));

  const result = await runScoring(limit);

  if (result.scored === 0 && result.results.length === 0) {
    return NextResponse.json({ scored: 0, message: 'No unscored papers found' });
  }

  return NextResponse.json(result);
}
