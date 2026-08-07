import { AI_EVALUATION_SCENARIOS, type AiEvaluationScenario } from './aiEvaluationScenarios';
import { getRelevantToolsForQuery, getQueryIntent } from './aiTools';

export interface AiEvaluationRunResult {
  scenarioId: string;
  passed: boolean;
  intentMatched: boolean;
  toolsMatched: boolean;
  forbiddenToolsAvoided: boolean;
  details: {
    expectedIntent: string;
    actualIntent: string;
    requiredTools: string[];
    forbiddenTools: string[];
    actualTools: string[];
    errors: string[];
  };
}

export interface AiEvaluationSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  results: AiEvaluationRunResult[];
}

export function runOfflineEvaluations(scenarios: readonly AiEvaluationScenario[] = AI_EVALUATION_SCENARIOS): AiEvaluationSummary {
  const results: AiEvaluationRunResult[] = [];

  for (const scenario of scenarios) {
    const actualIntent = getQueryIntent(scenario.query, scenario.attachments);
    const intentMatched = actualIntent === scenario.expectedIntent;
    
    const actualToolsList = getRelevantToolsForQuery(scenario.query, scenario.attachments || []);
    const actualTools = actualToolsList.map(t => t.name);

    const missingTools = scenario.requiredTools.filter(rt => !actualTools.includes(rt));
    const toolsMatched = missingTools.length === 0;

    const matchedForbiddenTools = scenario.forbiddenTools.filter(ft => actualTools.includes(ft));
    const forbiddenToolsAvoided = matchedForbiddenTools.length === 0;

    const passed = intentMatched && toolsMatched && forbiddenToolsAvoided;
    const errors: string[] = [];

    if (!intentMatched) {
      errors.push(`Niyet eşleşmedi. Beklenen: ${scenario.expectedIntent}, Bulunan: ${actualIntent}`);
    }
    if (!toolsMatched) {
      errors.push(`Gerekli araçlar bulunamadı: ${missingTools.join(', ')}`);
    }
    if (!forbiddenToolsAvoided) {
      errors.push(`Yasaklı araçlar seçildi: ${matchedForbiddenTools.join(', ')}`);
    }

    results.push({
      scenarioId: scenario.id,
      passed,
      intentMatched,
      toolsMatched,
      forbiddenToolsAvoided,
      details: {
        expectedIntent: scenario.expectedIntent,
        actualIntent,
        requiredTools: scenario.requiredTools,
        forbiddenTools: scenario.forbiddenTools,
        actualTools,
        errors
      }
    });
  }

  const passedCount = results.filter(r => r.passed).length;
  const total = results.length;

  return {
    total,
    passed: passedCount,
    failed: total - passedCount,
    passRate: total > 0 ? passedCount / total : 0,
    results
  };
}
