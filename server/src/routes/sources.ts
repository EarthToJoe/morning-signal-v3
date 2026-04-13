import { Router, Request, Response } from 'express';
import { query } from '../config/database';

const router = Router();

// GET /api/sources/:profileId — list source collections
router.get('/:profileId', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM source_collections WHERE profile_id = $1 ORDER BY collection_type, name', [req.params.profileId]);
    const collections = result.rows.map((r: any) => ({
      id: r.id, profileId: r.profile_id, name: r.name,
      collectionType: r.collection_type, domains: r.domains || [],
    }));
    res.json({ collections });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// POST /api/sources/:profileId — create source collection
router.post('/:profileId', async (req: Request, res: Response) => {
  try {
    const { name, collectionType, domains } = req.body;
    if (!name || !collectionType) return res.status(400).json({ error: 'name and collectionType required' });
    if (!['preferred', 'excluded'].includes(collectionType)) return res.status(400).json({ error: 'collectionType must be preferred or excluded' });
    const domainArray = (domains || []).map((d: string) => d.trim().toLowerCase()).filter(Boolean);
    const result = await query(
      'INSERT INTO source_collections (profile_id, name, collection_type, domains) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.profileId, name, collectionType, domainArray]
    );
    res.json({ collection: { id: result.rows[0].id, profileId: req.params.profileId, name, collectionType, domains: domainArray } });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// DELETE /api/sources/:profileId/:collectionId
router.delete('/:profileId/:collectionId', async (req: Request, res: Response) => {
  try {
    await query('DELETE FROM source_collections WHERE id = $1 AND profile_id = $2', [req.params.collectionId, req.params.profileId]);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export { router as sourcesRouter };
