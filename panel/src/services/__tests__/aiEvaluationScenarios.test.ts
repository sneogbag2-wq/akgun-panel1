import { describe, expect, it } from 'vitest';
import { calculateCEI } from '../../calculations/cariCalculations';
import { buildAiAnalysisResult, getQueryIntent, getRelevantToolsForQuery } from '../aiTools';
import { AI_EVALUATION_SCENARIOS } from '../aiEvaluationScenarios';

describe('AI evaluation and regression set', () => {
  it('contains at least 30 business scenarios with expected routing metadata', () => {
    expect(AI_EVALUATION_SCENARIOS.length).toBeGreaterThanOrEqual(30);
    for (const scenario of AI_EVALUATION_SCENARIOS) {
      expect(scenario.requiredTools.length).toBeGreaterThan(0);
      expect(new Set(scenario.requiredTools).size).toBe(scenario.requiredTools.length);
      if (scenario.expectedScope) expect(scenario.requiredMetrics.length).toBeGreaterThan(0);
    }
  });

  it('routes at least 95% of evaluation scenarios to the expected intent, tools and exclusions', () => {
    const outcomes = AI_EVALUATION_SCENARIOS.map((scenario) => {
      const intentMatches = getQueryIntent(scenario.query, scenario.attachments || []) === scenario.expectedIntent;
      const toolNames = getRelevantToolsForQuery(scenario.query, scenario.attachments || []).map((tool) => tool.name);
      const includesRequired = scenario.requiredTools.every((tool) => toolNames.includes(tool));
      const excludesForbidden = scenario.forbiddenTools.every((tool) => !toolNames.includes(tool));
      const hasNoDuplicates = new Set(toolNames).size === toolNames.length && toolNames.length <= 3;
      return { scenario, passed: intentMatches && includesRequired && excludesForbidden && hasNoDuplicates };
    });
    const passed = outcomes.filter((outcome) => outcome.passed);
    const failedIds = outcomes
      .filter((outcome) => !outcome.passed)
      .map((outcome) => {
        const scenario = outcome.scenario;
        return `${scenario.id} (${getQueryIntent(scenario.query, scenario.attachments || [])} / ${getRelevantToolsForQuery(scenario.query, scenario.attachments || []).map((tool) => tool.name).join(', ')})`;
      })
      .join(', ');

    expect(passed.length / AI_EVALUATION_SCENARIOS.length, `Başarısız senaryolar: ${failedIds}`).toBeGreaterThanOrEqual(0.95);
  });

  it('keeps standardized report scope and mandatory metric fields separate from raw lists', () => {
    const customerResult = buildAiAnalysisResult('searchCustomers', { query: 'örnek' }, {
      count: 2,
      customers: [{ customerName: 'Gizli Cari' }, { customerName: 'Diğer Cari' }]
    });
    const repResult = buildAiAnalysisResult('getSalesRepSummary', {}, { salesReps: [{ salesRep: 'A' }] });

    expect(customerResult.scope).toBe('CUSTOMER');
    expect(customerResult.metrics).toContainEqual({ label: 'Müşteri sayısı', value: '2', rawValue: 2 });
    expect(JSON.stringify(customerResult)).not.toContain('Gizli Cari');
    expect(repResult.scope).toBe('REP');
    expect(repResult.metrics).toContainEqual({ label: 'Temsilci sayısı', value: '1', rawValue: 1 });
  });

  it('uses deterministic fallback content and protects zero denominators', () => {
    const emptyAnalysis = buildAiAnalysisResult('getGlobalFinancialSummary', {}, {});

    expect(emptyAnalysis.metrics).toContainEqual({ label: 'Sonuç durumu', value: 'Veri alındı' });
    expect(calculateCEI(0, 0, 0)).toBe(100);
    expect(Number.isFinite(calculateCEI(0, 0, 0))).toBe(true);
  });

  it('keeps mutation routing separate from read-only reporting tools before confirmation', () => {
    const mutationScenarios = AI_EVALUATION_SCENARIOS.filter((scenario) => scenario.expectedIntent === 'MUTATION');

    for (const scenario of mutationScenarios) {
      const selected = getRelevantToolsForQuery(scenario.query).map((tool) => tool.name);
      expect(selected.some((tool) => ['getGlobalFinancialSummary', 'getShipmentTrackingReport', 'getSalesFkns'].includes(tool))).toBe(false);
    }
  });
});
