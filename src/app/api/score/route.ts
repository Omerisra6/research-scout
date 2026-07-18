import { NextResponse } from 'next/server';
import { getProfile, getUnscoredPapers, upsertScore } from '@/lib/db';
import { scorePapersBatch } from '@/lib/llm';

const BATCH_SIZE = 10;

export async function POST(request: Request) {
  const { limit = 100 } = await request.json().catch(() => ({}));

  const profile = getProfile();
  const papers = getUnscoredPapers(limit);

  if (papers.length === 0) {
    return NextResponse.json({ scored: 0, message: 'No unscored papers found' });
  }

  const results = [];

  for (let i = 0; i < papers.length; i += BATCH_SIZE) {
    const batch = papers.slice(i, i + BATCH_SIZE);

    try {
      const scoreResults = await scorePapersBatch(
        batch.map(p => ({
          title: p.title,
          abstract: p.abstract,
          categories: p.categories,
        })),
        {
          industries: profile.industries,
          interests: profile.interests,
        }
      );

      for (let j = 0; j < batch.length; j++) {
        const score = upsertScore(batch[j].id, scoreResults[j]);
        results.push({ paper_id: batch[j].id, score });
      }
    } catch (error) {
      console.error(`Failed to score batch starting at ${i}:`, error);
      for (const paper of batch) {
        results.push({ paper_id: paper.id, error: 'Scoring failed' });
      }
    }
  }

  return NextResponse.json({
    scored: results.filter(r => !('error' in r)).length,
    results,
  });
}
