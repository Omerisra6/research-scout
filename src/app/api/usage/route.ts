import { NextResponse } from 'next/server';
import { getUsageSummary } from '@/lib/db';

export async function GET() {
  const summary = getUsageSummary();
  return NextResponse.json(summary);
}
