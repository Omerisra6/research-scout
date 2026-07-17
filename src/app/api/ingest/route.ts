import { NextResponse } from 'next/server';
import { fetchArxivPapers } from '@/lib/arxiv';
import { getProfile, upsertPaper } from '@/lib/db';

export async function POST() {
  const profile = getProfile();

  const categories = profile.arxiv_categories
    .split(',')
    .map(c => c.trim())
    .filter(Boolean);

  const keywords = profile.keywords
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  if (categories.length === 0 && keywords.length === 0) {
    return NextResponse.json(
      { error: 'No categories or keywords configured. Update your settings first.' },
      { status: 400 }
    );
  }

  const papers = await fetchArxivPapers(categories, keywords, 50);
  
  const inserted = papers.map(paper => upsertPaper(paper));

  return NextResponse.json({
    fetched: papers.length,
    papers: inserted,
  });
}
