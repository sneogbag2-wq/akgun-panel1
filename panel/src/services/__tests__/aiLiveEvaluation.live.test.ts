import { describe, expect, it } from 'vitest';
import { LIVE_AI_EVALUATION_SCENARIOS, runLiveAiEvaluation } from '../aiLiveEvaluation';

const shouldRun = import.meta.env.VITE_RUN_LIVE_AI_EVAL === 'true';
const scenarioLimit = Number(import.meta.env.VITE_LIVE_AI_EVAL_LIMIT || LIVE_AI_EVALUATION_SCENARIOS.length);
const requestedIds = String(import.meta.env.VITE_LIVE_AI_EVAL_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

describe.runIf(shouldRun)('live Gemini quality evaluation', () => {
  it('passes at least 90% of representative business scenarios', async () => {
    const candidates = requestedIds.length > 0
      ? LIVE_AI_EVALUATION_SCENARIOS.filter((scenario) => requestedIds.includes(scenario.id))
      : LIVE_AI_EVALUATION_SCENARIOS;
    const scenarios = candidates.slice(0, Math.max(1, scenarioLimit));
    const outcomes = await runLiveAiEvaluation(scenarios);
    const failed = outcomes.filter((outcome) => !outcome.passed);
    expect(LIVE_AI_EVALUATION_SCENARIOS).toHaveLength(15);
    expect(outcomes).toHaveLength(scenarios.length);
    expect(failed.map((outcome) => `${outcome.id}: ${outcome.failure} (çağrılar: ${outcome.toolCalls.join(', ') || 'yok'})`).join('\n')).toBe('');
  // The evaluation is intentionally sequential to avoid provider rate limits.
  // Fifteen tool-using scenarios can legitimately take longer than three minutes.
  }, 15 * 120_000);
});
