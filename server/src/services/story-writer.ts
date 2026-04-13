import OpenAI from 'openai';
import { config } from '../config';
import { createCorrelatedLogger } from '../utils/logger';
import { estimateLlmCost, parseLlmJson } from '../utils/llm-helpers';
import { PromptManagerService } from './prompt-manager';
import { CostTrackerService } from './cost-tracker';
import { StoryCandidate, WrittenSection, StoryRole, ProfileContext } from 'shared';

export class StoryWriterService {
  private openai: OpenAI;
  private promptManager: PromptManagerService;
  private costTracker: CostTrackerService;

  constructor(promptManager: PromptManagerService, costTracker: CostTrackerService) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.promptManager = promptManager;
    this.costTracker = costTracker;
  }

  async writeLeadStory(candidate: StoryCandidate, promptOverride: string | null, correlationId: string, profileContext?: ProfileContext): Promise<WrittenSection> {
    const log = createCorrelatedLogger(correlationId, 'story-writer');
    const model = config.llmModels.storyWriterLead;
    const promptTemplate = promptOverride || (await this.promptManager.getActivePrompt('story_writer_lead')).promptText;
    let prompt = this.buildLeadPrompt(promptTemplate, candidate);
    if (profileContext) prompt = this.injectProfileContext(prompt, profileContext);

    log.info('Writing lead story', { model, headline: candidate.headline });
    const startTime = Date.now();
    const response = await this.openai.chat.completions.create({ model, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.5 });
    const latency = Date.now() - startTime;
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const cost = estimateLlmCost(inputTokens, outputTokens, model);
    log.info('Lead story completed', { model, inputTokens, outputTokens, latencyMs: latency, cost });
    await this.costTracker.record({ correlationId, stage: 'story_writer_lead', provider: 'openai', inputTokens, outputTokens, apiCalls: 1, cost });
    return this.parseLeadResponse(response.choices[0]?.message?.content || '', candidate);
  }

  async writeQuickHits(quickHits: StoryCandidate[], promptOverride: string | null, correlationId: string, profileContext?: ProfileContext): Promise<WrittenSection[]> {
    if (quickHits.length === 0) return [];
    const log = createCorrelatedLogger(correlationId, 'story-writer');
    const model = config.llmModels.storyWriterBriefings;
    const name = profileContext?.newsletterName || config.defaultNewsletterName;
    const audience = profileContext?.audience || '';
    const prompt = this.buildQuickHitsPrompt(quickHits, name, audience);

    log.info('Writing quick hits', { model, count: quickHits.length });
    const startTime = Date.now();
    const response = await this.openai.chat.completions.create({ model, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.4 });
    const latency = Date.now() - startTime;
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const cost = estimateLlmCost(inputTokens, outputTokens, model);
    log.info('Quick hits completed', { model, inputTokens, outputTokens, latencyMs: latency, cost });
    await this.costTracker.record({ correlationId, stage: 'story_writer_quick_hits', provider: 'openai', inputTokens, outputTokens, apiCalls: 1, cost });
    const parsed = parseLlmJson(response.choices[0]?.message?.content || '');
    return (parsed.quickHits || []).map((qh: any, i: number) => ({
      role: 'quick_hit' as StoryRole, storyCandidateId: quickHits[i]?.id || '', headline: qh.headline || '',
      htmlContent: qh.htmlContent || '', plainTextContent: qh.plainTextContent || '',
      wordCount: this.countWords(qh.plainTextContent || qh.htmlContent || ''),
      sourceLinks: Array.isArray(qh.sourceLinks) ? qh.sourceLinks : [],
    }));
  }

  async writeWatchList(watchListItems: StoryCandidate[], promptOverride: string | null, correlationId: string, profileContext?: ProfileContext): Promise<WrittenSection[]> {
    if (watchListItems.length === 0) return [];
    const log = createCorrelatedLogger(correlationId, 'story-writer');
    const model = config.llmModels.storyWriterBriefings;
    const name = profileContext?.newsletterName || config.defaultNewsletterName;
    const audience = profileContext?.audience || '';
    const prompt = this.buildWatchListPrompt(watchListItems, name, audience);

    log.info('Writing watch list', { model, count: watchListItems.length });
    const startTime = Date.now();
    const response = await this.openai.chat.completions.create({ model, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.4 });
    const latency = Date.now() - startTime;
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const cost = estimateLlmCost(inputTokens, outputTokens, model);
    log.info('Watch list completed', { model, inputTokens, outputTokens, latencyMs: latency, cost });
    await this.costTracker.record({ correlationId, stage: 'story_writer_watch_list', provider: 'openai', inputTokens, outputTokens, apiCalls: 1, cost });
    const parsed = parseLlmJson(response.choices[0]?.message?.content || '');
    return (parsed.watchList || []).map((wl: any, i: number) => ({
      role: 'watch_list' as StoryRole, storyCandidateId: watchListItems[i]?.id || '', headline: wl.headline || '',
      htmlContent: wl.htmlContent || '', plainTextContent: wl.plainTextContent || '',
      wordCount: this.countWords(wl.plainTextContent || wl.htmlContent || ''), sourceLinks: [],
    }));
  }

  async writeBriefings(quickHits: StoryCandidate[], watchListItems: StoryCandidate[], promptOverride: string | null, correlationId: string, profileContext?: ProfileContext) {
    const [qh, wl] = await Promise.all([
      this.writeQuickHits(quickHits, promptOverride, correlationId, profileContext),
      this.writeWatchList(watchListItems, promptOverride, correlationId, profileContext),
    ]);
    return { quickHits: qh, watchList: wl };
  }

  async regenerateSection(section: WrittenSection, candidate: StoryCandidate, promptOverride: string | null, correlationId: string, profileContext?: ProfileContext, userGuidance?: string): Promise<WrittenSection> {
    if (section.role === 'lead_story') return this.writeLeadStory(candidate, promptOverride, correlationId, profileContext);
    if (section.role === 'quick_hit') { const r = await this.writeQuickHits([candidate], promptOverride, correlationId, profileContext); return r[0] || section; }
    const r = await this.writeWatchList([candidate], promptOverride, correlationId, profileContext); return r[0] || section;
  }

  private buildLeadPrompt(template: string, candidate: StoryCandidate): string {
    let prompt = template.replace('{{candidate.headline}}', candidate.headline).replace('{{candidate.narrativeSummary}}', candidate.narrativeSummary);
    const articlesBlock = candidate.sourceArticles.map((a, i) =>
      `[${i}] "${a.title}" — ${a.source} (${a.publishedAt?.toISOString().split('T')[0] || 'unknown'})\n  URL: ${a.url}\n  Snippet: ${a.snippet}`
    ).join('\n\n');
    prompt = prompt.replace(/\{\{#each sourceArticles\}\}[\s\S]*?\{\{\/each\}\}/g, articlesBlock);
    return prompt;
  }

  private injectProfileContext(prompt: string, ctx: ProfileContext): string {
    return prompt.replace(/The Morning Signal/g, ctx.newsletterName)
      .replace(/defense, energy, and technology decision-makers/g, ctx.audience || 'professionals');
  }

  private buildQuickHitsPrompt(quickHits: StoryCandidate[], newsletterName: string, audience: string): string {
    const currentDate = new Date().toISOString().split('T')[0];
    const qhBlock = quickHits.map((qh, i) => {
      const sources = qh.sourceArticles.map(a => `  - "${a.title}" — ${a.source}: ${a.url}\n    Snippet: ${a.snippet.substring(0, 500)}`).join('\n');
      return `--- Quick Hit ${i + 1} ---\nHeadline: ${qh.headline}\nSummary: ${qh.narrativeSummary}\nSources:\n${sources}`;
    }).join('\n\n');
    return `You are a briefing writer for ${newsletterName}, a professional newsletter.${audience ? `\nTARGET AUDIENCE: ${audience}` : ''}

TASK: Write ${quickHits.length} quick-hit briefing items. Give each one your full attention.

${qhBlock}

TODAY'S DATE: ${currentDate}

REQUIREMENTS PER QUICK HIT:
- MINIMUM 120 words, target 150 words. DO NOT write fewer than 120 words per item.
- A punchy, specific headline
- A concise but informative summary covering the key facts: who, what, when, and why it matters
- At least one inline hyperlink to a source article using HTML <a> tags
- Professional tone suitable for busy executives
- These are stories about things that ALREADY HAPPENED

OUTPUT FORMAT (strict JSON):
{
  "quickHits": [
    { "headline": "string", "htmlContent": "string — HTML with <a> tags", "plainTextContent": "string", "sourceLinks": [{ "url": "string", "anchorText": "string" }] }
  ]
}`;
  }

  private buildWatchListPrompt(watchListItems: StoryCandidate[], newsletterName: string, audience: string): string {
    const currentDate = new Date().toISOString().split('T')[0];
    const wlBlock = watchListItems.map((wl, i) => {
      const sources = wl.sourceArticles.map(a => `  - "${a.title}" — ${a.source}: ${a.url}\n    Snippet: ${a.snippet.substring(0, 500)}`).join('\n');
      return `--- Watch Item ${i + 1} ---\nHeadline: ${wl.headline}\nSummary: ${wl.narrativeSummary}\nSources:\n${sources}`;
    }).join('\n\n');
    return `You are a forward-looking analyst for ${newsletterName}, a professional newsletter.${audience ? `\nTARGET AUDIENCE: ${audience}` : ''}

TASK: Write ${watchListItems.length} watch list items. These are FORWARD-LOOKING — about things that HAVE NOT happened yet.

${wlBlock}

TODAY'S DATE: ${currentDate}

REQUIREMENTS PER WATCH LIST ITEM:
- MINIMUM 80 words, target 100 words. DO NOT write fewer than 80 words per item.
- These are about upcoming decisions, pending legislation, scheduled events, or developing situations to monitor
- Quick hits report news that happened, watch list flags what is COMING NEXT
- Include a specific date or timeframe
- Explain what is expected to happen and why the reader should care
- Reference source material where applicable using HTML <a> tags

OUTPUT FORMAT (strict JSON):
{
  "watchList": [
    { "headline": "string", "timeframe": "string", "htmlContent": "string", "plainTextContent": "string" }
  ]
}`;
  }

  private countWords(text: string): number {
    return text.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  private parseLeadResponse(raw: string, candidate: StoryCandidate): WrittenSection {
    const parsed = parseLlmJson(raw);
    return {
      role: 'lead_story', storyCandidateId: candidate.id,
      headline: parsed.headline || candidate.headline,
      htmlContent: parsed.htmlContent || '', plainTextContent: parsed.plainTextContent || '',
      wordCount: this.countWords(parsed.plainTextContent || parsed.htmlContent || ''),
      sourceLinks: Array.isArray(parsed.sourceLinks) ? parsed.sourceLinks : [],
    };
  }
}
