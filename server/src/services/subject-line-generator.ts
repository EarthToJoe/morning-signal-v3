import OpenAI from 'openai';
import { config } from '../config';
import { createCorrelatedLogger } from '../utils/logger';
import { estimateLlmCost, parseLlmJson } from '../utils/llm-helpers';
import { PromptManagerService } from './prompt-manager';
import { CostTrackerService } from './cost-tracker';
import { WrittenNewsletter, SubjectLineResult, ProfileContext } from 'shared';

export class SubjectLineGeneratorService {
  private openai: OpenAI;
  private promptManager: PromptManagerService;
  private costTracker: CostTrackerService;

  constructor(promptManager: PromptManagerService, costTracker: CostTrackerService) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.promptManager = promptManager;
    this.costTracker = costTracker;
  }

  async generateSubjectLines(writtenNewsletter: WrittenNewsletter, promptOverride: string | null, correlationId: string, profileContext?: ProfileContext): Promise<SubjectLineResult> {
    const log = createCorrelatedLogger(correlationId, 'subject-line-generator');
    const model = config.llmModels.subjectLineGenerator;
    let promptTemplate = promptOverride || (await this.promptManager.getActivePrompt('subject_line_generator')).promptText;
    const prompt = this.buildPrompt(promptTemplate, writtenNewsletter, profileContext);

    log.info('Generating subject lines', { model });
    const startTime = Date.now();
    const response = await this.openai.chat.completions.create({ model, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.7 });
    const latency = Date.now() - startTime;
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const cost = estimateLlmCost(inputTokens, outputTokens, model);
    log.info('Subject lines completed', { model, inputTokens, outputTokens, latencyMs: latency, cost });
    await this.costTracker.record({ correlationId, stage: 'subject_line_generator', provider: 'openai', inputTokens, outputTokens, apiCalls: 1, cost });

    const raw = response.choices[0]?.message?.content || '';
    const parsed = parseLlmJson(raw);
    let options: string[] = (parsed.subjectLines || parsed.subject_lines || []).slice(0, 3).map((s: string) => s.length > 50 ? s.substring(0, 50) : s);
    const name = profileContext?.newsletterName || config.defaultNewsletterName;
    while (options.length < 3) options.push(`${name} — ${new Date().toISOString().split('T')[0]}`);
    return { options, tokenUsage: { input: inputTokens, output: outputTokens }, cost };
  }

  private buildPrompt(template: string, newsletter: WrittenNewsletter, profileContext?: ProfileContext): string {
    const name = profileContext?.newsletterName || config.defaultNewsletterName;
    let prompt = template
      .replace('{{leadStory.headline}}', newsletter.leadStory.headline)
      .replace('{{leadStory.firstSentence}}', newsletter.leadStory.plainTextContent.split('.')[0] + '.');
    const headlinesBlock = newsletter.quickHits.map(qh => `- ${qh.headline}`).join('\n');
    prompt = prompt.replace(/\{\{#each quickHitHeadlines\}\}[\s\S]*?\{\{\/each\}\}/g, headlinesBlock);
    prompt = prompt.replace(/The Morning Signal/g, name);
    return prompt;
  }
}
