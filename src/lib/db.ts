import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'research-scout.db');

let db: Database.Database | null = null;

export type Profile = {
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

export type DigestLog = {
  id: number;
  sent_at: string;
  paper_count: number;
  status: string;
  error: string;
};

export type Paper = {
  id: number;
  arxiv_id: string;
  source: string;
  title: string;
  abstract: string;
  authors: string;
  categories: string;
  published_at: string;
  url: string;
  fetched_at: string;
  dismissed: number;
};

export type Score = {
  id: number;
  paper_id: number;
  viability: number;
  discovery: string;
  rationale: string;
  application_hint: string;
  scored_at: string;
};

export type Analysis = {
  id: number;
  paper_id: number;
  ideas: string;
  target_customer: string;
  why_ignored: string;
  risks: string;
  outreach_draft: string;
  analyzed_at: string;
};

export type OpportunityStage = 'inbox' | 'exploring' | 'contacted' | 'validating' | 'active' | 'dropped';

export type Opportunity = {
  id: number;
  paper_id: number;
  stage: OpportunityStage;
  notes: string;
  updated_at: string;
};

export type PaperWithScore = Paper & {
  score?: Score;
  opportunity?: Opportunity;
};

export type LlmUsage = {
  id: number;
  kind: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  created_at: string;
};

export type UsageSummary = {
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

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

const DEFAULT_INDUSTRIES = 'Fast-adapting software/ML/data builder; buyer connection in banking; startup CEO network across sectors; strong PM network (building a PM tool); devtools domain knowledge; sports/NBA analytics interest';
const DEFAULT_INTERESTS = 'Applied ML/LLM products, developer tools, PM/productivity tooling, data products, quantitative finance applications, sports analytics';
const DEFAULT_CATEGORIES = 'cs.SE,cs.HC,cs.IR,cs.CL,q-fin.RM,q-fin.CP,q-fin.ST,stat.AP';

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      industries TEXT NOT NULL DEFAULT '',
      interests TEXT NOT NULL DEFAULT '',
      arxiv_categories TEXT NOT NULL DEFAULT '${DEFAULT_CATEGORIES}',
      keywords TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO profile (id) VALUES (1);
    
    UPDATE profile SET 
      industries = '${DEFAULT_INDUSTRIES}',
      interests = '${DEFAULT_INTERESTS}',
      arxiv_categories = '${DEFAULT_CATEGORIES}',
      updated_at = datetime('now')
    WHERE id = 1 AND industries = '' AND interests = '';

    CREATE TABLE IF NOT EXISTS papers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      arxiv_id TEXT UNIQUE NOT NULL,
      source TEXT NOT NULL DEFAULT 'arxiv',
      title TEXT NOT NULL,
      abstract TEXT NOT NULL,
      authors TEXT NOT NULL,
      categories TEXT NOT NULL,
      published_at TEXT NOT NULL,
      url TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      dismissed INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_papers_arxiv_id ON papers(arxiv_id);
    CREATE INDEX IF NOT EXISTS idx_papers_published_at ON papers(published_at);

    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id INTEGER UNIQUE NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
      viability INTEGER NOT NULL CHECK (viability >= 0 AND viability <= 10),
      discovery TEXT NOT NULL DEFAULT '',
      rationale TEXT NOT NULL,
      application_hint TEXT NOT NULL,
      scored_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id INTEGER UNIQUE NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
      ideas TEXT NOT NULL,
      target_customer TEXT NOT NULL,
      why_ignored TEXT NOT NULL,
      risks TEXT NOT NULL,
      outreach_draft TEXT NOT NULL,
      analyzed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id INTEGER UNIQUE NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
      stage TEXT NOT NULL CHECK (stage IN ('inbox', 'exploring', 'contacted', 'validating', 'active', 'dropped')),
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const scoreColumns = database.prepare("SELECT name FROM pragma_table_info('scores')").all() as Array<{ name: string }>;
  if (!scoreColumns.some(c => c.name === 'discovery')) {
    database.exec("ALTER TABLE scores ADD COLUMN discovery TEXT NOT NULL DEFAULT ''");
  }

  const paperColumns = database.prepare("SELECT name FROM pragma_table_info('papers')").all() as Array<{ name: string }>;
  if (!paperColumns.some(c => c.name === 'source')) {
    database.exec("ALTER TABLE papers ADD COLUMN source TEXT NOT NULL DEFAULT 'arxiv'");
  }

  const profileColumns = database.prepare("SELECT name FROM pragma_table_info('profile')").all() as Array<{ name: string }>;
  if (!profileColumns.some(c => c.name === 'digest_email')) {
    database.exec("ALTER TABLE profile ADD COLUMN digest_email TEXT NOT NULL DEFAULT ''");
  }
  if (!profileColumns.some(c => c.name === 'digest_enabled')) {
    database.exec('ALTER TABLE profile ADD COLUMN digest_enabled INTEGER NOT NULL DEFAULT 0');
  }
  if (!profileColumns.some(c => c.name === 'digest_hour')) {
    database.exec('ALTER TABLE profile ADD COLUMN digest_hour INTEGER NOT NULL DEFAULT 8');
  }
  if (!profileColumns.some(c => c.name === 'digest_min_score')) {
    database.exec('ALTER TABLE profile ADD COLUMN digest_min_score INTEGER NOT NULL DEFAULT 6');
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS digest_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      paper_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'sent',
      error TEXT NOT NULL DEFAULT ''
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS llm_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_tokens INTEGER NOT NULL,
      completion_tokens INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function getProfile(): Profile {
  const db = getDb();
  return db.prepare('SELECT * FROM profile WHERE id = 1').get() as Profile;
}

export function updateProfile(data: Partial<Omit<Profile, 'id' | 'updated_at'>>): Profile {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.industries !== undefined) {
    fields.push('industries = ?');
    values.push(data.industries);
  }
  if (data.interests !== undefined) {
    fields.push('interests = ?');
    values.push(data.interests);
  }
  if (data.arxiv_categories !== undefined) {
    fields.push('arxiv_categories = ?');
    values.push(data.arxiv_categories);
  }
  if (data.keywords !== undefined) {
    fields.push('keywords = ?');
    values.push(data.keywords);
  }
  if (data.digest_email !== undefined) {
    fields.push('digest_email = ?');
    values.push(data.digest_email);
  }
  if (data.digest_enabled !== undefined) {
    fields.push('digest_enabled = ?');
    values.push(data.digest_enabled ? 1 : 0);
  }
  if (data.digest_hour !== undefined) {
    fields.push('digest_hour = ?');
    values.push(data.digest_hour);
  }
  if (data.digest_min_score !== undefined) {
    fields.push('digest_min_score = ?');
    values.push(data.digest_min_score);
  }

  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    db.prepare(`UPDATE profile SET ${fields.join(', ')} WHERE id = 1`).run(...values);
  }

  return getProfile();
}

export function upsertPaper(paper: Omit<Paper, 'id' | 'fetched_at' | 'dismissed'>): Paper {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO papers (arxiv_id, source, title, abstract, authors, categories, published_at, url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(arxiv_id) DO UPDATE SET
      title = excluded.title,
      abstract = excluded.abstract,
      authors = excluded.authors,
      categories = excluded.categories,
      published_at = excluded.published_at,
      url = excluded.url
    RETURNING *
  `);
  return stmt.get(
    paper.arxiv_id,
    paper.source,
    paper.title,
    paper.abstract,
    paper.authors,
    paper.categories,
    paper.published_at,
    paper.url
  ) as Paper;
}

export function getPaperById(id: number): Paper | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM papers WHERE id = ?').get(id) as Paper | undefined;
}

export function getPaperByArxivId(arxivId: string): Paper | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM papers WHERE arxiv_id = ?').get(arxivId) as Paper | undefined;
}

export function getPapersWithScores(options?: {
  minScore?: number;
  category?: string;
  includeDismissed?: boolean;
  limit?: number;
}): PaperWithScore[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (!options?.includeDismissed) {
    conditions.push('p.dismissed = 0');
  }
  if (options?.minScore !== undefined) {
    conditions.push('s.viability >= ?');
    params.push(options.minScore);
  }
  if (options?.category) {
    conditions.push('p.categories LIKE ?');
    params.push(`%${options.category}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = options?.limit ? `LIMIT ${options.limit}` : '';

  const rows = db.prepare(`
    SELECT 
      p.*,
      s.id as score_id, s.viability, s.discovery, s.rationale, s.application_hint, s.scored_at,
      o.id as opp_id, o.stage, o.notes, o.updated_at as opp_updated_at
    FROM papers p
    LEFT JOIN scores s ON p.id = s.paper_id
    LEFT JOIN opportunities o ON p.id = o.paper_id
    ${whereClause}
    ORDER BY s.viability DESC NULLS LAST, p.published_at DESC
    ${limitClause}
  `).all(...params) as Array<Record<string, unknown>>;

  return rows.map(row => ({
    id: row.id as number,
    arxiv_id: row.arxiv_id as string,
    source: row.source as string,
    title: row.title as string,
    abstract: row.abstract as string,
    authors: row.authors as string,
    categories: row.categories as string,
    published_at: row.published_at as string,
    url: row.url as string,
    fetched_at: row.fetched_at as string,
    dismissed: row.dismissed as number,
    score: row.score_id ? {
      id: row.score_id as number,
      paper_id: row.id as number,
      viability: row.viability as number,
      discovery: row.discovery as string,
      rationale: row.rationale as string,
      application_hint: row.application_hint as string,
      scored_at: row.scored_at as string,
    } : undefined,
    opportunity: row.opp_id ? {
      id: row.opp_id as number,
      paper_id: row.id as number,
      stage: row.stage as OpportunityStage,
      notes: row.notes as string,
      updated_at: row.opp_updated_at as string,
    } : undefined,
  }));
}

export function getUnscoredPapers(limit = 10): Paper[] {
  const db = getDb();
  return db.prepare(`
    SELECT p.* FROM papers p
    LEFT JOIN scores s ON p.id = s.paper_id
    WHERE s.id IS NULL AND p.dismissed = 0
    ORDER BY p.published_at DESC
    LIMIT ?
  `).all(limit) as Paper[];
}

export function dismissPaper(id: number): void {
  const db = getDb();
  db.prepare('UPDATE papers SET dismissed = 1 WHERE id = ?').run(id);
}

export function undismissPaper(id: number): void {
  const db = getDb();
  db.prepare('UPDATE papers SET dismissed = 0 WHERE id = ?').run(id);
}

export function upsertScore(paperId: number, data: Omit<Score, 'id' | 'paper_id' | 'scored_at'>): Score {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO scores (paper_id, viability, discovery, rationale, application_hint)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(paper_id) DO UPDATE SET
      viability = excluded.viability,
      discovery = excluded.discovery,
      rationale = excluded.rationale,
      application_hint = excluded.application_hint,
      scored_at = datetime('now')
    RETURNING *
  `);
  return stmt.get(paperId, data.viability, data.discovery, data.rationale, data.application_hint) as Score;
}

export function getScoreByPaperId(paperId: number): Score | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM scores WHERE paper_id = ?').get(paperId) as Score | undefined;
}

export function upsertAnalysis(paperId: number, data: Omit<Analysis, 'id' | 'paper_id' | 'analyzed_at'>): Analysis {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO analyses (paper_id, ideas, target_customer, why_ignored, risks, outreach_draft)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(paper_id) DO UPDATE SET
      ideas = excluded.ideas,
      target_customer = excluded.target_customer,
      why_ignored = excluded.why_ignored,
      risks = excluded.risks,
      outreach_draft = excluded.outreach_draft,
      analyzed_at = datetime('now')
    RETURNING *
  `);
  return stmt.get(
    paperId,
    data.ideas,
    data.target_customer,
    data.why_ignored,
    data.risks,
    data.outreach_draft
  ) as Analysis;
}

export function getAnalysisByPaperId(paperId: number): Analysis | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM analyses WHERE paper_id = ?').get(paperId) as Analysis | undefined;
}

