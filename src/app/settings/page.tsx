'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Profile = {
  id: number;
  industries: string;
  interests: string;
  arxiv_categories: string;
  keywords: string;
  digest_email: string;
  digest_enabled: number;
  digest_hour: number;
  digest_min_score: number;
  updated_at: string;
};

type DigestLog = {
  sent_at: string;
  paper_count: number;
  status: string;
  error: string;
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

function digestStatusStyle(status: string): { label: string; cls: string } {
  switch (status) {
    case 'sent': return { label: 'Sent', cls: 'bg-green-100 text-green-800' };
    case 'empty': return { label: 'No papers', cls: 'bg-gray-100 text-gray-700' };
    case 'error': return { label: 'Failed', cls: 'bg-red-100 text-red-800' };
    default: return { label: status, cls: 'bg-gray-100 text-gray-700' };
  }
}

function formatUtc(sqlUtc: string): string {
  return new Date(sqlUtc.replace(' ', 'T') + 'Z').toLocaleString();
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lastDigest, setLastDigest] = useState<DigestLog | null>(null);
  const [lastAttempt, setLastAttempt] = useState<DigestLog | null>(null);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [digestStatus, setDigestStatus] = useState('');

  const refreshDigest = async (): Promise<DigestLog | null> => {
    const res = await fetch('/api/digest');
    const data = await res.json();
    setLastDigest(data.last_sent);
    setLastAttempt(data.last_attempt);
    return data.last_attempt as DigestLog | null;
  };

  useEffect(() => {
    fetch('/api/profile')
      .then(res => res.json())
      .then(setProfile);
    fetch('/api/usage')
      .then(res => res.json())
      .then(setUsage);
    refreshDigest();
    if (typeof window !== 'undefined' && localStorage.getItem('rs_digest_sending') === '1') {
      setSendingDigest(true);
    }
  }, []);

  useEffect(() => {
    if (!sendingDigest) return;
    let ticks = 0;
    const interval = setInterval(async () => {
      ticks += 1;
      const attempt = await refreshDigest();
      const baseline = localStorage.getItem('rs_digest_baseline') ?? '';
      const finished = attempt && attempt.sent_at !== baseline;
      if (finished || ticks > 30) {
        localStorage.removeItem('rs_digest_sending');
        localStorage.removeItem('rs_digest_baseline');
        setSendingDigest(false);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [sendingDigest]);

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
        digest_email: profile.digest_email,
        digest_enabled: profile.digest_enabled,
        digest_hour: profile.digest_hour,
        digest_min_score: profile.digest_min_score,
      }),
    });
    
    const updated = await res.json();
    setProfile(updated);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSendDigest = async () => {
    localStorage.setItem('rs_digest_sending', '1');
    localStorage.setItem('rs_digest_baseline', lastAttempt?.sent_at ?? '');
    setSendingDigest(true);
    setDigestStatus('');
    try {
      const res = await fetch('/api/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      await res.json();
      await refreshDigest();
    } catch (error) {
      setDigestStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      localStorage.removeItem('rs_digest_sending');
      localStorage.removeItem('rs_digest_baseline');
      setSendingDigest(false);
    }
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

        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Daily Email Digest</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.digest_enabled === 1}
                onChange={e => setProfile({ ...profile, digest_enabled: e.target.checked ? 1 : 0 })}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Enabled</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recipient Email
            </label>
            <input
              type="email"
              value={profile.digest_email}
              onChange={e => setProfile({ ...profile, digest_email: e.target.value })}
              placeholder="you@example.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
            <p className="mt-1 text-sm text-gray-500">
              Where the daily digest is sent. SMTP credentials are configured server-side via environment variables.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Send Hour
              </label>
              <select
                value={profile.digest_hour}
                onChange={e => setProfile({ ...profile, digest_hour: Number(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">Server local time.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Score
              </label>
              <select
                value={profile.digest_min_score}
                onChange={e => setProfile({ ...profile, digest_min_score: Number(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              >
                {Array.from({ length: 11 }, (_, s) => (
                  <option key={s} value={s}>{s}+</option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">Only include papers scored at or above this.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">Manual send</h3>
              <button
                onClick={handleSendDigest}
                disabled={sendingDigest}
                className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors"
                title="Save your changes first — the digest uses the saved settings"
              >
                {sendingDigest ? 'Sending…' : 'Send Digest Now'}
              </button>
            </div>

            {sendingDigest && (
              <div className="flex items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <span className="text-sm text-blue-800">
                  Scanning, scoring and emailing your digest… this can take up to a minute. You can safely leave this page.
                </span>
              </div>
            )}

            {!sendingDigest && lastAttempt && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${digestStatusStyle(lastAttempt.status).cls}`}>
                    {digestStatusStyle(lastAttempt.status).label}
                  </span>
                  <span className="text-sm text-gray-700">
                    {lastAttempt.status === 'sent' && `${lastAttempt.paper_count} paper${lastAttempt.paper_count === 1 ? '' : 's'} emailed`}
                    {lastAttempt.status === 'empty' && 'No new papers above your score threshold'}
                    {lastAttempt.status === 'error' && 'Send failed'}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">{formatUtc(lastAttempt.sent_at)}</span>
                </div>
                {lastAttempt.status === 'error' && lastAttempt.error && (
                  <p className="mt-2 text-sm text-red-700 break-words">{lastAttempt.error}</p>
                )}
                {lastDigest && lastAttempt.status !== 'sent' && (
                  <p className="mt-2 text-xs text-gray-500">
                    Last successful send: {formatUtc(lastDigest.sent_at)} ({lastDigest.paper_count} papers)
                  </p>
                )}
              </div>
            )}

            {!sendingDigest && !lastAttempt && (
              <p className="text-sm text-gray-500">No digest sent yet.</p>
            )}

            {digestStatus && !sendingDigest && (
              <p className="text-sm text-red-700">{digestStatus}</p>
            )}
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
