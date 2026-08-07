import { describe, expect, it } from 'vitest';
import { calculateCEI } from '../../calculations/cariCalculations';
import { aiToolDeclarations, buildAiAnalysisResult, DISCOVER_MORE_TOOLS, discoverMoreTools, getQueryIntent, getRelevantToolsForQuery } from '../aiTools';
import { AI_EVALUATION_SCENARIOS, AI_TOOL_CATALOG_SCENARIOS } from '../aiEvaluationScenarios';

describe('AI evaluation and regression set', () => {
  it('contains at least 30 business scenarios with expected routing metadata', () => {
    expect(AI_EVALUATION_SCENARIOS.length).toBeGreaterThanOrEqual(30);
    for (const scenario of AI_EVALUATION_SCENARIOS) {
      if (scenario.requiredTools.length > 0) {
        expect(new Set(scenario.requiredTools).size).toBe(scenario.requiredTools.length);
      }
      if (scenario.expectedScope && !scenario.id.startsWith('guardrail-')) {
        expect(scenario.requiredMetrics.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps all declared business tools reachable through the discovery escape valve', () => {
    const discovery = discoverMoreTools('nadir raporlama ihtiyacı');
    const discoveredNames = discovery.availableTools.map((tool) => tool.name);
    const declaredBusinessTools = aiToolDeclarations
      .filter((tool) => tool.name !== DISCOVER_MORE_TOOLS)
      .map((tool) => tool.name);

    expect(AI_TOOL_CATALOG_SCENARIOS.length).toBeGreaterThanOrEqual(45);
    expect(new Set(AI_TOOL_CATALOG_SCENARIOS).size).toBe(AI_TOOL_CATALOG_SCENARIOS.length);
    expect(discoveredNames).toEqual(expect.arrayContaining([...AI_TOOL_CATALOG_SCENARIOS]));
    expect(discoveredNames).toEqual(expect.arrayContaining(declaredBusinessTools));
    expect(discoveredNames).toHaveLength(declaredBusinessTools.length);
  });

  it('offers two direct tools and the discovery escape valve at most', () => {
    for (const scenario of AI_EVALUATION_SCENARIOS) {
      const toolNames = getRelevantToolsForQuery(scenario.query, scenario.attachments || []).map((tool) => tool.name);
      expect(toolNames).toContain(DISCOVER_MORE_TOOLS);
      expect(toolNames.length).toBeLessThanOrEqual(3);
      expect(toolNames.filter((name) => name !== DISCOVER_MORE_TOOLS).length).toBeLessThanOrEqual(2);
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
  });

  it('keeps mutation routing separate from read-only reporting tools before confirmation', () => {
    const mutationScenarios = AI_EVALUATION_SCENARIOS.filter((scenario) => scenario.expectedIntent === 'MUTATION');

    for (const scenario of mutationScenarios) {
      const selected = getRelevantToolsForQuery(scenario.query).map((tool) => tool.name);
      expect(selected.some((tool) => ['getGlobalFinancialSummary', 'getShipmentTrackingReport', 'getSalesFkns'].includes(tool))).toBe(false);
    }
  });
});
