'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type Score = {
  id: number;
  paper_id: number;
  viability: number;
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

type Analysis = {
  id: number;
  paper_id: number;
  ideas: string;
  target_customer: string;
  why_ignored: string;
  risks: string;
  outreach_draft: string;
  analyzed_at: string;
};

function ScoreBadge({ score }: { score: number }) {
  const colors = score >= 7 
    ? 'bg-green-100 text-green-800 border-green-300'
    : score >= 4 
    ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
    : 'bg-gray-100 text-gray-600 border-gray-300';

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${colors}`}>
      {score}/10
    </span>
  );
}

function AnalysisSection({ title, content }: { title: string; content: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-700 whitespace-pre-wrap">{content}</p>
    </div>
  );
}

function OutreachEmail({ content, authors }: { content: string; authors: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-gray-900">Author Outreach Draft</h3>
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-2">To: {authors.split(',')[0]?.trim()}</p>
      <pre className="text-gray-700 whitespace-pre-wrap text-sm font-sans bg-gray-50 p-3 rounded">
        {content}
      </pre>
    </div>
  );
}

export default function PaperDetailPage() {
  const params = useParams();
  const paperId = params.id as string;
  
  const [paper, setPaper] = useState<Paper | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchPaper = useCallback(async () => {
    const res = await fetch(`/api/papers?limit=1000`);
    const papers = await res.json();
    const found = papers.find((p: Paper) => p.id === parseInt(paperId));
    setPaper(found || null);
    setLoading(false);
  }, [paperId]);

  const fetchAnalysis = useCallback(async () => {
    try {
      const res = await fetch(`/api/analyze?paperId=${paperId}`);
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      }
    } catch {
      // Analysis doesn't exist yet
    }
  }, [paperId]);

  useEffect(() => {
    fetchPaper();
    fetchAnalysis();
  }, [fetchPaper, fetchAnalysis]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId: parseInt(paperId) }),
      });
      const data = await res.json();
      setAnalysis(data);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleTrack = async () => {
    await fetch('/api/papers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'track', paperId: parseInt(paperId) }),
    });
    await fetchPaper();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Paper not found</p>
          <Link href="/" className="text-blue-600 hover:underline">← Back to feed</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-gray-500 hover:text-gray-700">
            ← Back
          </Link>
          <h1 className="text-lg font-semibold text-gray-900 truncate">Paper Details</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              {paper.score && <ScoreBadge score={paper.score.viability} />}
              {paper.opportunity && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                  Tracking: {paper.opportunity.stage}
                </span>
              )}
              <span className="text-sm text-gray-500">{paper.categories}</span>
            </div>
            <div className="flex items-center gap-2">
              {!paper.opportunity && (
                <button
                  onClick={handleTrack}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Track
                </button>
              )}
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded hover:bg-blue-50"
              >
                View on arXiv →
              </a>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-2">{paper.title}</h2>
          <p className="text-gray-600 mb-4">{paper.authors}</p>
          
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-700">{paper.abstract}</p>
          </div>

          {paper.score && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600">
                <strong>Score rationale:</strong> {paper.score.rationale}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Application hint:</strong> {paper.score.application_hint}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Deep-Dive Analysis</h2>
          {!analysis && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {analyzing ? 'Analyzing...' : 'Run Deep-Dive'}
            </button>
          )}
        </div>

        {analysis ? (
          <div className="space-y-4">
            <AnalysisSection title="Product Ideas" content={analysis.ideas} />
            <AnalysisSection title="Target Customer" content={analysis.target_customer} />
            <AnalysisSection title="Why Big Players Would Ignore This" content={analysis.why_ignored} />
            <AnalysisSection title="Key Risks" content={analysis.risks} />
            <OutreachEmail content={analysis.outreach_draft} authors={paper.authors} />
          </div>
        ) : (
          <div className="bg-gray-100 rounded-lg p-8 text-center">
            <p className="text-gray-500">
              {analyzing 
                ? 'Running analysis... This may take a moment.' 
                : 'Click "Run Deep-Dive" to generate a detailed commercial analysis.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
