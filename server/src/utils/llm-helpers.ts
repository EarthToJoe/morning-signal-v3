import { MODEL_PRICING } from 'shared';

export function estimateLlmCost(inputTokens: number, outputTokens: number, model: string): number {
  const p = MODEL_PRICING[model] || MODEL_PRICING['gpt-5.4'] || { input: 1.75, output: 14.00 };
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export function parseLlmJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/```json?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    throw new Error('No valid JSON found in LLM response');
  }
}
