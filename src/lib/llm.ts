import OpenAI from 'openai';
import { recordLlmUsage } from '@/lib/db';

function getClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.LLM_API_KEY || '',
    baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
  });
}

function getModel(): string {
  return process.env.LLM_MODEL || 'gpt-4o-mini';
}

function getTriageModel(): string {
  return process.env.LLM_TRIAGE_MODEL || getModel();
}

const MODEL_PRICING_PER_1M: Record<string, { input: number; output: number }> = {
  'gemini-3-flash-preview': { input: 0.5, output: 3.0 },
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
  'gemini-3.5-flash': { input: 0.5, output: 3.0 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10.0 },
};

function computeCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING_PER_1M[model];
  if (!pricing) return 0;
  return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
}

function trackUsage(
  kind: string,
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined
): void {
  const promptTokens = usage?.prompt_tokens || 0;
  const completionTokens = usage?.completion_tokens || 0;
  try {
    recordLlmUsage({
      kind,
      model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cost_usd: computeCostUsd(model, promptTokens, completionTokens),
    });
  } catch (error) {
    console.error('Failed to record LLM usage:', error);
  }
}

export type ScoreResult = {
  viability: number;
  discovery: string;
  rationale: string;
  application_hint: string;
};

const FALLBACK_SCORE: ScoreResult = {
  viability: 5,
  discovery: '',
  rationale: 'Unable to parse LLM response',
  application_hint: 'Review manually',
};

function truncateAbstract(abstract: string, maxChars = 1000): string {
  if (abstract.length <= maxChars) return abstract;
  return abstract.slice(0, maxChars) + '...';
}

export async function scorePapersBatch(
  papers: Array<{ title: string; abstract: string; categories: string }>,
  profile: { industries: string; interests: string }
): Promise<ScoreResult[]> {
  const client = getClient();

  const systemPrompt = `You are a technology scout evaluating academic papers for commercial startup potential.

User Profile:
- Industries they know deeply: ${profile.industries || 'Not specified'}
- Research interests: ${profile.interests || 'Not specified'}

For EACH paper, score it from 0-10 based on:
1. Commercial viability: Can this become a product? Is there a clear customer?
2. Profile fit: Does it match the user's industry expertise? Can they uniquely execute on this?
3. Timing: Is the technology mature enough? Are enabling conditions in place?
4. Competition gap: Would big players ignore this? Is it too niche or weird for them?

Higher scores (7-10): Clear product path, matches user's expertise, big players unlikely to pursue
Medium scores (4-6): Interesting but unclear path, moderate fit, or high competition
Lower scores (0-3): Pure research, no obvious application, or already crowded

Respond with a valid JSON array, one object per paper in the same order, no other text:
[
  {
    "index": <paper number>,
    "viability": <number 0-10>,
    "discovery": "<one plain-language sentence explaining what this paper achieved or discovered — no jargon, understandable by a non-expert>",
    "rationale": "<one sentence explaining the score>",
    "application_hint": "<one sentence suggesting a potential application or product>"
  }
]`;

  const paperList = papers
    .map((p, i) => `Paper ${i}:
Title: ${p.title}
Categories: ${p.categories}
Abstract: ${truncateAbstract(p.abstract)}`)
    .join('\n\n');

  const model = getTriageModel();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Papers to evaluate:\n\n${paperList}` },
    ],
    temperature: 0.3,
    max_tokens: 300 * papers.length + 1000,
    reasoning_effort: 'low',
  });

  trackUsage('triage', model, response.usage);

  const content = response.choices[0]?.message?.content || '';

  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in response');

    const parsed = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;
    const byIndex = new Map<number, Record<string, unknown>>();
    for (const item of parsed) {
      byIndex.set(Number(item.index), item);
    }

    return papers.map((_, i) => {
      const item = byIndex.get(i) || parsed[i];
      if (!item) return { ...FALLBACK_SCORE };
      return {
        viability: Math.min(10, Math.max(0, Number(item.viability) || 0)),
        discovery: String(item.discovery || ''),
        rationale: String(item.rationale || ''),
        application_hint: String(item.application_hint || ''),
      };
    });
  } catch {
    return papers.map(() => ({ ...FALLBACK_SCORE }));
  }
}

export type AnalysisResult = {
  ideas: string;
  target_customer: string;
  why_ignored: string;
  risks: string;
  outreach_draft: string;
};

export async function analyzePaper(
  paper: { title: string; abstract: string; authors: string; categories: string; url: string },
  profile: { industries: string; interests: string }
): Promise<AnalysisResult> {
  const client = getClient();

  const systemPrompt = `You are a technology scout doing a deep-dive analysis on an academic paper to find startup opportunities.

User Profile:
- Industries they know deeply: ${profile.industries || 'Not specified'}
- Research interests: ${profile.interests || 'Not specified'}

Analyze this paper for commercial potential. Be specific and actionable.

Respond with valid JSON only:
{
  "ideas": "<2-3 concrete product/service ideas that could be built from this research>",
  "target_customer": "<specific customer segments who would pay for this, with examples>",
  "why_ignored": "<why would big tech companies or VCs likely ignore this opportunity>",
  "risks": "<key technical, market, or execution risks>",
  "outreach_draft": "<a short, friendly email to the paper's authors expressing interest in commercial applications, asking about their plans, and proposing a conversation>"
}`;

  const userPrompt = `Paper to analyze:

Title: ${paper.title}
Authors: ${paper.authors}
Categories: ${paper.categories}
URL: ${paper.url}

Abstract:
${paper.abstract}`;

  const model = getModel();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.5,
    max_tokens: 4000,
    reasoning_effort: 'low',
  });

  trackUsage('deepdive', model, response.usage);

  const content = response.choices[0]?.message?.content || '';
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      ideas: String(parsed.ideas || ''),
      target_customer: String(parsed.target_customer || ''),
      why_ignored: String(parsed.why_ignored || ''),
      risks: String(parsed.risks || ''),
      outreach_draft: String(parsed.outreach_draft || ''),
    };
  } catch {
    return {
      ideas: 'Unable to parse analysis',
      target_customer: 'Review manually',
      why_ignored: 'Review manually',
      risks: 'Review manually',
      outreach_draft: 'Unable to generate outreach email',
    };
  }
}