export function createOpportunity(paperId: number, stage: OpportunityStage = 'inbox'): Opportunity {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO opportunities (paper_id, stage)
    VALUES (?, ?)
    ON CONFLICT(paper_id) DO UPDATE SET
      stage = excluded.stage,
      updated_at = datetime('now')
    RETURNING *
  `);
  return stmt.get(paperId, stage) as Opportunity;
}

export function updateOpportunity(paperId: number, data: Partial<Pick<Opportunity, 'stage' | 'notes'>>): Opportunity | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.stage !== undefined) {
    fields.push('stage = ?');
    values.push(data.stage);
  }
  if (data.notes !== undefined) {
    fields.push('notes = ?');
    values.push(data.notes);
  }

  if (fields.length === 0) {
    return getOpportunityByPaperId(paperId);
  }

  fields.push("updated_at = datetime('now')");
  values.push(paperId);

  db.prepare(`UPDATE opportunities SET ${fields.join(', ')} WHERE paper_id = ?`).run(...values);
  return getOpportunityByPaperId(paperId);
}

export function getOpportunityByPaperId(paperId: number): Opportunity | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM opportunities WHERE paper_id = ?').get(paperId) as Opportunity | undefined;
}

export function getOpportunitiesByStage(stage?: OpportunityStage): Array<Opportunity & { paper: Paper; score?: Score }> {
  const db = getDb();
  const whereClause = stage ? 'WHERE o.stage = ?' : '';
  const params = stage ? [stage] : [];

  const rows = db.prepare(`
    SELECT 
      o.*,
      p.id as paper_id, p.arxiv_id, p.source, p.title, p.abstract, p.authors, p.categories, 
      p.published_at, p.url, p.fetched_at, p.dismissed,
      s.id as score_id, s.viability, s.discovery, s.rationale, s.application_hint, s.scored_at
    FROM opportunities o
    JOIN papers p ON o.paper_id = p.id
    LEFT JOIN scores s ON p.id = s.paper_id
    ${whereClause}
    ORDER BY o.updated_at DESC
  `).all(...params) as Array<Record<string, unknown>>;

  return rows.map(row => ({
    id: row.id as number,
    paper_id: row.paper_id as number,
    stage: row.stage as OpportunityStage,
    notes: row.notes as string,
    updated_at: row.updated_at as string,
    paper: {
      id: row.paper_id as number,
      arxiv_id: row.arxiv_id as string,
      source: row.source as string,
      title: row.title as string,
      abstract: row.abstract as string,
      authors: row.authors as string,
      categories: row.categories as string,
      published_at: row.published_at as string,
      url: row.url as string,
      fetched_at: row.fetched_at as string,
      dismissed: row.dismissed as number,
    },
    score: row.score_id ? {
      id: row.score_id as number,
      paper_id: row.paper_id as number,
      viability: row.viability as number,
      discovery: row.discovery as string,
      rationale: row.rationale as string,
      application_hint: row.application_hint as string,
      scored_at: row.scored_at as string,
    } : undefined,
  }));
}

export function deleteOpportunity(paperId: number): void {
  const db = getDb();
  db.prepare('DELETE FROM opportunities WHERE paper_id = ?').run(paperId);
}

export function getLastDigest(): DigestLog | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM digest_log WHERE status = 'sent' ORDER BY sent_at DESC LIMIT 1").get() as DigestLog | undefined;
}

export function getLastDigestAttempt(): DigestLog | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM digest_log ORDER BY sent_at DESC LIMIT 1').get() as DigestLog | undefined;
}

export function getLastDigestRunAt(): string | undefined {
  const db = getDb();
  const row = db.prepare('SELECT sent_at FROM digest_log ORDER BY sent_at DESC LIMIT 1').get() as { sent_at: string } | undefined;
  return row?.sent_at;
}

export function recordDigest(data: Pick<DigestLog, 'paper_count' | 'status' | 'error'>): void {
  const db = getDb();
  db.prepare('INSERT INTO digest_log (paper_count, status, error) VALUES (?, ?, ?)')
    .run(data.paper_count, data.status, data.error);
}

export function getDigestPapers(sinceIso: string | null, minScore: number): PaperWithScore[] {
  const db = getDb();
  const conditions = ['p.dismissed = 0', 's.viability >= ?'];
  const params: unknown[] = [minScore];

  if (sinceIso) {
    conditions.push('p.fetched_at > ?');
    params.push(sinceIso);
  } else {
    conditions.push("p.fetched_at > datetime('now', '-1 day')");
  }

  const rows = db.prepare(`
    SELECT
      p.*,
      s.id as score_id, s.viability, s.discovery, s.rationale, s.application_hint, s.scored_at
    FROM papers p
    JOIN scores s ON p.id = s.paper_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY s.viability DESC, p.published_at DESC
  `).all(...params) as Array<Record<string, unknown>>;

  return rows.map(row => ({
    id: row.id as number,
    arxiv_id: row.arxiv_id as string,
    source: row.source as string,
    title: row.title as string,
    abstract: row.abstract as string,
    authors: row.authors as string,
    categories: row.categories as string,
    published_at: row.published_at as string,
    url: row.url as string,
    fetched_at: row.fetched_at as string,
    dismissed: row.dismissed as number,
    score: {
      id: row.score_id as number,
      paper_id: row.id as number,
      viability: row.viability as number,
      discovery: row.discovery as string,
      rationale: row.rationale as string,
      application_hint: row.application_hint as string,
      scored_at: row.scored_at as string,
    },
  }));
}

export function recordLlmUsage(data: Omit<LlmUsage, 'id' | 'created_at'>): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO llm_usage (kind, model, prompt_tokens, completion_tokens, cost_usd)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.kind, data.model, data.prompt_tokens, data.completion_tokens, data.cost_usd);
}

export function getUsageSummary(): UsageSummary {
  const db = getDb();

  const totals = db.prepare(`
    SELECT 
      COALESCE(SUM(cost_usd), 0) as total_cost_usd,
      COUNT(*) as total_calls,
      COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
      COALESCE(SUM(completion_tokens), 0) as total_completion_tokens
    FROM llm_usage
  `).get() as { total_cost_usd: number; total_calls: number; total_prompt_tokens: number; total_completion_tokens: number };

  const byKind = db.prepare(`
    SELECT 
      kind,
      model,
      COUNT(*) as calls,
      SUM(prompt_tokens) as prompt_tokens,
      SUM(completion_tokens) as completion_tokens,
      SUM(cost_usd) as cost_usd
    FROM llm_usage
    GROUP BY kind, model
    ORDER BY cost_usd DESC
  `).all() as UsageSummary['by_kind'];

  const today = db.prepare(`
    SELECT COALESCE(SUM(cost_usd), 0) as today_cost_usd
    FROM llm_usage
    WHERE date(created_at) = date('now')
  `).get() as { today_cost_usd: number };

  return {
    ...totals,
    by_kind: byKind,
    today_cost_usd: today.today_cost_usd,
  };
}
