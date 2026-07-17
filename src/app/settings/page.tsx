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

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/profile')
      .then(res => res.json())
      .then(setProfile);
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
      </main>
    </div>
  );
}
