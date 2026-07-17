import { NextRequest, NextResponse } from 'next/server';
import { getPapersWithScores, dismissPaper, createOpportunity } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const minScore = searchParams.get('minScore');
  const category = searchParams.get('category');
  const includeDismissed = searchParams.get('includeDismissed') === 'true';
  const limit = searchParams.get('limit');

  const papers = getPapersWithScores({
    minScore: minScore ? parseInt(minScore) : undefined,
    category: category || undefined,
    includeDismissed,
    limit: limit ? parseInt(limit) : 100,
  });

  return NextResponse.json(papers);
}

export async function POST(request: Request) {
  const { action, paperId } = await request.json();

  if (action === 'dismiss') {
    dismissPaper(paperId);
    return NextResponse.json({ success: true });
  }

  if (action === 'track') {
    const opportunity = createOpportunity(paperId, 'inbox');
    return NextResponse.json({ success: true, opportunity });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
