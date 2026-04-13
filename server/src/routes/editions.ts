import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { CostTrackerService } from '../services/cost-tracker';
import { UrlFetcherService } from '../services/url-fetcher';
import { StoryWriterService } from '../services/story-writer';
import { PromptManagerService } from '../services/prompt-manager';
import { NewsletterAssemblerService } from '../services/newsletter-assembler';
import { config } from '../config';
import { DEFAULT_SECTION_NAMES } from 'shared';

const router = Router();
const costTracker = new CostTrackerService();
const promptManager = new PromptManagerService();
const storyWriter = new StoryWriterService(promptManager, costTracker);
const urlFetcher = new UrlFetcherService();
const assembler = new NewsletterAssemblerService();

async function getEditionId(correlationId: string): Promise<string> {
  const r = await query('SELECT id FROM editions WHERE correlation_id = $1', [correlationId]);
  if (r.rows.length === 0) throw new Error('Edition not found');
  return r.rows[0].id;
}

async function loadCandidates(editionId: string) {
  const rows = await query(
    `SELECT sc.*, COALESCE(json_agg(json_build_object(
      'id', a.id, 'url', a.url, 'title', a.title, 'snippet', a.snippet,
      'source', a.source, 'category', a.category, 'rankPosition', a.rank_position
    )) FILTER (WHERE a.id IS NOT NULL), '[]') as source_articles
    FROM story_candidates sc
    LEFT JOIN story_candidate_articles sca ON sc.id = sca.story_candidate_id
    LEFT JOIN articles a ON sca.article_id = a.id
    WHERE sc.edition_id = $1
    GROUP BY sc.id ORDER BY sc.display_order NULLS LAST, sc.created_at`, [editionId]
  );
  return rows.rows.map((r: any) => ({
    id: r.id, suggestedRole: r.suggested_role, assignedRole: r.assigned_role,
    headline: r.headline, narrativeSummary: r.narrative_summary, category: r.category,
    isManualStory: r.is_manual_story, isSelected: r.is_selected, displayOrder: r.display_order,
    sourceArticles: r.source_articles, sourceArticleCount: r.source_articles.filter((a: any) => a.id).length,
  }));
}

