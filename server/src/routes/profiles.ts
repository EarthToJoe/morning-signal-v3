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
    name: 'Bloomberg Prep Brief',
    audience: 'Someone preparing for a Contracts Coordinator role at Bloomberg — needs to understand Bloomberg Terminal licensing, enterprise data services, financial industry contract management, and current market/business news',
    categories: [
      { category: 'bloomberg', displayName: 'Bloomberg & Terminal News', objective: 'Bloomberg LP company news, Bloomberg Terminal product updates, new Bloomberg data services, Bloomberg enterprise licensing changes, and Bloomberg business developments.', searchQueries: ['Bloomberg Terminal news', 'Bloomberg LP updates', 'Bloomberg data services'] },
      { category: 'licensing', displayName: 'Financial Data & Enterprise Licensing', objective: 'Enterprise software licensing trends, financial data vendor contracts, SaaS contract management, data terminal market competition (Bloomberg vs Refinitiv vs FactSet), and enterprise procurement in financial services.', searchQueries: ['financial data licensing', 'Bloomberg vs Refinitiv FactSet', 'enterprise software contracts financial services'] },
      { category: 'contracts', displayName: 'Contract Management & Operations', objective: 'Contract lifecycle management best practices, contract coordination workflows, legal operations in financial services, compliance in contract processing, and digital contract signing trends.', searchQueries: ['contract lifecycle management', 'legal operations financial services', 'digital contract signing'] },
      { category: 'markets', displayName: 'Markets & Business News', objective: 'Major financial market developments, Wall Street business news, banking industry updates, and economic policy changes that affect financial services companies.', searchQueries: ['financial markets news', 'Wall Street business', 'banking industry updates'] },
    ],
  },
];

router.get('/presets', (_req: Request, res: Response) => { res.json({ presets: PRESETS }); });

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

    const profileResult = await query(
      `INSERT INTO newsletter_profiles (user_id, name, audience, section_names, theme_settings, is_preset)
       VALUES ($1, $2, $3, $4, $5, false) RETURNING id`,
      [userId, name, audience || '', JSON.stringify(sectionNames || DEFAULT_SECTION_NAMES), JSON.stringify(themeSettings || {})]
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

// DELETE /api/profiles/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM newsletter_profiles WHERE id = $1 AND user_id = $2 AND is_preset = false', [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export { router as profilesRouter };
