import { query } from '../config/database';
import { createCorrelatedLogger } from '../utils/logger';
import { generateCorrelationId } from './correlation';
import { ArticleDiscoveryService, ParallelAiClient } from '../services/article-discovery';
import { ContentResearcherService } from '../services/content-researcher';
import { StoryWriterService } from '../services/story-writer';
import { SubjectLineGeneratorService } from '../services/subject-line-generator';
import { NewsletterAssemblerService } from '../services/newsletter-assembler';
import { CostTrackerService } from '../services/cost-tracker';
import { PromptManagerService } from '../services/prompt-manager';
import { config } from '../config';
import {
  PipelineRunStatus, EditorSelection, TopicConfig,
  StoryCandidate, WrittenNewsletter, ProfileContext,
  SourceCollection, SectionNames,
} from 'shared';
import { DEFAULT_SECTION_NAMES } from 'shared';

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function withRetry<T>(op: () => Promise<T>, maxAttempts: number, corrId: string, component: string, log: any): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await op(); }
    catch (error: any) {
      if (attempt === maxAttempts) { log.error('Failed after retries', { correlationId: corrId, component, attempt, error: error.message }); throw error; }
      const delay = 1000 * Math.pow(2, attempt - 1);
      log.warn('Retrying', { correlationId: corrId, component, attempt, nextRetryMs: delay, error: error.message });
      await sleep(delay);
    }
  }
  throw new Error('Unreachable');
}

export class PipelineOrchestrator {
  private costTracker: CostTrackerService;
  private promptManager: PromptManagerService;
  private articleDiscovery: ArticleDiscoveryService;
  private contentResearcher: ContentResearcherService;
  private storyWriter: StoryWriterService;
  private subjectLineGenerator: SubjectLineGeneratorService;
  private newsletterAssembler: NewsletterAssemblerService;

  constructor() {
    this.costTracker = new CostTrackerService();
    this.promptManager = new PromptManagerService();
    const searchClient = new ParallelAiClient(config.parallelAiApiKey);
    this.articleDiscovery = new ArticleDiscoveryService(searchClient, this.costTracker);
    this.contentResearcher = new ContentResearcherService(this.promptManager, this.costTracker);
    this.storyWriter = new StoryWriterService(this.promptManager, this.costTracker);
    this.subjectLineGenerator = new SubjectLineGeneratorService(this.promptManager, this.costTracker);
    this.newsletterAssembler = new NewsletterAssemblerService();
  }

