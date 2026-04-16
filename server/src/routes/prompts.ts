import { Router, Request, Response } from 'express';
import { PromptManagerService } from '../services/prompt-manager';

const router = Router();
const promptManager = new PromptManagerService();

// GET /api/prompts — list all prompts
router.get('/', async (_req: Request, res: Response) => {
  try {
    const prompts = await promptManager.getAllPrompts();
    res.json({ prompts });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// GET /api/prompts/:stage — get prompt for a stage
router.get('/:stage', async (req: Request, res: Response) => {
  try {
    const prompt = await promptManager.getActivePrompt(req.params.stage as any);
    res.json(prompt);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// GET /api/prompts/:stage/preview — get the rendered prompt split into editable and locked parts
router.get('/:stage/preview', async (req: Request, res: Response) => {
  try {
    const prompt = await promptManager.getActivePrompt(req.params.stage as any);
    // Split at "OUTPUT FORMAT" — everything after is locked
    const outputFormatMarker = 'OUTPUT FORMAT';
    const idx = prompt.promptText.indexOf(outputFormatMarker);
    let editablePart = prompt.promptText;
    let lockedPart = '';
    if (idx > 0) {
      editablePart = prompt.promptText.substring(0, idx).trimEnd();
      lockedPart = prompt.promptText.substring(idx);
    }
    res.json({ stage: req.params.stage, editablePart, lockedPart, isDefault: prompt.isDefault });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// PUT /api/prompts/:stage — save user override
router.put('/:stage', async (req: Request, res: Response) => {
  try {
    const { promptText } = req.body;
    if (!promptText) return res.status(400).json({ error: 'promptText required' });
    await promptManager.savePrompt(req.params.stage as any, promptText);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// POST /api/prompts/:stage/revert — revert to system default
router.post('/:stage/revert', async (req: Request, res: Response) => {
  try {
    await promptManager.revertToDefault(req.params.stage as any);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

export { router as promptsRouter };
