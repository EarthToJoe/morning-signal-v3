import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { config } from '../config';
import { createCorrelatedLogger } from '../utils/logger';
import { estimateLlmCost, parseLlmJson } from '../utils/llm-helpers';
import { PromptManagerService } from './prompt-manager';
import { CostTrackerService } from './cost-tracker';
import { DiscoveredArticle, StoryCandidate, ClusteringResult, TopicCategory, StoryRole, ProfileContext } from 'shared';

export class ContentResearcherService {
  private openai: OpenAI;
  private promptManager: PromptManagerService;
  private costTracker: CostTrackerService;

  constructor(promptManager: PromptManagerService, costTracker: CostTrackerService) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.promptManager = promptManager;
    this.costTracker = costTracker;
  }

  async clusterArticles(
    articles: DiscoveredArticle[], promptOverride: string | null,
    correlationId: string, profileContext?: ProfileContext
  ): Promise<ClusteringResult> {
    const log = createCorrelatedLogger(correlationId, 'content-researcher');
    let promptTemplate = promptOverride || (await this.promptManager.getActivePrompt('content_researcher')).promptText;
    const prompt = this.buildPrompt(promptTemplate, articles, profileContext);

    log.info('Calling LLM for clustering', { articleCount: articles.length, model: config.llmModels.contentResearcher });
    const startTime = Date.now();
    const response = await this.openai.chat.completions.create({
      model: config.llmModels.contentResearcher,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }, temperature: 0.3,
    });
    const latency = Date.now() - startTime;
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const cost = estimateLlmCost(inputTokens, outputTokens, config.llmModels.contentResearcher);

    log.info('LLM clustering completed', { model: config.llmModels.contentResearcher, inputTokens, outputTokens, latencyMs: latency, cost });
    await this.costTracker.record({ correlationId, stage: 'content_researcher', provider: 'openai', inputTokens, outputTokens, apiCalls: 1, cost });

    const rawContent = response.choices[0]?.message?.content || '';
    const parsed = this.parseClusteringResponse(rawContent, articles, log);
    return { ...parsed, tokenUsage: { input: inputTokens, output: outputTokens }, cost };
  }

  private buildPrompt(template: string, articles: DiscoveredArticle[], profileContext?: ProfileContext): string {
    let prompt = template
      .replace('{{articleCount}}', String(articles.length))
      .replace('{{currentDate}}', new Date().toISOString().split('T')[0]);

    // V3: inject audience and newsletter name
    if (profileContext) {
      prompt = prompt.replace(/The Morning Signal/g, profileContext.newsletterName);
      prompt = prompt.replace(/defense, energy, and technology decision-makers/g, profileContext.audience || 'professionals');
      // Inject section name awareness so GPT uses custom names for role suggestions
      const sn = profileContext.sectionNames;
      if (sn) {
        prompt += `\n\nSECTION NAMES: The lead section is called "${sn.lead}", the briefing section is called "${sn.briefing}", and the watch section is called "${sn.watch}". Use "lead_story", "quick_hit", and "watch_list" as the suggestedRole values in JSON, but be aware of these custom names when assessing relevance.`;
      }
      if (profileContext.audience) {
        prompt += `\nTARGET AUDIENCE: ${profileContext.audience}`;
      }
    }

    // V3: truncate snippets for clustering (title + first 500 chars — full excerpts only for writing)
    const articlesBlock = articles.map((a, i) =>
      `[${i}] "${a.title}" — ${a.source} (${a.publishedAt?.toISOString().split('T')[0] || 'unknown'})\n  URL: ${a.url}\n  Category: ${a.category}\n  Snippet: ${a.snippet.substring(0, 500)}`
    ).join('\n\n');
    prompt = prompt.replace(/\{\{#each articles\}\}[\s\S]*?\{\{\/each\}\}/g, articlesBlock);
    return prompt;
  }

  private parseClusteringResponse(raw: string, articles: DiscoveredArticle[], log: any) {
    const parsed = parseLlmJson(raw);
    if (!Array.isArray(parsed.storyCandidates)) throw new Error('Missing storyCandidates array');

    const candidates: StoryCandidate[] = parsed.storyCandidates.slice(0, 15).map((c: any) => {
      const sourceIndices: number[] = Array.isArray(c.sourceArticleIndices) ? c.sourceArticleIndices : [];
      const validIndices = sourceIndices.filter(i => i >= 0 && i < articles.length);
      const sourceArticles = validIndices.map(i => articles[i]);
      return {
        id: uuidv4(), suggestedRole: this.validateRole(c.suggestedRole),
        headline: c.headline || 'Untitled Story', narrativeSummary: c.narrativeSummary || '',
        sourceArticleIds: sourceArticles.map(a => a.id), sourceArticles,
        category: c.category || 'general', isManualStory: false,
      };
    });
    if (candidates.length < 8) log.warn('Fewer than 8 candidates', { count: candidates.length });

    const lowRelevanceArticleIds: string[] = [];
    const lowRelevanceReasons: Record<string, string> = {};
    if (Array.isArray(parsed.lowRelevanceArticles)) {
      for (const lr of parsed.lowRelevanceArticles) {
        if (typeof lr.index === 'number' && lr.index >= 0 && lr.index < articles.length) {
          lowRelevanceArticleIds.push(articles[lr.index].id);
          lowRelevanceReasons[articles[lr.index].id] = lr.reason || 'Low relevance';
        }
      }
    }
    return { storyCandidates: candidates, lowRelevanceArticleIds, lowRelevanceReasons };
  }

  private validateRole(role: string): StoryRole {
    const valid: StoryRole[] = ['lead_story', 'quick_hit', 'watch_list'];
    return valid.includes(role as StoryRole) ? (role as StoryRole) : 'quick_hit';
  }
}