  async startPipeline(profileId: string, userId: string, correlationId?: string, promptOverride?: string | null, daysBack?: number, editionNumberOverride?: number): Promise<PipelineRunStatus> {
    const corrId = correlationId || generateCorrelationId();
    const log = createCorrelatedLogger(corrId, 'orchestrator');
    log.info('Pipeline started', { profileId });

    // Load profile
    const profileResult = await query(
      `SELECT np.*, json_agg(json_build_object('id', tc.id, 'category', tc.category, 'displayName', tc.display_name,
        'searchQueries', tc.search_queries, 'objective', tc.objective, 'preferredSources', tc.preferred_sources,
        'priority', tc.priority, 'isActive', tc.is_active)) FILTER (WHERE tc.id IS NOT NULL) as categories
       FROM newsletter_profiles np LEFT JOIN topic_config tc ON tc.profile_id = np.id
       WHERE np.id = $1 GROUP BY np.id`, [profileId]
    );
    if (profileResult.rows.length === 0) throw new Error('Profile not found');
    const profile = profileResult.rows[0];
    const topicConfigs: TopicConfig[] = (profile.categories || []).map((c: any) => ({
      id: c.id, category: c.category, displayName: c.displayName, searchQueries: c.searchQueries,
      objective: c.objective, preferredSources: c.preferredSources, priority: c.priority, isActive: c.isActive,
    }));

    // Load source collections
    const scResult = await query('SELECT * FROM source_collections WHERE profile_id = $1', [profileId]);
    const sourceCollections: SourceCollection[] = scResult.rows.map((r: any) => ({
      id: r.id, profileId: r.profile_id, name: r.name, collectionType: r.collection_type, domains: r.domains || [],
    }));

    const profileContext: ProfileContext = {
      newsletterName: profile.name,
      audience: profile.audience || '',
      sectionNames: profile.section_names || DEFAULT_SECTION_NAMES,
    };

    const editionNumber = editionNumberOverride || await this.getNextEditionNumber(profileId);
    const editionDate = new Date().toISOString().split('T')[0];

    await query(
      `INSERT INTO editions (correlation_id, status, edition_number, edition_date, profile_id, user_id) VALUES ($1, $2, $3, $4, $5, $6)`,
      [corrId, 'discovery', editionNumber, editionDate, profileId, userId]
    );

    try {
      await this.updateStatus(corrId, 'discovery');
      const discoveryResult = await withRetry(
        () => this.articleDiscovery.discoverArticles(topicConfigs, corrId, daysBack, sourceCollections),
        3, corrId, 'article-discovery', log
      );

      // Batched article insert
      const editionId = await this.getEditionId(corrId);
      if (discoveryResult.articles.length > 0) {
        const values = discoveryResult.articles.map((a, i) =>
          `($${i*10+1}, $${i*10+2}, $${i*10+3}, $${i*10+4}, $${i*10+5}, $${i*10+6}, $${i*10+7}, $${i*10+8}, $${i*10+9}, $${i*10+10})`
        ).join(', ');
        const params = discoveryResult.articles.flatMap(a => [
          a.id, editionId, a.url, a.title, a.snippet, a.source, a.publishedAt || null, a.rankPosition, a.category, a.discoveredVia
        ]);
        await query(
          `INSERT INTO articles (id, edition_id, url, title, snippet, source, published_at, rank_position, category, discovered_via) VALUES ${values}`,
          params
        );
      }

      if (discoveryResult.warnings.length > 0) {
        await query('UPDATE editions SET warnings = $1 WHERE correlation_id = $2', [JSON.stringify(discoveryResult.warnings), corrId]);
      }

      // Clustering
      await this.updateStatus(corrId, 'clustering');
      const clusteringResult = await withRetry(
        () => this.contentResearcher.clusterArticles(discoveryResult.articles, promptOverride || null, corrId, profileContext),
        3, corrId, 'content-researcher', log
      );

      for (const candidate of clusteringResult.storyCandidates) {
        await query(
          `INSERT INTO story_candidates (id, edition_id, suggested_role, headline, narrative_summary, category, is_manual_story) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [candidate.id, editionId, candidate.suggestedRole, candidate.headline, candidate.narrativeSummary, candidate.category, candidate.isManualStory]
        );
        for (const articleId of candidate.sourceArticleIds) {
          await query('INSERT INTO story_candidate_articles (story_candidate_id, article_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [candidate.id, articleId]);
        }
      }

      await this.updateStatus(corrId, 'awaiting_selection');
      log.info('Phase 1 complete', { articles: discoveryResult.articles.length, candidates: clusteringResult.storyCandidates.length });
      return this.buildStatus(corrId, 'awaiting_selection', 'awaiting_editor');
    } catch (error: any) {
      log.error('Pipeline Phase 1 failed', { error: error.message });
      await this.updateStatus(corrId, 'failed');
      return this.buildStatus(corrId, 'failed', 'failed', [error.message]);
    }
  }

  async continueAfterSelection(correlationId: string, selections: EditorSelection, promptOverrides?: any): Promise<PipelineRunStatus> {
    const log = createCorrelatedLogger(correlationId, 'orchestrator');
    const editionId = await this.getEditionId(correlationId);

    // Load profile context
    const edition = await query(
      `SELECT e.*, np.name as profile_name, np.audience, np.section_names FROM editions e
       LEFT JOIN newsletter_profiles np ON e.profile_id = np.id WHERE e.correlation_id = $1`, [correlationId]
    );
    const profileContext: ProfileContext = {
      newsletterName: edition.rows[0]?.profile_name || config.defaultNewsletterName,
      audience: edition.rows[0]?.audience || '',
      sectionNames: edition.rows[0]?.section_names || DEFAULT_SECTION_NAMES,
    };

    log.info('Phase 2 started', { leadStory: selections.leadStory.headline, quickHitCount: selections.quickHits.length, watchListCount: selections.watchListItems.length });

    try {
      await this.updateStatus(correlationId, 'writing');

      // All three writing calls in parallel
      let leadSection;
      let qhResults: any[] = [];
      let wlResults: any[] = [];

      const [leadResult, qhResult, wlResult] = await Promise.allSettled([
        withRetry(() => this.storyWriter.writeLeadStory(selections.leadStory, promptOverrides?.lead || null, correlationId, profileContext), 3, correlationId, 'story-writer-lead', log),
        withRetry(() => this.storyWriter.writeQuickHits(selections.quickHits, promptOverrides?.briefings || null, correlationId, profileContext), 3, correlationId, 'story-writer-briefings', log),
        withRetry(() => this.storyWriter.writeWatchList(selections.watchListItems, promptOverrides?.briefings || null, correlationId, profileContext), 3, correlationId, 'story-writer-watch', log),
      ]);

      if (leadResult.status === 'fulfilled') {
        leadSection = leadResult.value;
      } else {
        log.error('Lead story failed', { error: (leadResult as any).reason?.message });
        leadSection = { role: 'lead_story' as const, storyCandidateId: selections.leadStory.id, headline: `[Failed] ${selections.leadStory.headline}`, htmlContent: '<p><em>Failed to generate.</em></p>', plainTextContent: '[Failed]', wordCount: 0, sourceLinks: [] };
      }
      if (qhResult.status === 'fulfilled') qhResults = qhResult.value;
      if (wlResult.status === 'fulfilled') wlResults = wlResult.value;

      const writtenNewsletter: WrittenNewsletter = {
        leadStory: leadSection, quickHits: qhResults, watchList: wlResults,
        totalWordCount: leadSection.wordCount + qhResults.reduce((s, q) => s + q.wordCount, 0) + wlResults.reduce((s, w) => s + w.wordCount, 0),
        tokenUsage: { input: 0, output: 0 }, cost: 0,
      };

      // Persist sections
      const allSections = [leadSection, ...qhResults, ...wlResults];
      for (const section of allSections) {
        await query(
          `INSERT INTO written_sections (edition_id, story_candidate_id, role, headline, html_content, plain_text_content, word_count, source_links)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [editionId, section.storyCandidateId || null, section.role, section.headline, section.htmlContent, section.plainTextContent, section.wordCount, JSON.stringify(section.sourceLinks)]
        );
      }

      // Subject lines
      let subjectLineResult;
      try {
        subjectLineResult = await withRetry(
          () => this.subjectLineGenerator.generateSubjectLines(writtenNewsletter, promptOverrides?.subjectLine || null, correlationId, profileContext),
          3, correlationId, 'subject-line-generator', log
        );
      } catch {
        subjectLineResult = { options: [`${profileContext.newsletterName} — ${edition.rows[0]?.edition_date}`], tokenUsage: { input: 0, output: 0 }, cost: 0 };
      }

      // Assemble
      const assembled = await this.newsletterAssembler.assemble(
        writtenNewsletter, subjectLineResult.options[0],
        edition.rows[0].edition_number, edition.rows[0].edition_date,
        correlationId, undefined, profileContext.newsletterName, profileContext.sectionNames
      );

      await query(
        `INSERT INTO assembled_newsletters (edition_id, html_content, plain_text_content, selected_subject_line, subject_line_options, section_metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (edition_id) DO UPDATE SET html_content = $2, plain_text_content = $3, selected_subject_line = $4, subject_line_options = $5, section_metadata = $6`,
        [editionId, assembled.html, assembled.plainText, subjectLineResult.options[0], JSON.stringify(subjectLineResult.options), JSON.stringify(assembled.sectionMetadata)]
      );

      await this.updateStatus(correlationId, 'awaiting_review');
      log.info('Phase 2 complete', { totalWordCount: writtenNewsletter.totalWordCount, subjectLineOptions: subjectLineResult.options.length });
      return this.buildStatus(correlationId, 'awaiting_review', 'awaiting_editor');
    } catch (error: any) {
      log.error('Pipeline Phase 2 failed', { error: error.message });
      await this.updateStatus(correlationId, 'failed');
      return this.buildStatus(correlationId, 'failed', 'failed', [error.message]);
    }
  }

