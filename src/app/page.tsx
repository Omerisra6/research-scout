'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type Score = {
  id: number;
  paper_id: number;
  viability: number;
  discovery: string;
  rationale: string;
  application_hint: string;
  scored_at: string;
};

type Opportunity = {
  id: number;
  paper_id: number;
  stage: string;
  notes: string;
  updated_at: string;
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
  score?: Score;
  opportunity?: Opportunity;
};

function ScoreBadge({ score }: { score: number }) {
  const colors = score >= 7 
    ? 'bg-green-100 text-green-800 border-green-300'
    : score >= 4 
    ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
    : 'bg-gray-100 text-gray-600 border-gray-300';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium border ${colors}`}>
      {score}/10
    </span>
  );
}

function PaperCard({ 
  paper, 
  onDismiss, 
  onTrack 
}: { 
  paper: Paper; 
  onDismiss: (id: number) => void;
  onTrack: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {paper.score && <ScoreBadge score={paper.score.viability} />}
            {paper.opportunity && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                {paper.opportunity.stage}
              </span>
            )}
            <span className="text-xs text-gray-500">{paper.categories.split(',')[0]}</span>
          </div>
          <Link href={`/paper/${paper.id}`} className="block">
            <h3 className="font-medium text-gray-900 hover:text-blue-600 line-clamp-2">
              {paper.title}
            </h3>
          </Link>
          <p className="text-sm text-gray-500 mt-1">{paper.authors.split(',').slice(0, 3).join(', ')}{paper.authors.split(',').length > 3 ? ' et al.' : ''}</p>
          
          {paper.score?.discovery && (
            <p className="text-sm text-gray-800 mt-2">{paper.score.discovery}</p>
          )}
          {paper.score && (
            <p className="text-sm text-gray-600 mt-1 italic">{paper.score.application_hint}</p>
          )}

          {expanded && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-gray-700">{paper.abstract}</p>
              {paper.score && (
                <p className="text-sm text-gray-500">
                  <strong>Rationale:</strong> {paper.score.rationale}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
          <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            arXiv →
          </a>
        </div>
        <div className="flex items-center gap-2">
          {!paper.opportunity && (
            <button
              onClick={() => onTrack(paper.id)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Track
            </button>
          )}
          <button
            onClick={() => onDismiss(paper.id)}
            className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FeedPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [minScore, setMinScore] = useState<number | ''>('');
  const [status, setStatus] = useState('');

  const fetchPapers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (minScore !== '') params.set('minScore', String(minScore));
    
    const res = await fetch(`/api/papers?${params}`);
    const data = await res.json();
    setPapers(data);
    setLoading(false);
  }, [minScore]);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  const handleScan = async () => {
    setScanning(true);
    setStatus('Fetching papers from arXiv...');
    
    try {
      const ingestRes = await fetch('/api/ingest', { method: 'POST' });
      const ingestData = await ingestRes.json();
      
      if (ingestData.error) {
        setStatus(`Error: ${ingestData.error}`);
        setScanning(false);
        return;
      }

      setStatus(`Fetched ${ingestData.fetched} papers. Scoring...`);
      setScoring(true);

      const scoreRes = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 100 }),
      });
      const scoreData = await scoreRes.json();

      setStatus(`Done! Scored ${scoreData.scored} papers.`);
      await fetchPapers();
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setScanning(false);
      setScoring(false);
      setTimeout(() => setStatus(''), 5000);
    }
  };

  const handleDismiss = async (paperId: number) => {
    await fetch('/api/papers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss', paperId }),
    });
    setPapers(papers.filter(p => p.id !== paperId));
  };

  const handleTrack = async (paperId: number) => {
    await fetch('/api/papers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'track', paperId }),
    });
    await fetchPapers();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Research Scout</h1>
            <div className="flex items-center gap-3">
              <Link href="/tracker" className="text-gray-600 hover:text-gray-900">
                Tracker
              </Link>
              <Link href="/settings" className="text-gray-600 hover:text-gray-900">
                Settings
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleScan}
              disabled={scanning}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {scanning ? (scoring ? 'Scoring...' : 'Scanning...') : 'Scan Now'}
            </button>
            
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Min score:</label>
              <select
                value={minScore}
                onChange={e => setMinScore(e.target.value === '' ? '' : Number(e.target.value))}
                className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
              >
                <option value="">All</option>
                <option value="7">7+</option>
                <option value="5">5+</option>
                <option value="3">3+</option>
              </select>
            </div>
          </div>

          {status && (
            <p className="text-sm text-gray-600">{status}</p>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading papers...</div>
        ) : papers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No papers yet. Click "Scan Now" to fetch papers from arXiv.</p>
            <p className="text-sm text-gray-400">
              Make sure to configure your <Link href="/settings" className="text-blue-600 hover:underline">settings</Link> first.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {papers.map(paper => (
              <PaperCard
                key={paper.id}
                paper={paper}
                onDismiss={handleDismiss}
                onTrack={handleTrack}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
