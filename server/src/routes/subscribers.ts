import { Router, Request, Response } from 'express';
import { SubscriberManagerService } from '../services/subscriber-manager';

const router = Router();
const subscriberManager = new SubscriberManagerService();

// GET /api/profiles/:profileId/subscribers
router.get('/:profileId/subscribers', async (req: Request, res: Response) => {
  try {
    const subscribers = await subscriberManager.getAllSubscribers(req.params.profileId);
    res.json({ subscribers });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// POST /api/profiles/:profileId/subscribers
router.post('/:profileId/subscribers', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const subscriber = await subscriberManager.addSubscriber(email, req.params.profileId);
    res.json({ subscriber });
  } catch (error: any) { res.status(400).json({ error: error.message }); }
});

// DELETE /api/profiles/:profileId/subscribers/:id
router.delete('/:profileId/subscribers/:id', async (req: Request, res: Response) => {
  try {
    await subscriberManager.unsubscribe(req.params.id);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// POST /api/profiles/:profileId/subscribers/import — CSV import
router.post('/:profileId/subscribers/import', async (req: Request, res: Response) => {
  try {
    const { emails } = req.body; // array of email strings
    if (!Array.isArray(emails)) return res.status(400).json({ error: 'emails array required' });
    const results = { added: 0, skipped: 0, errors: [] as string[] };
    for (const email of emails) {
      try {
        await subscriberManager.addSubscriber(email.trim(), req.params.profileId);
        results.added++;
      } catch (err: any) {
        if (err.message.includes('Invalid email')) results.errors.push(email);
        else results.skipped++;
      }
    }
    res.json(results);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export { router as subscribersRouter };
