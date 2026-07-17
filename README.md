# Research Scout

A local web app that helps tech entrepreneurs discover commercial opportunities in academic research. It wraps the full scouting loop:

1. **Monitor** — Pulls new papers from arXiv for your configured categories/keywords
2. **Score** — An LLM ranks each paper for commercial viability against your personal profile
3. **Deep-dive** — One click generates: product ideas, target customers, why big players would ignore it, key risks, and a draft outreach email to authors
4. **Track** — A pipeline board moves opportunities through stages: Inbox → Exploring → Contacted Author → Validating → Active / Dropped

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template and add your API key
cp .env.example .env.local
# Edit .env.local with your LLM API key

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_API_KEY` | Your OpenAI API key (or compatible provider) | Required |
| `LLM_BASE_URL` | API base URL | `https://api.openai.com/v1` |
| `LLM_MODEL` | Model to use for scoring/analysis | `gpt-4o-mini` |

### Profile Settings

Visit `/settings` to configure:

- **Industries I Know Deeply** — Your professional background and domain expertise
- **Research Interests** — Technical areas that excite you
- **arXiv Categories** — Which paper categories to monitor (e.g., `cs.AI`, `cs.LG`, `cs.CL`)
- **Keywords** — Additional filter terms

## How It Works

### Scoring

Papers are scored 0-10 based on:
- Commercial viability (clear product path, paying customers)
- Profile fit (matches your expertise, you can uniquely execute)
- Timing (technology readiness, enabling conditions)
- Competition gap (would big players ignore this?)

Higher scores indicate better opportunities for individual entrepreneurs vs. well-resourced institutions.

### Deep-Dive Analysis

For promising papers, the deep-dive generates:
- Concrete product/service ideas
- Specific target customer segments
- Why big tech/VCs would likely pass
- Key technical and market risks
- A draft email to contact the paper authors

### Opportunity Tracker

Track papers through your evaluation pipeline:
- **Inbox** — Saved for later review
- **Exploring** — Actively researching the opportunity
- **Contacted Author** — Reached out to researchers
- **Validating** — Testing market demand
- **Active** — Pursuing this opportunity
- **Dropped** — No longer interested

## Stack

- Next.js 14 (App Router) + TypeScript
- SQLite via better-sqlite3 (local persistence, zero setup)
- Tailwind CSS
- OpenAI-compatible LLM API

## Data Storage

All data is stored locally in `research-scout.db` (SQLite). The database is created automatically on first run.
