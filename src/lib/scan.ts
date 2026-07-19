import { fetchAllSources } from '@/lib/sources';
import { getProfile, upsertPaper, getPaperByArxivId, getUnscoredPapers, upsertScore, Paper, Score } from '@/lib/db';
import { scorePapersBatch } from '@/lib/llm';

export const DEFAULT_SOURCES = ['arxiv', 'openalex', 'huggingface'];

const SCORE_BATCH_SIZE = 10;

export type IngestResult = {
  fetched: number;
  new: number;
  by_source: Record<string, number>;
  papers: Paper[];
};

export type ScoreResult = {
  scored: number;
  results: Array<{ paper_id: number; score?: Score; error?: string }>;
};

export async function runIngest(enabledSources: string[] = DEFAULT_SOURCES): Promise<IngestResult> {
  const profile = getProfile();

  const categories = profile.arxiv_categories
    .split(',')
    .map(c => c.trim())
    .filter(Boolean);

  let keywords = profile.keywords
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  if (keywords.length === 0) {
    keywords = profile.interests
      .split(',')
      .map(k => k.trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  if (categories.length === 0 && keywords.length === 0) {
    throw new Error('No categories or keywords configured. Update your settings first.');
  }

  const { papers, bySource } = await fetchAllSources(categories, keywords, enabledSources);

  const newCount = papers.filter(p => !getPaperByArxivId(p.arxiv_id)).length;
  const inserted = papers.map(paper => upsertPaper(paper));

  return {
    fetched: papers.length,
    new: newCount,
    by_source: bySource,
    papers: inserted,
  };
}

export async function runScoring(limit = 100): Promise<ScoreResult> {
  const profile = getProfile();
  const papers = getUnscoredPapers(limit);

  if (papers.length === 0) {
    return { scored: 0, results: [] };
  }

  const results: ScoreResult['results'] = [];

  for (let i = 0; i < papers.length; i += SCORE_BATCH_SIZE) {
    const batch = papers.slice(i, i + SCORE_BATCH_SIZE);

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

  return {
    scored: results.filter(r => !('error' in r)).length,
    results,
  };
}
