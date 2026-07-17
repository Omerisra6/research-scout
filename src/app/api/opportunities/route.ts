import { NextResponse } from 'next/server';
import { getOpportunitiesByStage, updateOpportunity, deleteOpportunity, type OpportunityStage } from '@/lib/db';

export async function GET() {
  const opportunities = getOpportunitiesByStage();
  return NextResponse.json(opportunities);
}

export async function PUT(request: Request) {
  const { paperId, stage, notes } = await request.json();

  if (!paperId) {
    return NextResponse.json({ error: 'paperId is required' }, { status: 400 });
  }

  const opportunity = updateOpportunity(paperId, { 
    stage: stage as OpportunityStage, 
    notes 
  });

  if (!opportunity) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
  }

  return NextResponse.json(opportunity);
}

export async function DELETE(request: Request) {
  const { paperId } = await request.json();

  if (!paperId) {
    return NextResponse.json({ error: 'paperId is required' }, { status: 400 });
  }

  deleteOpportunity(paperId);
  return NextResponse.json({ success: true });
}
