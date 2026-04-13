import { query } from '../config/database';
import { logger } from '../utils/logger';
import { ManagedPrompt, PipelineStage } from 'shared';

const SYSTEM_DEFAULTS: Record<string, string> = {};
let defaultsLoaded = false;

export class PromptManagerService {
  private async ensureDefaultsLoaded(): Promise<void> {
    if (defaultsLoaded) return;
    const result = await query('SELECT stage, prompt_text FROM saved_prompts WHERE is_system_default = true');
    for (const row of result.rows) SYSTEM_DEFAULTS[row.stage] = row.prompt_text;
    defaultsLoaded = true;
  }

  async getActivePrompt(stage: PipelineStage): Promise<ManagedPrompt> {
    await this.ensureDefaultsLoaded();
    const result = await query('SELECT stage, prompt_text, is_system_default, saved_at FROM saved_prompts WHERE stage = $1', [stage]);
    if (result.rows.length === 0) return { stage, promptText: '', isDefault: true, savedAt: new Date() };
    const row = result.rows[0];
    return { stage: row.stage, promptText: row.prompt_text, isDefault: row.is_system_default, savedAt: new Date(row.saved_at) };
  }

  async savePrompt(stage: PipelineStage, promptText: string): Promise<void> {
    await this.ensureDefaultsLoaded();
    if (!SYSTEM_DEFAULTS[stage]) {
      const current = await query('SELECT prompt_text FROM saved_prompts WHERE stage = $1 AND is_system_default = true', [stage]);
      if (current.rows.length > 0) SYSTEM_DEFAULTS[stage] = current.rows[0].prompt_text;
    }
    await query(
      `INSERT INTO saved_prompts (stage, prompt_text, is_system_default, saved_at) VALUES ($1, $2, false, NOW())
       ON CONFLICT (stage) DO UPDATE SET prompt_text = $2, is_system_default = false, saved_at = NOW()`,
      [stage, promptText]
    );
    logger.info('Prompt saved', { component: 'prompt-manager', stage });
  }

  async revertToDefault(stage: PipelineStage): Promise<void> {
    await this.ensureDefaultsLoaded();
    const defaultText = SYSTEM_DEFAULTS[stage];
    if (!defaultText) { logger.warn('No system default found', { component: 'prompt-manager', stage }); return; }
    await query('UPDATE saved_prompts SET prompt_text = $1, is_system_default = true, saved_at = NOW() WHERE stage = $2', [defaultText, stage]);
    logger.info('Prompt reverted to default', { component: 'prompt-manager', stage });
  }

  async getAllPrompts(): Promise<ManagedPrompt[]> {
    const result = await query('SELECT stage, prompt_text, is_system_default, saved_at FROM saved_prompts ORDER BY stage');
    return result.rows.map((row: any) => ({ stage: row.stage, promptText: row.prompt_text, isDefault: row.is_system_default, savedAt: new Date(row.saved_at) }));
  }
}
