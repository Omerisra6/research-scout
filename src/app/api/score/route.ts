import { NextResponse } from 'next/server';
import { getProfile, getUnscoredPapers, upsertScore } from '@/lib/db';
import { scorePaper } from '@/lib/llm';

export async function POST(request: Request) {
  const { limit = 10 } = await request.json().catch(() => ({}));
  
  const profile = getProfile();
  const papers = getUnscoredPapers(limit);

  if (papers.length === 0) {
    return NextResponse.json({ scored: 0, message: 'No unscored papers found' });
  }

  const results = [];

  for (const paper of papers) {
    try {
      const scoreResult = await scorePaper(
        {
          title: paper.title,
          abstract: paper.abstract,
          authors: paper.authors,
          categories: paper.categories,
        },
        {
          industries: profile.industries,
          interests: profile.interests,
        }
      );

      const score = upsertScore(paper.id, scoreResult);
      results.push({ paper_id: paper.id, score });
    } catch (error) {
      console.error(`Failed to score paper ${paper.id}:`, error);
      results.push({ paper_id: paper.id, error: 'Scoring failed' });
    }
  }

  return NextResponse.json({
    scored: results.filter(r => !('error' in r)).length,
    results,
  });
}
