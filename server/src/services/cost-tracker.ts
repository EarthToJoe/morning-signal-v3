import { query } from '../config/database';
import { createCorrelatedLogger } from '../utils/logger';
import { CostEntry, EditionCostSummary } from 'shared';
import { config } from '../config';

export class CostTrackerService {
  async record(entry: Omit<CostEntry, 'id' | 'recordedAt'>): Promise<void> {
    const log = createCorrelatedLogger(entry.correlationId, 'cost-tracker');
    const editionResult = await query('SELECT id FROM editions WHERE correlation_id = $1', [entry.correlationId]);
    if (editionResult.rows.length === 0) { log.warn('No edition found, skipping cost entry'); return; }
    const editionId = editionResult.rows[0].id;

    await query(
      `INSERT INTO cost_entries (edition_id, stage, provider, input_tokens, output_tokens, api_calls, cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [editionId, entry.stage, entry.provider, entry.inputTokens || 0, entry.outputTokens || 0, entry.apiCalls, entry.cost]
    );

    await query(
      `UPDATE editions SET total_cost = (SELECT COALESCE(SUM(cost), 0) FROM cost_entries WHERE edition_id = $1),
       is_over_budget = (SELECT COALESCE(SUM(cost), 0) > $2 FROM cost_entries WHERE edition_id = $1) WHERE id = $1`,
      [editionId, config.costBudgetPerEdition]
    );
    log.info('Cost entry recorded', { stage: entry.stage, cost: entry.cost, provider: entry.provider });
  }

  async getEditionSummary(correlationId: string): Promise<EditionCostSummary> {
    const editionResult = await query('SELECT id FROM editions WHERE correlation_id = $1', [correlationId]);
    if (editionResult.rows.length === 0) {
      return { correlationId, searchCost: 0, researchCost: 0, writingCost: 0, subjectLineCost: 0, imageCost: 0, totalCost: 0, llmCallCount: 0, searchApiCallCount: 0, customSearchCallCount: 0, manualStoryCount: 0, imageCount: 0, isOverBudget: false };
    }
    const editionId = editionResult.rows[0].id;
    const entries = await query(
      'SELECT stage, provider, SUM(cost) as total_cost, SUM(api_calls) as total_calls, COUNT(*) as entry_count FROM cost_entries WHERE edition_id = $1 GROUP BY stage, provider',
      [editionId]
    );

    let searchCost = 0, researchCost = 0, writingCost = 0, subjectLineCost = 0, imageCost = 0;
    let llmCallCount = 0, searchApiCallCount = 0, customSearchCallCount = 0, imageCount = 0;

    for (const row of entries.rows) {
      const cost = parseFloat(row.total_cost);
      const calls = parseInt(row.total_calls);
      if (row.stage === 'article_discovery') { searchCost += cost; searchApiCallCount += calls; }
      else if (row.stage === 'custom_search') { searchCost += cost; customSearchCallCount += calls; }
      else if (row.stage === 'content_researcher') { researchCost += cost; llmCallCount += parseInt(row.entry_count); }
      else if (row.stage.startsWith('story_writer')) { writingCost += cost; llmCallCount += parseInt(row.entry_count); }
      else if (row.stage === 'subject_line_generator') { subjectLineCost += cost; llmCallCount += parseInt(row.entry_count); }
      else if (row.stage === 'image_generation') { imageCost += cost; imageCount += parseInt(row.entry_count); }
    }

    const manualResult = await query('SELECT COUNT(*) as count FROM story_candidates WHERE edition_id = $1 AND is_manual_story = true', [editionId]);
    const manualStoryCount = parseInt(manualResult.rows[0].count);
    const totalCost = searchCost + researchCost + writingCost + subjectLineCost + imageCost;

    return { correlationId, searchCost, researchCost, writingCost, subjectLineCost, imageCost, totalCost, llmCallCount, searchApiCallCount, customSearchCallCount, manualStoryCount, imageCount, isOverBudget: totalCost > config.costBudgetPerEdition };
  }
}
