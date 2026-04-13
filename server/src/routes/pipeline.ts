import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { PipelineOrchestrator } from '../pipeline/orchestrator';

const router = Router();

// POST /api/pipeline/start
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { profileId, daysBack, editionNumberOverride, promptOverride } = req.body || {};
    if (!profileId) return res.status(400).json({ error: 'profileId is required' });
    const orchestrator = new PipelineOrchestrator();
    const status = await orchestrator.startPipeline(profileId, req.userId!, undefined, promptOverride, daysBack, editionNumberOverride);
    res.json(status);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// GET /api/pipeline/:correlationId/status
router.get('/:correlationId/status', async (req: Request, res: Response) => {
  try {
    const orchestrator = new PipelineOrchestrator();
    const status = await orchestrator.getStatus(req.params.correlationId);
    res.json(status);
  } catch (error: any) { res.status(404).json({ error: error.message }); }
});

// POST /api/pipeline/quick-create — run full pipeline end-to-end with auto-selection
router.post('/quick-create', async (req: Request, res: Response) => {
  try {
    const { profileId, daysBack } = req.body || {};
    if (!profileId) return res.status(400).json({ error: 'profileId is required' });
    const orchestrator = new PipelineOrchestrator();

    // Phase 1: discovery + clustering
    const phase1 = await orchestrator.startPipeline(profileId, req.userId!, undefined, null, daysBack);
    if (phase1.status === 'failed') return res.status(500).json({ error: 'Discovery failed', details: phase1 });

    // Auto-select based on AI suggestions
    const selections = await autoSelectAndWrite(phase1.correlationId);

    // Phase 2: writing + assembly
    const phase2 = await orchestrator.continueAfterSelection(phase1.correlationId, selections);

    res.json({ correlationId: phase1.correlationId, status: phase2 });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// POST /api/pipeline/:correlationId/select — submit story selections
router.post('/:correlationId/select', async (req: Request, res: Response) => {
  try {
    const { selections, promptOverrides } = req.body;
    if (!selections) return res.status(400).json({ error: 'selections required' });
    const orchestrator = new PipelineOrchestrator();
    const status = await orchestrator.continueAfterSelection(req.params.correlationId, selections, promptOverrides);
    res.json(status);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export { router as pipelineRouter };

// Quick create helper — used by the quick-create endpoint
async function autoSelectAndWrite(correlationId: string) {
  const { query: dbQuery } = await import('../config/database');
  const editionResult = await dbQuery('SELECT id FROM editions WHERE correlation_id = $1', [correlationId]);
  if (editionResult.rows.length === 0) throw new Error('Edition not found');
  const editionId = editionResult.rows[0].id;

  const candidatesResult = await dbQuery(
    `SELECT sc.*, json_agg(json_build_object(
      'id', a.id, 'url', a.url, 'title', a.title, 'snippet', a.snippet,
      'source', a.source, 'category', a.category, 'rankPosition', a.rank_position
    )) FILTER (WHERE a.id IS NOT NULL) as source_articles
    FROM story_candidates sc
    LEFT JOIN story_candidate_articles sca ON sc.id = sca.story_candidate_id
    LEFT JOIN articles a ON sca.article_id = a.id
    WHERE sc.edition_id = $1
    GROUP BY sc.id ORDER BY sc.created_at`, [editionId]
  );

  const candidates = candidatesResult.rows.map((row: any) => ({
    id: row.id, suggestedRole: row.suggested_role, headline: row.headline,
    narrativeSummary: row.narrative_summary,
    sourceArticleIds: (row.source_articles || []).filter((a: any) => a.id).map((a: any) => a.id),
    sourceArticles: (row.source_articles || []).filter((a: any) => a.id),
    category: row.category, isManualStory: row.is_manual_story,
  }));

  if (candidates.length === 0) throw new Error('No candidates generated');

  const lead = candidates.find((c: any) => c.suggestedRole === 'lead_story') || candidates[0];
  const quickHits = candidates.filter((c: any) => c.suggestedRole === 'quick_hit').slice(0, 5);
  const watchList = candidates.filter((c: any) => c.suggestedRole === 'watch_list').slice(0, 3);
  // If not enough quick hits, pull from remaining
  if (quickHits.length === 0) {
    const remaining = candidates.filter(c => c.id !== lead.id);
    quickHits.push(...remaining.slice(0, 4));
  }

  return { leadStory: lead, quickHits, watchListItems: watchList };
}
