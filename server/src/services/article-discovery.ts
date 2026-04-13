import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { createCorrelatedLogger } from '../utils/logger';
import { CostTrackerService } from './cost-tracker';
import {
  DiscoveredArticle, ArticleDiscoveryResult, RawSearchResult,
  TopicCategory, TopicConfig, DiscoverySource, SourceCollection,
} from 'shared';

interface ParallelAiResult { url: string; title: string; publish_date: string | null; excerpts: string[]; }
interface ParallelAiResponse { search_id: string; results: ParallelAiResult[]; warnings: string | null; usage: { name: string; count: number }[]; }

interface SearchOptions {
  objective: string; searchQueries: string[]; maxResults: number;
  afterDate?: string; excludeDomains?: string[];
}

export class ParallelAiClient {
  private apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }

  async search(options: SearchOptions): Promise<RawSearchResult[]> {
    const body: Record<string, any> = {
      objective: options.objective, search_queries: options.searchQueries,
      max_results: options.maxResults,
      excerpts: { max_chars_per_result: 10000, max_chars_total: 50000 },
      fetch_policy: { max_age_seconds: 172800 },
    };
    if (options.afterDate) {
      body.source_policy = { after_date: options.afterDate, ...(options.excludeDomains ? { exclude_domains: options.excludeDomains } : {}) };
    } else if (options.excludeDomains) {
      body.source_policy = { exclude_domains: options.excludeDomains };
    }
    const response = await fetch('https://api.parallel.ai/v1beta/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Parallel AI API error: ${response.status} ${response.statusText}`);
    const data = await response.json() as ParallelAiResponse;
    return (data.results || []).map((item, index) => ({
      url: item.url || '', title: item.title || '',
      snippet: (item.excerpts || []).join('\n\n').trim(),
      source: this.extractDomain(item.url),
      publishedDate: item.publish_date || undefined, rankPosition: index,
    }));
  }

  private extractDomain(url: string): string {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
  }
}

function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0];
}

function buildObjective(topic: TopicConfig, sourceCollections?: SourceCollection[]): string {
  const base = `Find specific, individual news articles published in the last few days. I need articles with unique URLs that point to individual stories — NOT website homepages, section landing pages, company LinkedIn profiles, or topic index pages. Each result should be a single news story or report with a specific headline, author or publication date, and substantive content. Prefer articles from established news outlets.`;
  if (topic.objective) {
    const topicPart = topic.objective.toLowerCase().startsWith('topic:') ? topic.objective : `Topic: ${topic.objective}`;
    // Append preferred sources from source collections
    const preferred = (sourceCollections || []).filter(sc => sc.collectionType === 'preferred').flatMap(sc => sc.domains);
    const sourceSuffix = preferred.length > 0 ? ` Preferred sources: ${preferred.join(', ')}.` : '';
    return `${base} ${topicPart}${sourceSuffix}`;
  }
  const defaults: Record<string, string> = {
    defense: `U.S. and allied defense developments including military contracts, weapons programs, Pentagon policy, NATO operations, defense industry news, and military technology. Preferred sources: Defense News, Breaking Defense, Defense One, Military Times, Reuters, AP, USNI News.`,
    energy: `Energy sector developments including oil & gas markets, renewable energy projects, grid infrastructure, nuclear energy policy, energy legislation, and energy technology. Preferred sources: E&E News, Utility Dive, Reuters, Bloomberg Energy, S&P Global.`,
    technology: `Technology developments including cybersecurity, AI policy, cloud computing, semiconductor supply chain, space technology, and federal IT modernization. Preferred sources: Ars Technica, The Verge, Wired, Federal News Network, NextGov, CyberScoop.`,
    policy: `U.S. government policy affecting defense, energy, and technology sectors including executive orders, legislation, regulatory actions, and budget decisions. Preferred sources: Politico, The Hill, Reuters, AP, Federal News Network.`,
  };
  const categoryPart = defaults[topic.category] || `${topic.displayName}. Search for recent news and developments.`;
  return `${base} Topic: ${categoryPart}`;
}

function mergeExcludeDomains(defaults: string[], sourceCollections?: SourceCollection[]): string[] {
  const excluded = (sourceCollections || []).filter(sc => sc.collectionType === 'excluded').flatMap(sc => sc.domains);
  return [...new Set([...defaults, ...excluded])];
}

export class ArticleDiscoveryService {
  private searchClient: ParallelAiClient;
  private costTracker: CostTrackerService;
  constructor(searchClient: ParallelAiClient, costTracker: CostTrackerService) {
    this.searchClient = searchClient; this.costTracker = costTracker;
  }

