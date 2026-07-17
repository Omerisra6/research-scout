export type ArxivPaper = {
  arxiv_id: string;
  title: string;
  abstract: string;
  authors: string;
  categories: string;
  published_at: string;
  url: string;
};

function extractArxivId(idUrl: string): string {
  const match = idUrl.match(/abs\/(.+?)(?:v\d+)?$/);
  return match ? match[1] : idUrl;
}

function parseAtomEntry(entry: string): ArxivPaper | null {
  const getId = (tag: string) => {
    const match = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return match ? match[1].trim() : '';
  };

  const idUrl = getId('id');
  if (!idUrl) return null;

  const title = getId('title').replace(/\s+/g, ' ');
  const abstract = getId('summary').replace(/\s+/g, ' ');
  const published = getId('published');

  const authorMatches = entry.matchAll(/<author>\s*<name>([^<]+)<\/name>/g);
  const authors = Array.from(authorMatches).map(m => m[1].trim()).join(', ');

  const categoryMatches = entry.matchAll(/<category[^>]*term="([^"]+)"/g);
  const categories = Array.from(categoryMatches).map(m => m[1]).join(', ');

  const linkMatch = entry.match(/<link[^>]*href="([^"]*abs[^"]*)"/);
  const url = linkMatch ? linkMatch[1] : idUrl;

  return {
    arxiv_id: extractArxivId(idUrl),
    title,
    abstract,
    authors,
    categories,
    published_at: published,
    url,
  };
}

export async function fetchArxivPapers(
  categories: string[],
  keywords: string[],
  maxResults = 50
): Promise<ArxivPaper[]> {
  const searchTerms: string[] = [];

  if (categories.length > 0) {
    const catQuery = categories.map(c => `cat:${c.trim()}`).join('+OR+');
    searchTerms.push(`(${catQuery})`);
  }

  if (keywords.length > 0) {
    const kwQuery = keywords.map(k => `all:${k.trim()}`).join('+OR+');
    searchTerms.push(`(${kwQuery})`);
  }

  const query = searchTerms.join('+AND+');
  const baseUrl = 'http://export.arxiv.org/api/query';
  const url = `${baseUrl}?search_query=${query}&start=0&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'ResearchScout/1.0' },
  });

  if (!response.ok) {
    throw new Error(`arXiv API error: ${response.status}`);
  }

  const xml = await response.text();
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  
  return entries
    .map(parseAtomEntry)
    .filter((p): p is ArxivPaper => p !== null);
}
