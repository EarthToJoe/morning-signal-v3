import { Router, Request, Response } from 'express';
import { query } from '../config/database';

const router = Router();

// GET /api/public/newsletters — list all newsletters with creator info (no auth required)
router.get('/newsletters', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT np.id, np.name, np.audience, np.creator_display_name, np.created_at,
       (SELECT COUNT(*) FROM editions e WHERE e.profile_id = np.id) as edition_count,
       (SELECT MAX(e.started_at) FROM editions e WHERE e.profile_id = np.id) as last_edition_date,
       (SELECT COUNT(*) FROM subscribers s WHERE s.profile_id = np.id AND s.status = 'active') as subscriber_count
       FROM newsletter_profiles np
       ORDER BY last_edition_date DESC NULLS LAST, np.created_at DESC`
    );
    const newsletters = result.rows.map((r: any) => ({
      id: r.id, name: r.name, audience: r.audience,
      creatorDisplayName: r.creator_display_name || 'Anonymous',
      editionCount: parseInt(r.edition_count),
      subscriberCount: parseInt(r.subscriber_count),
      lastEditionDate: r.last_edition_date, createdAt: r.created_at,
    }));
    res.json({ newsletters });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// POST /api/public/subscribe — subscribe to a newsletter (no auth required)
router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const { email, profileId } = req.body;
    if (!email || !profileId) return res.status(400).json({ error: 'email and profileId required' });
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });

    // Check profile exists
    const profile = await query('SELECT id, name FROM newsletter_profiles WHERE id = $1', [profileId]);
    if (profile.rows.length === 0) return res.status(404).json({ error: 'Newsletter not found' });

    // Upsert subscriber
    const existing = await query('SELECT * FROM subscribers WHERE email = $1 AND profile_id = $2', [email.toLowerCase().trim(), profileId]);
    if (existing.rows.length > 0) {
      if (existing.rows[0].status === 'unsubscribed') {
        await query('UPDATE subscribers SET status = $1, unsubscribed_at = NULL WHERE id = $2', ['active', existing.rows[0].id]);
        return res.json({ success: true, message: 'Re-subscribed' });
      }
      return res.json({ success: true, message: 'Already subscribed' });
    }

    await query('INSERT INTO subscribers (email, status, profile_id) VALUES ($1, $2, $3)', [email.toLowerCase().trim(), 'active', profileId]);
    res.json({ success: true, message: `Subscribed to ${profile.rows[0].name}` });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export { router as publicRouter };