  /** V3: Parallel search calls via Promise.allSettled */
  async discoverArticles(topicConfigs: TopicConfig[], correlationId: string, daysBack?: number, sourceCollections?: SourceCollection[]): Promise<ArticleDiscoveryResult> {
    const log = createCorrelatedLogger(correlationId, 'article-discovery');
    const afterDate = daysAgo(daysBack || 3);
    const defaultExcludes = ['linkedin.com', 'facebook.com', 'twitter.com', 'youtube.com'];
    const excludeDomains = mergeExcludeDomains(defaultExcludes, sourceCollections);
    const activeTopics = topicConfigs.filter(t => t.isActive);

    // V3: parallel search calls
    const searchPromises = activeTopics.map(topic =>
      this.searchClient.search({
        objective: buildObjective(topic, sourceCollections),
        searchQueries: topic.searchQueries,
        maxResults: 15, afterDate, excludeDomains,
      }).then(results => ({ topic, results, error: null as string | null }))
        .catch(err => ({ topic, results: [] as RawSearchResult[], error: err.message as string }))
    );
    const searchResults = await Promise.all(searchPromises);

    const allArticles: DiscoveredArticle[] = [];
    const warnings: string[] = [];
    const categoryCoverage: Record<string, number> = {};
    for (const t of activeTopics) categoryCoverage[t.category] = 0;

    for (const { topic, results, error } of searchResults) {
      if (error) { log.error('Search failed', { category: topic.category, error }); warnings.push(`Search failed for ${topic.category}: ${error}`); continue; }
      log.info('Search completed', { category: topic.category, resultCount: results.length });
      for (const raw of results) {
        const article = this.validateArticle(raw, topic.category, 'search_api');
        if (article) { allArticles.push(article); categoryCoverage[topic.category]++; }
      }
    }

    const deduplicated = this.deduplicateArticles(allArticles);
    const duplicatesRemoved = allArticles.length - deduplicated.length;
    if (deduplicated.length < 10) warnings.push(`Low coverage: only ${deduplicated.length} articles found`);

    const searchApiCalls = activeTopics.length;
    await this.costTracker.record({ correlationId, stage: 'article_discovery', provider: 'parallel-ai', apiCalls: searchApiCalls, cost: searchApiCalls * 0.01 });
    log.info('Article discovery completed', { totalFound: deduplicated.length, duplicatesRemoved, searchApiCalls, warnings });

    return { articles: deduplicated, totalFound: deduplicated.length, duplicatesRemoved, categoryCoverage, searchApiCalls, warnings };
  }

  async customSearch(queryText: string, existingArticles: DiscoveredArticle[], correlationId: string): Promise<ArticleDiscoveryResult> {
    const log = createCorrelatedLogger(correlationId, 'article-discovery');
    const results = await this.searchClient.search({
      objective: `Find specific, recently published news articles about the following topic. Return individual stories, not website homepages or landing pages.`,
      searchQueries: [queryText], maxResults: 15, afterDate: daysAgo(7),
    });
    const newArticles: DiscoveredArticle[] = [];
    for (const raw of results) { const a = this.validateArticle(raw, 'general', 'custom_search'); if (a) newArticles.push(a); }
    const merged = [...existingArticles, ...newArticles];
    const deduplicated = this.deduplicateArticles(merged);
    await this.costTracker.record({ correlationId, stage: 'custom_search', provider: 'parallel-ai', apiCalls: 1, cost: 0.01 });
    const categoryCoverage: Record<string, number> = {};
    for (const a of deduplicated) categoryCoverage[a.category] = (categoryCoverage[a.category] || 0) + 1;
    return { articles: deduplicated, totalFound: deduplicated.length, duplicatesRemoved: merged.length - deduplicated.length, categoryCoverage, searchApiCalls: 1, warnings: deduplicated.length < 10 ? [`Low coverage: only ${deduplicated.length} articles`] : [] };
  }

  validateArticle(raw: RawSearchResult, category: TopicCategory, source: DiscoverySource): DiscoveredArticle | null {
    if (!raw.url || !raw.title) return null;
    return { id: uuidv4(), url: raw.url.trim(), title: raw.title.trim(), snippet: raw.snippet || '', source: raw.source || '', publishedAt: raw.publishedDate ? new Date(raw.publishedDate) : undefined, rankPosition: raw.rankPosition, category, discoveredVia: source };
  }

  deduplicateArticles(articles: DiscoveredArticle[]): DiscoveredArticle[] {
    const seen = new Set<string>();
    return articles.filter(a => { const u = a.url.toLowerCase(); if (seen.has(u)) return false; seen.add(u); return true; });
  }
}
