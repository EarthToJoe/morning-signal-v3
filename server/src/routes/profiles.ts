import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_SECTION_NAMES } from 'shared';

const router = Router();

// Presets
const PRESETS = [
  {
    name: 'The Morning Signal',
    audience: 'Senior government, military, and industry decision-makers in defense, energy, and technology sectors',
    categories: [
      { category: 'defense', displayName: 'Defense & National Security', objective: 'U.S. and allied defense developments including military contracts, weapons programs, Pentagon policy, NATO operations, defense industry news, and military technology.', searchQueries: ['US defense policy', 'Pentagon military', 'NATO defense', 'defense technology contracts'] },
      { category: 'energy', displayName: 'Energy & Infrastructure', objective: 'Energy sector developments including oil & gas markets, renewable energy projects, grid infrastructure, nuclear energy policy, and energy technology.', searchQueries: ['energy policy regulation', 'nuclear energy developments', 'renewable energy infrastructure', 'oil gas geopolitics'] },
      { category: 'technology', displayName: 'Technology & Innovation', objective: 'Technology developments including cybersecurity, AI policy, cloud computing, semiconductor supply chain, space technology, and federal IT modernization.', searchQueries: ['AI artificial intelligence policy', 'cybersecurity threats', 'semiconductor chip industry', 'space technology defense'] },
      { category: 'policy', displayName: 'Policy & Geopolitics', objective: 'U.S. government policy affecting defense, energy, and technology sectors including executive orders, legislation, regulatory actions, and budget decisions.', searchQueries: ['US foreign policy', 'congressional defense legislation', 'geopolitical tensions', 'trade policy national security'] },
    ],
  },
  {
    name: 'Tech Pulse',
    audience: 'Technology executives, startup founders, and engineers tracking AI, cybersecurity, and cloud trends',
    categories: [
      { category: 'ai_ml', displayName: 'AI & Machine Learning', objective: 'Artificial intelligence and machine learning developments including new model releases, AI regulation, enterprise AI adoption, and research breakthroughs.', searchQueries: ['artificial intelligence news', 'machine learning breakthroughs', 'AI regulation policy'] },
      { category: 'cybersecurity', displayName: 'Cybersecurity', objective: 'Cybersecurity incidents, vulnerabilities, threat intelligence, and security industry news.', searchQueries: ['cybersecurity breach incident', 'vulnerability disclosure', 'ransomware attack'] },
      { category: 'cloud', displayName: 'Cloud & Infrastructure', objective: 'Cloud computing, data center, and infrastructure developments.', searchQueries: ['cloud computing AWS Azure Google', 'data center infrastructure', 'enterprise cloud migration'] },
      { category: 'startups', displayName: 'Startups & Funding', objective: 'Startup funding rounds, acquisitions, IPOs, and venture capital trends.', searchQueries: ['startup funding round', 'tech acquisition', 'venture capital investment'] },
    ],
  },
  {
    name: 'Energy Watch',
    audience: 'Energy industry professionals, policy makers, and investors tracking markets and regulation',
    categories: [
      { category: 'oil_gas', displayName: 'Oil & Gas', objective: 'Oil and gas market developments, production changes, OPEC decisions, and pipeline projects.', searchQueries: ['oil price OPEC production', 'natural gas pipeline', 'petroleum industry news'] },
      { category: 'renewables', displayName: 'Renewables & Clean Energy', objective: 'Solar, wind, and clean energy project developments, installations, and policy incentives.', searchQueries: ['solar wind renewable energy', 'clean energy project', 'renewable energy policy incentive'] },
      { category: 'grid', displayName: 'Grid & Infrastructure', objective: 'Electric grid modernization, transmission projects, energy storage, and utility developments.', searchQueries: ['electric grid modernization', 'energy storage battery', 'utility infrastructure investment'] },
      { category: 'nuclear', displayName: 'Nuclear Energy', objective: 'Nuclear energy developments including new reactor projects, SMR technology, and nuclear policy.', searchQueries: ['nuclear energy reactor', 'small modular reactor SMR', 'nuclear policy regulation'] },
    ],
  },
  {
    name: 'NR Insider',
    audience: 'Naval Reactors (NAVSEA 08) employees, engineers, and program staff — people working across NR headquarters, Bettis and KNOLLS labs, shipyards (Newport News, Electric Boat, Puget Sound, Pearl Harbor, Norfolk), and prototype sites (NPTU Charleston, NPTU Ballston Spa) who want to stay current on nuclear Navy developments, defense policy affecting the program, and the broader nuclear energy landscape',
    sectionNames: { lead: 'Flagship Report', briefing: 'Reactor Briefs', watch: 'On the Horizon' },
    categories: [
      { category: 'nuclear_navy', displayName: 'Nuclear Navy & Submarine Force', objective: 'U.S. Navy nuclear-powered submarine and aircraft carrier news including Columbia-class and Virginia-class submarine programs, CVN-78 Ford-class carriers, submarine fleet readiness, AUKUS submarine deal, naval nuclear propulsion milestones, and Navy shipbuilding budget.', searchQueries: ['Navy submarine program', 'Columbia class submarine', 'Virginia class submarine', 'nuclear aircraft carrier Navy'] },
      { category: 'shipbuilding', displayName: 'Shipyards & Industrial Base', objective: 'Naval shipbuilding industry news including Huntington Ingalls Newport News Shipbuilding, General Dynamics Electric Boat, Puget Sound Naval Shipyard, submarine maintenance backlogs, shipyard workforce challenges, and defense industrial base investments.', searchQueries: ['naval shipbuilding industry', 'Huntington Ingalls Newport News', 'Electric Boat submarine', 'shipyard workforce defense'] },
      { category: 'nuclear_tech', displayName: 'Nuclear Technology & Energy', objective: 'Nuclear energy and technology developments relevant to naval reactors professionals — advanced reactor designs, small modular reactors (SMR), nuclear fuel developments, DOE nuclear programs, Bettis and KNOLLS lab research, nuclear safety and regulation, and commercial nuclear power trends.', searchQueries: ['nuclear reactor technology', 'small modular reactor SMR', 'DOE nuclear energy program', 'nuclear fuel technology'] },
      { category: 'defense_policy', displayName: 'Defense Policy & Budget', objective: 'Defense policy and budget decisions affecting Naval Reactors and the nuclear Navy — NDAA provisions, Navy budget requests, NAVSEA policy changes, Pentagon acquisition reform, defense workforce policy, and congressional oversight of Navy programs.', searchQueries: ['Navy budget defense spending', 'NDAA naval provisions', 'Pentagon acquisition policy', 'defense workforce policy'] },
    ],
  },
];

