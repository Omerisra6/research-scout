'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Profile = {
  id: number;
  industries: string;
  interests: string;
  arxiv_categories: string;
  keywords: string;
  updated_at: string;
};

type UsageSummary = {
  total_cost_usd: number;
  total_calls: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  by_kind: Array<{
    kind: string;
    model: string;
    calls: number;
    prompt_tokens: number;
    completion_tokens: number;
    cost_usd: number;
  }>;
  today_cost_usd: number;
};

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

const KIND_LABELS: Record<string, string> = {
  triage: 'Feed scoring (triage)',
  deepdive: 'Deep-dive analysis',
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/profile')
      .then(res => res.json())
      .then(setProfile);
    fetch('/api/usage')
      .then(res => res.json())
      .then(setUsage);
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        industries: profile.industries,
        interests: profile.interests,
        arxiv_categories: profile.arxiv_categories,
        keywords: profile.keywords,
      }),
    });
    
    const updated = await res.json();
    setProfile(updated);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-500 hover:text-gray-700">
              ← Back
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Industries I Know Deeply
            </label>
            <textarea
              value={profile.industries}
              onChange={e => setProfile({ ...profile, industries: e.target.value })}
              placeholder="E.g., Fintech, healthcare logistics, industrial automation, e-commerce fulfillment..."
              className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
            />
            <p className="mt-1 text-sm text-gray-500">
              Describe your professional background and industry expertise. This helps score papers for relevance to problems you understand.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Research Interests
            </label>
            <textarea
              value={profile.interests}
              onChange={e => setProfile({ ...profile, interests: e.target.value })}
              placeholder="E.g., Applied ML for time-series forecasting, robotics, natural language interfaces..."
              className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
            />
            <p className="mt-1 text-sm text-gray-500">
              What technical areas excite you? This guides the scoring toward papers matching your interests.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              arXiv Categories
            </label>
            <input
              type="text"
              value={profile.arxiv_categories}
              onChange={e => setProfile({ ...profile, arxiv_categories: e.target.value })}
              placeholder="cs.AI,cs.LG,cs.CL"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
            <p className="mt-1 text-sm text-gray-500">
              Comma-separated arXiv category codes. Common: cs.AI (AI), cs.LG (Machine Learning), cs.CL (NLP), cs.CV (Computer Vision), cs.RO (Robotics), stat.ML (Statistics ML).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Keywords
            </label>
            <input
              type="text"
              value={profile.keywords}
              onChange={e => setProfile({ ...profile, keywords: e.target.value })}
              placeholder="transformer, reinforcement learning, diffusion model"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
            <p className="mt-1 text-sm text-gray-500">
              Comma-separated keywords to filter papers. Leave empty to fetch all papers from selected categories.
            </p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-medium text-blue-900 mb-2">How scoring works</h3>
          <p className="text-sm text-blue-800">
            When you scan for papers, each one is scored (0-10) based on commercial viability <em>relative to your profile</em>. 
            Papers are ranked higher if they solve problems in industries you know, use techniques you understand, 
            and target markets where big players are less likely to compete.
          </p>
        </div>

        {usage && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">LLM Cost Tracking</h2>
              <div className="text-right">
                <p className="text-2xl font-semibold text-gray-900">{formatCost(usage.total_cost_usd)}</p>
                <p className="text-xs text-gray-500">total · {formatCost(usage.today_cost_usd)} today</p>
              </div>
            </div>

            {usage.by_kind.length === 0 ? (
              <p className="text-sm text-gray-500">No LLM calls recorded yet. Costs will appear here after your first scan.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="py-2 pr-4 font-medium">Operation</th>
                      <th className="py-2 pr-4 font-medium">Model</th>
                      <th className="py-2 pr-4 font-medium text-right">Calls</th>
                      <th className="py-2 pr-4 font-medium text-right">Input tokens</th>
                      <th className="py-2 pr-4 font-medium text-right">Output tokens</th>
                      <th className="py-2 font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.by_kind.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100 text-gray-700">
                        <td className="py-2 pr-4">{KIND_LABELS[row.kind] || row.kind}</td>
                        <td className="py-2 pr-4 text-gray-500">{row.model}</td>
                        <td className="py-2 pr-4 text-right">{row.calls}</td>
                        <td className="py-2 pr-4 text-right">{row.prompt_tokens.toLocaleString()}</td>
                        <td className="py-2 pr-4 text-right">{row.completion_tokens.toLocaleString()}</td>
                        <td className="py-2 text-right font-medium">{formatCost(row.cost_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-gray-400">
                  Costs are computed from actual token usage reported by the API, using published per-token prices. Output tokens include model reasoning tokens.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
