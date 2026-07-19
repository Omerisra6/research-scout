import { NextResponse } from 'next/server';
import { runIngest, DEFAULT_SOURCES } from '@/lib/scan';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const enabledSources: string[] = Array.isArray(body.sources) ? body.sources : DEFAULT_SOURCES;

  try {
    const result = await runIngest(enabledSources);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ingest failed' },
      { status: 400 }
    );
  }
}
