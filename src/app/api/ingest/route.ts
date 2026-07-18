import { NextResponse } from 'next/server';
import { fetchAllSources } from '@/lib/sources';
import { getProfile, upsertPaper, getPaperByArxivId } from '@/lib/db';

const DEFAULT_SOURCES = ['arxiv', 'openalex', 'huggingface'];

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const enabledSources: string[] = Array.isArray(body.sources) ? body.sources : DEFAULT_SOURCES;

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
    return NextResponse.json(
      { error: 'No categories or keywords configured. Update your settings first.' },
      { status: 400 }
    );
  }

  const { papers, bySource } = await fetchAllSources(categories, keywords, enabledSources);

  const newCount = papers.filter(p => !getPaperByArxivId(p.arxiv_id)).length;
  const inserted = papers.map(paper => upsertPaper(paper));

  return NextResponse.json({
    fetched: papers.length,
    new: newCount,
    by_source: bySource,
    papers: inserted,
  });
}