router.get('/presets', (_req: Request, res: Response) => { res.json({ presets: PRESETS }); });

// POST /api/profiles/auto-fill — AI fills in missing newsletter setup fields
router.post('/auto-fill', async (req: Request, res: Response) => {
  try {
    const { name, audience, categories, sectionNames } = req.body;
    const filledCategories = (categories || []).filter((c: any) => c.displayName?.trim());
    const emptySlots = Math.max(4, (categories || []).length) - filledCategories.length;

    const context = [
      name ? `Newsletter name: "${name}"` : '',
      audience ? `Audience: "${audience}"` : '',
      filledCategories.length > 0 ? `Existing categories: ${filledCategories.map((c: any) => `"${c.displayName}"${c.objective ? ` (${c.objective})` : ''}`).join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: (await import('../config')).config.openaiApiKey });

    const prompt = `You are helping someone set up an AI-powered newsletter. Based on what they've provided so far, fill in the missing fields.

${context || 'The user has not provided anything yet. Suggest a general news newsletter.'}

Generate the following as JSON:
${!audience ? '- "audience": a 1-2 sentence description of who reads this newsletter' : ''}
${emptySlots > 0 ? `- "newCategories": an array of ${emptySlots} NEW category objects (don't repeat existing ones), each with:
  - "displayName": short category name (2-4 words)
  - "objective": 1-2 sentence description of what to search for in this category
  - "searchQueries": array of 3-4 search query strings` : ''}
${!sectionNames || (!sectionNames.lead || sectionNames.lead === 'Lead Story') ? '- "sectionNames": { "lead": "custom lead section name", "briefing": "custom briefing section name", "watch": "custom watch section name" } themed to match the newsletter' : ''}

OUTPUT FORMAT (strict JSON):
{
  ${!audience ? '"audience": "string",' : ''}
  "newCategories": [{ "displayName": "string", "objective": "string", "searchQueries": ["string"] }],
  "sectionNames": { "lead": "string", "briefing": "string", "watch": "string" }
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-5.4',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_completion_tokens: 1200,
    });

    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const rawContent = response.choices[0]?.message?.content || '{}';
    
    // Defensive JSON parsing — handle truncated responses
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      // Try to fix truncated JSON by closing open structures
      let fixed = rawContent;
      if (!fixed.endsWith('}')) {
        // Find last complete object/array and close it
        const lastBrace = fixed.lastIndexOf('}');
        const lastBracket = fixed.lastIndexOf(']');
        if (lastBracket > lastBrace) fixed = fixed.substring(0, lastBracket + 1) + '}';
        else if (lastBrace > 0) fixed = fixed.substring(0, lastBrace + 1);
        // Try to close any open arrays/objects
        const openBrackets = (fixed.match(/\[/g) || []).length - (fixed.match(/\]/g) || []).length;
        const openBraces = (fixed.match(/\{/g) || []).length - (fixed.match(/\}/g) || []).length;
        for (let i = 0; i < openBrackets; i++) fixed += ']';
        for (let i = 0; i < openBraces; i++) fixed += '}';
      }
      try { parsed = JSON.parse(fixed); } catch { parsed = {}; }
    }

    res.json({ ...parsed, cost: { inputTokens, outputTokens, estimatedCost: (inputTokens * 0.00001 + outputTokens * 0.00003).toFixed(4) } });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// GET /api/profiles — list user's profiles
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const result = await query(
      `SELECT np.*, (SELECT COUNT(*) FROM editions e WHERE e.profile_id = np.id) as edition_count,
       (SELECT MAX(e.started_at) FROM editions e WHERE e.profile_id = np.id) as last_edition_date
       FROM newsletter_profiles np WHERE np.user_id = $1 ORDER BY np.created_at DESC`,
      [userId]
    );
    const profiles = result.rows.map((r: any) => ({
      id: r.id, name: r.name, audience: r.audience, isPreset: r.is_preset,
      sectionNames: r.section_names || DEFAULT_SECTION_NAMES,
      creatorDisplayName: r.creator_display_name || 'Anonymous',
      editionCount: parseInt(r.edition_count), lastEditionDate: r.last_edition_date,
      createdAt: r.created_at,
    }));
    res.json({ profiles });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// POST /api/profiles — create profile
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { name, audience, categories, sectionNames, themeSettings } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!categories || categories.length === 0) return res.status(400).json({ error: 'At least one category required' });

    // Get creator display name
    const userProfile = await query('SELECT display_name FROM user_profiles WHERE user_id = $1', [userId]);
    const creatorName = userProfile.rows[0]?.display_name || req.userEmail?.split('@')[0] || 'Anonymous';

    const profileResult = await query(
      `INSERT INTO newsletter_profiles (user_id, name, audience, section_names, theme_settings, is_preset, creator_display_name)
       VALUES ($1, $2, $3, $4, $5, false, $6) RETURNING id`,
      [userId, name, audience || '', JSON.stringify(sectionNames || DEFAULT_SECTION_NAMES), JSON.stringify(themeSettings || {}), creatorName]
    );
    const profileId = profileResult.rows[0].id;

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      await query(
        `INSERT INTO topic_config (category, display_name, search_queries, objective, preferred_sources, priority, is_active, profile_id)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, true, $7)`,
        [cat.category || cat.displayName?.toLowerCase().replace(/[^a-z0-9]+/g, '_'), cat.displayName, JSON.stringify(cat.searchQueries || []), cat.objective || '', cat.preferredSources || '', i + 1, profileId]
      );
    }
    res.json({ id: profileId, name, audience });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// GET /api/profiles/:id — get profile with categories
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM newsletter_profiles WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    const p = result.rows[0];
    const cats = await query('SELECT * FROM topic_config WHERE profile_id = $1 ORDER BY priority', [req.params.id]);
    const categories = cats.rows.map((r: any) => ({
      id: r.id, category: r.category, displayName: r.display_name, searchQueries: r.search_queries,
      objective: r.objective, preferredSources: r.preferred_sources, priority: r.priority, isActive: r.is_active,
    }));
    res.json({
      id: p.id, name: p.name, audience: p.audience, isPreset: p.is_preset,
      sectionNames: p.section_names || DEFAULT_SECTION_NAMES,
      themeSettings: p.theme_settings || {}, categories, createdAt: p.created_at,
    });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// PUT /api/profiles/:id — update profile
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { name, audience, categories, sectionNames, themeSettings } = req.body;
    const existing = await query('SELECT * FROM newsletter_profiles WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });

    await query(
      `UPDATE newsletter_profiles SET name = $1, audience = $2, section_names = $3, theme_settings = $4 WHERE id = $5 AND user_id = $6`,
      [name || existing.rows[0].name, audience ?? existing.rows[0].audience, JSON.stringify(sectionNames || existing.rows[0].section_names), JSON.stringify(themeSettings || existing.rows[0].theme_settings), req.params.id, userId]
    );

    if (categories && categories.length > 0) {
      await query('DELETE FROM topic_config WHERE profile_id = $1', [req.params.id]);
      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        await query(
          `INSERT INTO topic_config (category, display_name, search_queries, objective, preferred_sources, priority, is_active, profile_id)
           VALUES ($1, $2, $3::jsonb, $4, $5, $6, true, $7)`,
          [cat.category || cat.displayName?.toLowerCase().replace(/[^a-z0-9]+/g, '_'), cat.displayName, JSON.stringify(cat.searchQueries || []), cat.objective || '', cat.preferredSources || '', i + 1, req.params.id]
        );
      }
    }
    res.json({ success: true, id: req.params.id });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// DELETE /api/profiles/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM newsletter_profiles WHERE id = $1 AND user_id = $2 AND is_preset = false', [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export { router as profilesRouter };