// GET /api/editions/:correlationId/candidates
router.get('/:correlationId/candidates', async (req: Request, res: Response) => {
  try {
    const editionId = await getEditionId(req.params.correlationId);
    const candidates = await loadCandidates(editionId);
    res.json({ candidates });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// GET /api/editions/:correlationId/sections
router.get('/:correlationId/sections', async (req: Request, res: Response) => {
  try {
    const editionId = await getEditionId(req.params.correlationId);
    const result = await query(
      'SELECT id, story_candidate_id, role, headline, html_content, plain_text_content, word_count, source_links, image_url FROM written_sections WHERE edition_id = $1 ORDER BY role, id', [editionId]
    );
    const sections = result.rows.map((r: any) => ({
      id: r.id, storyCandidateId: r.story_candidate_id, role: r.role,
      headline: r.headline, htmlContent: r.html_content, plainTextContent: r.plain_text_content,
      wordCount: r.word_count, sourceLinks: r.source_links || [], imageUrl: r.image_url,
    }));
    res.json({ sections });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// GET /api/editions/:correlationId/newsletter
router.get('/:correlationId/newsletter', async (req: Request, res: Response) => {
  try {
    const editionId = await getEditionId(req.params.correlationId);
    const result = await query('SELECT * FROM assembled_newsletters WHERE edition_id = $1', [editionId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Newsletter not yet assembled' });
    const row = result.rows[0];
    const costSummary = await costTracker.getEditionSummary(req.params.correlationId);
    res.json({
      html: row.html_content, plainText: row.plain_text_content,
      selectedSubjectLine: row.selected_subject_line, subjectLineOptions: row.subject_line_options,
      sectionMetadata: row.section_metadata, costSummary,
    });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// PUT /api/editions/:correlationId/sections/:sectionId — inline edit
router.put('/:correlationId/sections/:sectionId', async (req: Request, res: Response) => {
  try {
    const { headline, htmlContent, plainTextContent } = req.body;
    await query(
      `UPDATE written_sections SET headline = COALESCE($1, headline), html_content = COALESCE($2, html_content),
       plain_text_content = COALESCE($3, plain_text_content), written_at = NOW() WHERE id = $4`,
      [headline || null, htmlContent || null, plainTextContent || null, req.params.sectionId]
    );
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// POST /api/editions/:correlationId/manual-story
router.post('/:correlationId/manual-story', async (req: Request, res: Response) => {
  try {
    const { url, description } = req.body;
    if (!url && !description) return res.status(400).json({ error: 'url or description required' });
    const editionId = await getEditionId(req.params.correlationId);
    const candidateId = uuidv4();

    if (url) {
      const metadata = await urlFetcher.fetchMetadata(url, req.params.correlationId);
      const articleId = uuidv4();
      const publishedAt = metadata.publishedAt ? metadata.publishedAt.toISOString() : null;
      await query(
        `INSERT INTO articles (id, edition_id, url, title, snippet, source, published_at, rank_position, category, discovered_via)
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp, 0, 'general', 'manual_url')`,
        [articleId, editionId, url, metadata.title || url, metadata.snippet || '', metadata.source || '', publishedAt]
      );
      await query(
        `INSERT INTO story_candidates (id, edition_id, suggested_role, headline, narrative_summary, category, is_manual_story, manual_story_attribution)
         VALUES ($1, $2, 'quick_hit', $3, $4, 'general', true, 'editor-sourced')`,
        [candidateId, editionId, metadata.title || 'Manual Story', metadata.snippet || '']
      );
      await query('INSERT INTO story_candidate_articles (story_candidate_id, article_id) VALUES ($1, $2)', [candidateId, articleId]);
    } else {
      await query(
        `INSERT INTO story_candidates (id, edition_id, suggested_role, headline, narrative_summary, category, is_manual_story, manual_story_attribution)
         VALUES ($1, $2, 'quick_hit', $3, $4, 'general', true, 'editor-sourced')`,
        [candidateId, editionId, description, description]
      );
    }

    const candidates = await loadCandidates(editionId);
    res.json({ candidates, addedCandidateId: candidateId });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// POST /api/editions/:correlationId/reassemble — re-assemble with theme
router.post('/:correlationId/reassemble', async (req: Request, res: Response) => {
  try {
    const { theme, sectionNames, footerText } = req.body;
    const editionId = await getEditionId(req.params.correlationId);

    const sectionsResult = await query('SELECT * FROM written_sections WHERE edition_id = $1 ORDER BY role, id', [editionId]);
    const sections = sectionsResult.rows;
    const leadSection = sections.find((s: any) => s.role === 'lead_story');
    if (!leadSection) return res.status(400).json({ error: 'No lead story found' });

    const writtenNewsletter = {
      leadStory: { role: 'lead_story' as const, storyCandidateId: leadSection.story_candidate_id, headline: leadSection.headline, htmlContent: leadSection.html_content, plainTextContent: leadSection.plain_text_content, wordCount: leadSection.word_count, sourceLinks: leadSection.source_links || [] },
      quickHits: sections.filter((s: any) => s.role === 'quick_hit').map((s: any) => ({ role: 'quick_hit' as const, storyCandidateId: s.story_candidate_id, headline: s.headline, htmlContent: s.html_content, plainTextContent: s.plain_text_content, wordCount: s.word_count, sourceLinks: s.source_links || [] })),
      watchList: sections.filter((s: any) => s.role === 'watch_list').map((s: any) => ({ role: 'watch_list' as const, storyCandidateId: s.story_candidate_id, headline: s.headline, htmlContent: s.html_content, plainTextContent: s.plain_text_content, wordCount: s.word_count, sourceLinks: s.source_links || [] })),
      totalWordCount: 0, tokenUsage: { input: 0, output: 0 }, cost: 0,
    };

    const edition = await query(
      `SELECT e.edition_number, e.edition_date, np.name as profile_name FROM editions e LEFT JOIN newsletter_profiles np ON e.profile_id = np.id WHERE e.correlation_id = $1`,
      [req.params.correlationId]
    );
    const subjectResult = await query('SELECT selected_subject_line FROM assembled_newsletters WHERE edition_id = $1', [editionId]);
    const subjectLine = subjectResult.rows[0]?.selected_subject_line || config.defaultNewsletterName;

    // Build story images map from written_sections
    const storyImages: Record<string, string> = {};
    for (const s of sections) {
      if (s.image_url && s.story_candidate_id) {
        storyImages[s.story_candidate_id] = s.image_url;
      }
    }

    const assembled = await assembler.assemble(
      writtenNewsletter, subjectLine, edition.rows[0].edition_number, edition.rows[0].edition_date,
      req.params.correlationId, theme, edition.rows[0]?.profile_name, sectionNames, undefined, storyImages, footerText
    );

    await query('UPDATE assembled_newsletters SET html_content = $1, plain_text_content = $2, section_metadata = $3 WHERE edition_id = $4',
      [assembled.html, assembled.plainText, JSON.stringify(assembled.sectionMetadata), editionId]);

    res.json({ html: assembled.html, plainText: assembled.plainText, sectionMetadata: assembled.sectionMetadata });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// POST /api/editions/:correlationId/fetch-images — Fetch og:images for story candidates from their source articles
router.post('/:correlationId/fetch-images', async (req: Request, res: Response) => {
  try {
    const editionId = await getEditionId(req.params.correlationId);
    const sectionsResult = await query(
      `SELECT ws.id, ws.story_candidate_id, ws.image_url,
       (SELECT a.url FROM story_candidate_articles sca JOIN articles a ON sca.article_id = a.id WHERE sca.story_candidate_id = ws.story_candidate_id LIMIT 1) as source_url
       FROM written_sections ws WHERE ws.edition_id = $1 AND (ws.image_url IS NULL OR ws.image_url = '')`, [editionId]
    );

    const results: { sectionId: string; imageUrl: string | null }[] = [];
    for (const row of sectionsResult.rows) {
      if (!row.source_url) { results.push({ sectionId: row.id, imageUrl: null }); continue; }
      const imageUrl = await urlFetcher.fetchImage(row.source_url);
      if (imageUrl) {
        await query('UPDATE written_sections SET image_url = $1 WHERE id = $2', [imageUrl, row.id]);
      }
      results.push({ sectionId: row.id, imageUrl });
    }

    res.json({ results, fetched: results.filter(r => r.imageUrl).length, total: results.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// POST /api/editions/:correlationId/write-story — Quick-write a single story from a candidate
router.post('/:correlationId/write-story', async (req: Request, res: Response) => {
  try {
    const { candidateId, role } = req.body;
    if (!candidateId) return res.status(400).json({ error: 'candidateId required' });
    const editionId = await getEditionId(req.params.correlationId);

    // Load the candidate with its source articles
    const candResult = await query(
      `SELECT sc.*, COALESCE(json_agg(json_build_object(
        'id', a.id, 'url', a.url, 'title', a.title, 'snippet', a.snippet,
        'source', a.source, 'publishedAt', a.published_at, 'category', a.category, 'rankPosition', a.rank_position
      )) FILTER (WHERE a.id IS NOT NULL), '[]') as source_articles
      FROM story_candidates sc
      LEFT JOIN story_candidate_articles sca ON sc.id = sca.story_candidate_id
      LEFT JOIN articles a ON sca.article_id = a.id
      WHERE sc.id = $1 GROUP BY sc.id`, [candidateId]
    );
    if (candResult.rows.length === 0) return res.status(404).json({ error: 'Candidate not found' });
    const row = candResult.rows[0];
    const candidate = {
      id: row.id, suggestedRole: role || row.suggested_role, headline: row.headline,
      narrativeSummary: row.narrative_summary,
      sourceArticleIds: (row.source_articles || []).filter((a: any) => a.id).map((a: any) => a.id),
      sourceArticles: (row.source_articles || []).filter((a: any) => a.id),
      category: row.category, isManualStory: row.is_manual_story,
    };

    // Write the story based on role
    const actualRole = role || candidate.suggestedRole || 'quick_hit';
    let section;
    if (actualRole === 'lead_story') {
      section = await storyWriter.writeLeadStory(candidate as any, null, req.params.correlationId);
    } else {
      const results = await storyWriter.writeQuickHits([candidate as any], null, req.params.correlationId);
      section = results[0];
    }

    if (section) {
      // Save to DB
      await query(
        `INSERT INTO written_sections (edition_id, story_candidate_id, role, headline, html_content, plain_text_content, word_count, source_links)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [editionId, candidateId, section.role, section.headline, section.htmlContent, section.plainTextContent, section.wordCount, JSON.stringify(section.sourceLinks)]
      );
    }

    res.json({ section });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// POST /api/editions/:correlationId/enrich-candidate — Search for sources and generate headline/summary for a bare candidate
router.post('/:correlationId/enrich-candidate', async (req: Request, res: Response) => {
  try {
    const { candidateId } = req.body;
    if (!candidateId) return res.status(400).json({ error: 'candidateId required' });
    const editionId = await getEditionId(req.params.correlationId);

    // Load the candidate
    const candResult = await query('SELECT * FROM story_candidates WHERE id = $1', [candidateId]);
    if (candResult.rows.length === 0) return res.status(404).json({ error: 'Candidate not found' });
    const cand = candResult.rows[0];
    const topicText = cand.headline || cand.narrative_summary || '';

    // Search Parallel AI for articles about this topic
    const { ParallelAiClient } = await import('../services/article-discovery');
    const searchClient = new ParallelAiClient(config.parallelAiApiKey);
    const results = await searchClient.search({
      objective: `Find specific, individual news articles about: ${topicText}. Return individual stories with unique URLs — NOT website homepages or landing pages.`,
      searchQueries: [topicText],
      maxResults: 5,
      afterDate: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
      excludeDomains: ['linkedin.com', 'facebook.com', 'twitter.com', 'youtube.com'],
    });

    // Save found articles and link to candidate
    const articleIds: string[] = [];
    for (const raw of results) {
      if (!raw.url || !raw.title) continue;
      const articleId = uuidv4();
      await query(
        `INSERT INTO articles (id, edition_id, url, title, snippet, source, published_at, rank_position, category, discovered_via)
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp, $8, 'general', 'custom_search')`,
        [articleId, editionId, raw.url, raw.title, raw.snippet || '', raw.source || '', raw.publishedDate || null, raw.rankPosition]
      );
      await query('INSERT INTO story_candidate_articles (story_candidate_id, article_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [candidateId, articleId]);
      articleIds.push(articleId);
    }

    // Generate a headline and summary from the found articles using GPT
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: config.openaiApiKey });
    const articleContext = results.slice(0, 5).map((r, i) => `[${i}] "${r.title}" — ${r.source}\n  ${r.snippet?.substring(0, 300)}`).join('\n\n');

    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-5.4',
      messages: [{ role: 'user', content: `Based on these articles about "${topicText}", generate a compelling headline and a 2-3 sentence narrative summary.\n\nARTICLES:\n${articleContext}\n\nOUTPUT FORMAT (strict JSON):\n{"headline": "string", "narrativeSummary": "string"}` }],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_completion_tokens: 200,
    });

    const parsed = JSON.parse(gptResponse.choices[0]?.message?.content || '{}');
    const newHeadline = parsed.headline || topicText;
    const newSummary = parsed.narrativeSummary || '';

    // Update the candidate
    await query('UPDATE story_candidates SET headline = $1, narrative_summary = $2 WHERE id = $3', [newHeadline, newSummary, candidateId]);

    // Reload candidates
    const candidates = await loadCandidates(editionId);
    res.json({ candidates, enrichedCandidateId: candidateId, articlesFound: articleIds.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// GET /api/editions/:correlationId/cost
router.get('/:correlationId/cost', async (req: Request, res: Response) => {
  try {
    const summary = await costTracker.getEditionSummary(req.params.correlationId);
    res.json(summary);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// GET /api/profiles/:profileId/editions — list editions for a profile
router.get('/profile/:profileId/list', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT e.correlation_id, e.status, e.edition_number, e.edition_date, e.started_at, e.total_cost,
       (SELECT sc.headline FROM story_candidates sc WHERE sc.edition_id = e.id AND sc.suggested_role = 'lead_story' LIMIT 1) as lead_headline
       FROM editions e WHERE e.profile_id = $1 AND e.user_id = $2 ORDER BY e.started_at DESC LIMIT 50`,
      [req.params.profileId, req.userId]
    );
    res.json({ editions: result.rows });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export { router as editionsRouter };
