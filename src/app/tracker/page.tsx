'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type Score = {
  id: number;
  paper_id: number;
  viability: number;
  rationale: string;
  application_hint: string;
  scored_at: string;
};

type Paper = {
  id: number;
  arxiv_id: string;
  title: string;
  abstract: string;
  authors: string;
  categories: string;
  published_at: string;
  url: string;
  fetched_at: string;
  dismissed: number;
};

type Opportunity = {
  id: number;
  paper_id: number;
  stage: string;
  notes: string;
  updated_at: string;
  paper: Paper;
  score?: Score;
};

const STAGES = [
  { id: 'inbox', label: 'Inbox', color: 'bg-gray-100' },
  { id: 'exploring', label: 'Exploring', color: 'bg-blue-100' },
  { id: 'contacted', label: 'Contacted Author', color: 'bg-yellow-100' },
  { id: 'validating', label: 'Validating', color: 'bg-purple-100' },
  { id: 'active', label: 'Active', color: 'bg-green-100' },
  { id: 'dropped', label: 'Dropped', color: 'bg-red-100' },
];

function OpportunityCard({ 
  opportunity, 
  onMoveStage, 
  onUpdateNotes,
  onRemove,
}: { 
  opportunity: Opportunity;
  onMoveStage: (paperId: number, stage: string) => void;
  onUpdateNotes: (paperId: number, notes: string) => void;
  onRemove: (paperId: number) => void;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(opportunity.notes);

  const handleSaveNotes = () => {
    onUpdateNotes(opportunity.paper_id, notes);
    setEditingNotes(false);
  };

  const currentStageIndex = STAGES.findIndex(s => s.id === opportunity.stage);
  const canMoveForward = currentStageIndex < STAGES.length - 1 && opportunity.stage !== 'dropped';
  const canMoveBack = currentStageIndex > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link href={`/paper/${opportunity.paper_id}`} className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-2">
            {opportunity.paper.title}
          </h4>
        </Link>
        {opportunity.score && (
          <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded ${
            opportunity.score.viability >= 7 ? 'bg-green-100 text-green-700' :
            opportunity.score.viability >= 4 ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {opportunity.score.viability}
          </span>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-2 truncate">
        {opportunity.paper.authors.split(',')[0]}
      </p>

      {editingNotes ? (
        <div className="mb-2">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full text-xs border border-gray-300 rounded p-2 resize-none text-gray-900"
            rows={3}
            placeholder="Add notes..."
            autoFocus
          />
          <div className="flex justify-end gap-1 mt-1">
            <button
              onClick={() => setEditingNotes(false)}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNotes}
              className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div 
          onClick={() => setEditingNotes(true)}
          className="text-xs text-gray-600 mb-2 cursor-pointer hover:bg-gray-50 rounded p-1 -m-1 min-h-[20px]"
        >
          {opportunity.notes || <span className="text-gray-400 italic">Click to add notes...</span>}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1">
          {canMoveBack && (
            <button
              onClick={() => onMoveStage(opportunity.paper_id, STAGES[currentStageIndex - 1].id)}
              className="text-xs text-gray-500 hover:text-gray-700 px-1"
              title="Move back"
            >
              ←
            </button>
          )}
          {canMoveForward && (
            <button
              onClick={() => onMoveStage(opportunity.paper_id, STAGES[currentStageIndex + 1].id)}
              className="text-xs text-blue-600 hover:text-blue-800 px-1"
              title="Move forward"
            >
              →
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {opportunity.stage !== 'dropped' && (
            <button
              onClick={() => onMoveStage(opportunity.paper_id, 'dropped')}
              className="text-xs text-red-500 hover:text-red-700 px-1"
              title="Drop"
            >
              Drop
            </button>
          )}
          <button
            onClick={() => onRemove(opportunity.paper_id)}
            className="text-xs text-gray-400 hover:text-gray-600 px-1"
            title="Remove from tracker"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

function StageColumn({ 
  stage, 
  opportunities, 
  onMoveStage,
  onUpdateNotes,
  onRemove,
}: { 
  stage: typeof STAGES[0];
  opportunities: Opportunity[];
  onMoveStage: (paperId: number, stage: string) => void;
  onUpdateNotes: (paperId: number, notes: string) => void;
  onRemove: (paperId: number) => void;
}) {
  const stageOpps = opportunities.filter(o => o.stage === stage.id);

  return (
    <div className="flex-1 min-w-[280px] max-w-[320px]">
      <div className={`rounded-t-lg px-3 py-2 ${stage.color}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 text-sm">{stage.label}</h3>
          <span className="text-xs text-gray-600 bg-white/50 px-1.5 py-0.5 rounded">
            {stageOpps.length}
          </span>
        </div>
      </div>
      <div className="bg-gray-50 rounded-b-lg p-2 space-y-2 min-h-[200px]">
        {stageOpps.map(opp => (
          <OpportunityCard
            key={opp.id}
            opportunity={opp}
            onMoveStage={onMoveStage}
            onUpdateNotes={onUpdateNotes}
            onRemove={onRemove}
          />
        ))}
        {stageOpps.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No items</p>
        )}
      </div>
    </div>
  );
}

export default function TrackerPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOpportunities = useCallback(async () => {
    const res = await fetch('/api/opportunities');
    const data = await res.json();
    setOpportunities(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const handleMoveStage = async (paperId: number, stage: string) => {
    await fetch('/api/opportunities', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperId, stage }),
    });
    await fetchOpportunities();
  };

  const handleUpdateNotes = async (paperId: number, notes: string) => {
    await fetch('/api/opportunities', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperId, notes }),
    });
    await fetchOpportunities();
  };

  const handleRemove = async (paperId: number) => {
    await fetch('/api/opportunities', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperId }),
    });
    await fetchOpportunities();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-full mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-gray-500 hover:text-gray-700">
                ← Feed
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">Opportunity Tracker</h1>
            </div>
            <div className="text-sm text-gray-500">
              {opportunities.length} opportunities
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 overflow-x-auto">
        {opportunities.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No opportunities being tracked yet.</p>
            <p className="text-sm text-gray-400">
              Go to the <Link href="/" className="text-blue-600 hover:underline">feed</Link> and click "Track" on papers you want to follow.
            </p>
          </div>
        ) : (
          <div className="flex gap-4">
            {STAGES.map(stage => (
              <StageColumn
                key={stage.id}
                stage={stage}
                opportunities={opportunities}
                onMoveStage={handleMoveStage}
                onUpdateNotes={handleUpdateNotes}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
