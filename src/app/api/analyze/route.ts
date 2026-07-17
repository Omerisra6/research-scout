import { NextResponse } from 'next/server';
import { getProfile, getPaperById, getAnalysisByPaperId, upsertAnalysis } from '@/lib/db';
import { analyzePaper } from '@/lib/llm';

export async function POST(request: Request) {
  const { paperId } = await request.json();

  if (!paperId) {
    return NextResponse.json({ error: 'paperId is required' }, { status: 400 });
  }

  const paper = getPaperById(paperId);
  if (!paper) {
    return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
  }

  const existing = getAnalysisByPaperId(paperId);
  if (existing) {
    return NextResponse.json(existing);
  }

  const profile = getProfile();

  const analysisResult = await analyzePaper(
    {
      title: paper.title,
      abstract: paper.abstract,
      authors: paper.authors,
      categories: paper.categories,
      url: paper.url,
    },
    {
      industries: profile.industries,
      interests: profile.interests,
    }
  );

  const analysis = upsertAnalysis(paperId, analysisResult);

  return NextResponse.json(analysis);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const paperId = searchParams.get('paperId');

  if (!paperId) {
    return NextResponse.json({ error: 'paperId is required' }, { status: 400 });
  }

  const analysis = getAnalysisByPaperId(parseInt(paperId));
  
  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  return NextResponse.json(analysis);
}