  async getStatus(correlationId: string): Promise<PipelineRunStatus> {
    const result = await query(
      `SELECT e.*, np.section_names FROM editions e LEFT JOIN newsletter_profiles np ON e.profile_id = np.id WHERE e.correlation_id = $1`,
      [correlationId]
    );
    if (result.rows.length === 0) throw new Error(`Edition not found: ${correlationId}`);
    const row = result.rows[0];
    const statusMap: Record<string, PipelineRunStatus['status']> = {
      discovery: 'running', clustering: 'running', writing: 'running',
      awaiting_selection: 'awaiting_editor', awaiting_review: 'awaiting_editor',
      designing: 'awaiting_editor', approved: 'completed', delivered: 'completed', failed: 'failed',
    };
    return {
      correlationId, currentStage: row.status, status: statusMap[row.status] || 'running',
      startedAt: new Date(row.started_at), completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      warnings: row.warnings || [], costSummary: await this.costTracker.getEditionSummary(correlationId),
      sectionNames: row.section_names || DEFAULT_SECTION_NAMES,
    };
  }

  private async getNextEditionNumber(profileId: string): Promise<number> {
    const result = await query('SELECT COALESCE(MAX(edition_number), 0) + 1 as next FROM editions WHERE profile_id = $1', [profileId]);
    return result.rows[0].next;
  }

  private async getEditionId(correlationId: string): Promise<string> {
    const result = await query('SELECT id FROM editions WHERE correlation_id = $1', [correlationId]);
    if (result.rows.length === 0) throw new Error(`Edition not found: ${correlationId}`);
    return result.rows[0].id;
  }

  private async updateStatus(correlationId: string, status: string): Promise<void> {
    const completedStatuses = ['approved', 'delivered', 'failed'];
    if (completedStatuses.includes(status)) {
      await query('UPDATE editions SET status = $1, completed_at = NOW() WHERE correlation_id = $2', [status, correlationId]);
    } else {
      await query('UPDATE editions SET status = $1 WHERE correlation_id = $2', [status, correlationId]);
    }
  }

  private buildStatus(correlationId: string, currentStage: string, status: PipelineRunStatus['status'], warnings: string[] = []): PipelineRunStatus {
    return { correlationId, currentStage, status, startedAt: new Date(), warnings };
  }
}
