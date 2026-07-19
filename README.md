# Research Scout

A local web app that helps tech entrepreneurs discover commercial opportunities in academic research. It wraps the full scouting loop:

1. **Monitor** — Pulls new papers from multiple free sources (arXiv, OpenAlex, Hugging Face Daily Papers), fetching each arXiv category separately so niche fields aren't drowned out by high-volume ones
2. **Score** — A cheap LLM triage pass ranks every paper 0-10 for commercial viability *against your personal profile*, and writes a one-sentence plain-language summary of each paper's main discovery
3. **Deep-dive** — One click on a promising paper generates: product ideas, target customers, why big players would ignore it, key risks, and a draft outreach email to the authors
4. **Track** — A pipeline board moves opportunities through stages: Inbox → Exploring → Contacted Author → Validating → Active / Dropped

Cost transparency is built in: every LLM call is recorded with real token counts and priced, visible in the feed header and broken down in Settings.

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

Open [http://localhost:3000](http://localhost:3000), review your profile in Settings, and click "Scan Now".

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_API_KEY` | API key for an OpenAI-compatible provider | Required |
| `LLM_BASE_URL` | API base URL | `https://api.openai.com/v1` |
| `LLM_MODEL` | Model for deep-dive analysis | `gpt-4o-mini` |
| `LLM_TRIAGE_MODEL` | Cheaper model for batch feed scoring | falls back to `LLM_MODEL` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` | SMTP server for the daily digest email | Digest disabled without `SMTP_HOST` |
| `MAIL_FROM` | From address for digest emails | `SMTP_USER` |
| `AUTH_USERS` | Login whitelist: comma-separated `email:password` pairs | Empty (auth disabled) |
| `AUTH_SECRET` | Secret for signing session cookies (required with `AUTH_USERS`) | — |
| `APP_BASE_URL` | Public URL used in digest email links | `http://localhost:3000` |
| `DB_PATH` | SQLite database file location | `./research-scout.db` |

Works with any OpenAI-compatible endpoint. For Google Gemini use:

```
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_MODEL=gemini-3-flash-preview
LLM_TRIAGE_MODEL=gemini-3.1-flash-lite
```

### Profile Settings

Visit `/settings` to configure:

- **Industries I Know Deeply** — your professional background; scoring rewards papers you can uniquely execute on
- **Research Interests** — technical areas that excite you
- **arXiv Categories** — comma-separated category codes to monitor
- **Keywords** — optional extra filter terms (ANDed with each category)

Default categories target a builder profile: `cs.SE` (software engineering), `cs.HC` (human-computer interaction), `cs.IR` (information retrieval), `cs.CL` (NLP/LLMs), `q-fin.RM`/`q-fin.CP`/`q-fin.ST` (quantitative finance), `stat.AP` (applied statistics / sports analytics).

## How It Works

### Paper sources

All sources are free and need no API key:

- **arXiv** — queried per configured category (e.g. `cs.SE`, `q-fin.RM`), newest first
- **OpenAlex** — broad cross-disciplinary scholarly index, searched by your keywords (or interests) over the last 30 days; abstracts are reconstructed from OpenAlex's inverted index
- **Hugging Face Daily Papers** — the human-curated list of trending AI papers

Papers are deduplicated across sources (Hugging Face and arXiv share arXiv IDs), and each carries a source badge in the UI. The ingest endpoint accepts an optional `sources` array to limit which are fetched.

### Two-tier cost design

- **Triage (cheap)** — papers are scored in batches of 10 per LLM call using the triage model, with abstracts truncated to 1,000 characters. A full ~80-paper scan costs a fraction of a cent. Papers are never re-scored once paid for.
- **Deep-dive (on demand)** — the full model runs only on papers you explicitly open, after triage told you which ones deserve attention. Results are cached.

### Scoring criteria

Each paper is scored 0-10 on: commercial viability (clear product path, paying customer), profile fit (matches your expertise), timing (enabling conditions in place), and competition gap (would big players ignore this?). Each score comes with a plain-language discovery sentence, a rationale, and an application hint.

### Cost tracking

Every LLM call records the actual token usage reported by the API and computes cost from published per-token prices (output tokens include model reasoning tokens). The feed header shows total spend; Settings shows today's spend and a per-operation breakdown by model.

### Opportunity tracker

Track papers through your evaluation pipeline: Inbox → Exploring → Contacted Author → Validating → Active / Dropped, with inline notes on each card.

## Daily Email Digest

With SMTP configured, the app can scan, score, and email you the day's promising papers automatically. Enable it in Settings: set a recipient email, a send hour (server local time, `TZ` in Docker), and a minimum score. The scheduler runs inside the server process, so the server must stay running (`npm run start` or Docker). Each digest covers papers fetched since the last successful one, and "Send Digest Now" in Settings triggers an immediate test send.

## Authentication

Set `AUTH_USERS` to a comma-separated list of `email:password` pairs (e.g. `alice@example.com:s3cret,bob@example.com:hunter2`) and `AUTH_SECRET` to a random string (`openssl rand -hex 32`). Every page and API route then requires login; sessions last 30 days via a signed httpOnly cookie. Leave `AUTH_USERS` empty to run without authentication (local use only). All users share the same profile and feed.

## Deploying

The app needs a persistent Node server (SQLite + in-process scheduler), so deploy it with Docker on any VPS rather than a serverless platform:

```bash
cp .env.example .env
# Fill in LLM_API_KEY, SMTP_*, AUTH_USERS, AUTH_SECRET, and APP_BASE_URL

docker compose up --build -d
```

The database lives in the `scout-data` volume and survives container restarts. Put a TLS-terminating reverse proxy (Caddy, nginx, Traefik) in front and set `APP_BASE_URL` to your `https://` URL so digest links and secure cookies work correctly.

## Stack

- Next.js (App Router) + TypeScript
- SQLite via better-sqlite3 (local persistence, zero setup)
- Tailwind CSS
- Any OpenAI-compatible LLM API

## Data Storage

All data is stored locally in `research-scout.db` (SQLite), created automatically on first run and excluded from git. Delete the file to start fresh.
