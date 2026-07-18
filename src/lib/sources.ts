import { fetchArxivPapers, type ArxivPaper } from '@/lib/arxiv';

export type SourcePaper = ArxivPaper;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function reconstructAbstract(invertedIndex: Record<string, number[]> | null): string {
  if (!invertedIndex) return '';
  const positions: Array<{ pos: number; word: string }> = [];
  for (const [word, posList] of Object.entries(invertedIndex)) {
    for (const pos of posList) {
      positions.push({ pos, word });
    }
  }
  positions.sort((a, b) => a.pos - b.pos);
  return positions.map(p => p.word).join(' ');
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function fetchOpenAlexPapers(
  keywords: string[],
  perQueryLimit = 15
): Promise<SourcePaper[]> {
  const terms = keywords.length > 0 ? keywords : ['technology'];
  const allPapers: SourcePaper[] = [];
  const seenIds = new Set<string>();
  const fromDate = daysAgo(30);

  for (let i = 0; i < terms.length; i++) {
    if (i > 0) await sleep(300);

    const search = encodeURIComponent(terms[i].trim());
    const url = `https://api.openalex.org/works?search=${search}&filter=from_publication_date:${fromDate},type:article&sort=publication_date:desc&per-page=${perQueryLimit}&mailto=research-scout@example.com`;

    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'ResearchScout/1.0' } });
      if (!response.ok) continue;

      const data = await response.json();
      for (const work of data.results || []) {
        const externalId = `openalex:${String(work.id).replace('https://openalex.org/', '')}`;
        if (seenIds.has(externalId)) continue;

        const abstract = reconstructAbstract(work.abstract_inverted_index);
        if (!abstract) continue;

        const authors = (work.authorships || [])
          .map((a: { author?: { display_name?: string } }) => a.author?.display_name)
          .filter(Boolean)
          .slice(0, 10)
          .join(', ');

        const concepts = (work.concepts || [])
          .map((c: { display_name?: string }) => c.display_name)
          .filter(Boolean)
          .slice(0, 4)
          .join(', ');

        const landingUrl =
          work.primary_location?.landing_page_url ||
          work.doi ||
          `https://openalex.org/${String(work.id).replace('https://openalex.org/', '')}`;

        seenIds.add(externalId);
        allPapers.push({
          arxiv_id: externalId,
          source: 'openalex',
          title: String(work.title || work.display_name || 'Untitled'),
          abstract,
          authors,
          categories: concepts,
          published_at: String(work.publication_date || ''),
          url: landingUrl,
        });
      }
    } catch (error) {
      console.error(`OpenAlex fetch failed for "${terms[i]}":`, error);
    }
  }

  return allPapers;
}

export async function fetchHuggingFacePapers(limit = 30): Promise<SourcePaper[]> {
  const url = `https://huggingface.co/api/daily_papers?limit=${limit}`;

  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'ResearchScout/1.0' } });
    if (!response.ok) return [];

    const data = await response.json();
    const papers: SourcePaper[] = [];

    for (const item of data) {
      const paper = item.paper || {};
      const id = paper.id;
      if (!id) continue;

      const authors = (paper.authors || [])
        .map((a: { name?: string }) => a.name)
        .filter(Boolean)
        .slice(0, 10)
        .join(', ');

      papers.push({
        arxiv_id: id,
        source: 'huggingface',
        title: String(paper.title || item.title || 'Untitled'),
        abstract: String(paper.summary || item.summary || ''),
        authors,
        categories: 'AI (trending on Hugging Face)',
        published_at: String(item.publishedAt || paper.publishedAt || ''),
        url: `https://huggingface.co/papers/${id}`,
      });
    }

    return papers;
  } catch (error) {
    console.error('Hugging Face fetch failed:', error);
    return [];
  }
}

export type FetchResult = {
  papers: SourcePaper[];
  bySource: Record<string, number>;
};

export async function fetchAllSources(
  categories: string[],
  keywords: string[],
  enabledSources: string[]
): Promise<FetchResult> {
  const collected: SourcePaper[] = [];
  const bySource: Record<string, number> = {};

  if (enabledSources.includes('arxiv')) {
    const arxiv = await fetchArxivPapers(categories, keywords, 10);
    bySource.arxiv = arxiv.length;
    collected.push(...arxiv);
  }

  if (enabledSources.includes('openalex')) {
    const openalex = await fetchOpenAlexPapers(keywords, 15);
    bySource.openalex = openalex.length;
    collected.push(...openalex);
  }

  if (enabledSources.includes('huggingface')) {
    const hf = await fetchHuggingFacePapers(30);
    bySource.huggingface = hf.length;
    collected.push(...hf);
  }

  const seen = new Set<string>();
  const deduped = collected.filter(p => {
    if (seen.has(p.arxiv_id)) return false;
    seen.add(p.arxiv_id);
    return true;
  });

  return { papers: deduped, bySource };
}
