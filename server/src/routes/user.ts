import { Router, Request, Response } from 'express';
import { query } from '../config/database';

const router = Router();

// GET /api/user/me — get current user profile
router.get('/me', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM user_profiles WHERE user_id = $1', [req.userId]);
    if (result.rows.length === 0) {
      // Auto-create profile on first access
      const displayName = req.userEmail?.split('@')[0] || 'Anonymous';
      await query('INSERT INTO user_profiles (user_id, display_name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING', [req.userId, displayName]);
      return res.json({ userId: req.userId, email: req.userEmail, displayName, bio: '' });
    }
    const row = result.rows[0];
    res.json({ userId: req.userId, email: req.userEmail, displayName: row.display_name, bio: row.bio });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// PUT /api/user/me — update display name
router.put('/me', async (req: Request, res: Response) => {
  try {
    const { displayName, bio } = req.body;
    await query(
      `INSERT INTO user_profiles (user_id, display_name, bio) VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET display_name = $2, bio = $3, updated_at = NOW()`,
      [req.userId, displayName || 'Anonymous', bio || '']
    );
    // Update denormalized name on all their profiles
    if (displayName) {
      await query('UPDATE newsletter_profiles SET creator_display_name = $1 WHERE user_id = $2', [displayName, req.userId]);
    }
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export { router as userRouter };
