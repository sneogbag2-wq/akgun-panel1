import { describe, it, expect, beforeAll } from 'vitest';
import { executeAiTool, getRelevantToolsForQuery } from '../aiTools';
import { initFromArchive } from '../customerService';
import { getRegisteredReadToolNames } from '../aiReadToolRegistry';
import { getRegisteredAnalyticsReadToolNames } from '../aiAnalyticsReadToolRegistry';

describe('queryTransactions tool', () => {
  beforeAll(async () => {
    await initFromArchive();
  });

  it('should find transactions for a specific customer query', async () => {
    const res = await executeAiTool('queryTransactions', {
      transactionType: 'TAHSILAT',
      sortBy: 'LATEST',
      limit: 5
    });

    expect(res).toBeDefined();
  });

  it('should support sales rep summary tool', async () => {
    const res = await executeAiTool('getSalesRepSummary', {});
    expect(res).toHaveProperty('salesReps');
    expect(res.salesReps).toBeInstanceOf(Array);
  });

  it('should execute getFinancialHealthReport tool successfully', async () => {
    const res = await executeAiTool('getFinancialHealthReport', {});
    expect(res).toHaveProperty('healthScore');
    expect(res).toHaveProperty('riskLevel');
    expect(res).toHaveProperty('overdueRatio');
    expect(res).toHaveProperty('actionRecommendation');
  });

  it('should execute getParetoConcentrationAnalysis tool successfully', async () => {
    const res = await executeAiTool('getParetoConcentrationAnalysis', {});
    expect(res).toHaveProperty('salesPareto');
    expect(res).toHaveProperty('debtPareto');
    expect(res.salesPareto).toHaveProperty('isHighRisk');
  });

  it('should execute getCollectionEffectivenessIndex tool successfully', async () => {
    const res = await executeAiTool('getCollectionEffectivenessIndex', {});
    expect(res).toHaveProperty('ceiPercentage');
    expect(res).toHaveProperty('evaluation');
  });

  it('keeps reporting handlers in the read-only registry', () => {
    const registeredNames = getRegisteredReadToolNames();

    expect(registeredNames).toEqual(expect.arrayContaining([
      'getFinancialHealthReport',
      'getGlobalFinancialSummary',
      'getCurrentStatus',
      'getPaymentMethodsBreakdown',
      'searchCustomers',
      'getCustomerStatement',
      'getShipmentTrackingReport'
    ]));
    expect(registeredNames).not.toContain('addManualInvoice');
  });

  it('keeps portfolio, rep and risk reporting handlers in the read-only registry', () => {
    const analyticsNames = getRegisteredAnalyticsReadToolNames();
    const registeredNames = getRegisteredReadToolNames();

    // These tools were moved out of the executeAiTool switch into
    // aiAnalyticsReadToolRegistry.ts. Both checks matter: the names must be
    // owned by that registry specifically (not just present anywhere), and
    // the aggregate registry (aiReadToolRegistry) must surface them so
    // executeAiTool's early registry dispatch actually reaches them before
    // ever falling through to the switch statement.
    const expectedAnalyticsTools = [
      'getSalesRepSummary',
      'getTopDebtors',
      'getTopCustomersBySalesVolume',
      'getCustomerCheques',
      'calculateCustomerDebtToCollectionRisk',
      'getDeepExecutiveAnalyticsOverview'
    ];

    expect(analyticsNames).toEqual(expect.arrayContaining(expectedAnalyticsTools));
    expect(registeredNames).toEqual(expect.arrayContaining(expectedAnalyticsTools));
  });

  it('should support top-debtors and cheque reporting tools via the registry', async () => {
    const debtors = await executeAiTool('getTopDebtors', { limit: 3 });
    expect(debtors).toHaveProperty('debtors');
    expect(debtors.debtors.length).toBeLessThanOrEqual(3);

    const cheques = await executeAiTool('getCustomerCheques', {});
    expect(cheques).toHaveProperty('cheques');
    expect(Array.isArray(cheques.cheques)).toBe(true);
  });

  it('routes customer search through the read-only registry', async () => {
    const result = await executeAiTool('searchCustomers', { query: 'olmayan-müşteri' });

    expect(result).toEqual(expect.objectContaining({
      count: 0
    }));
  });

  describe('AI-19 tools execution', () => {
    it('should execute getAgingMigrationMatrix successfully', async () => {
      const res = await executeAiTool('getAgingMigrationMatrix', { period: '2026-07' });
      expect(res).toBeDefined();
      expect(res).toHaveProperty('metricId', 'COH-002');
      expect(res).toHaveProperty('resultClass', 'FACT');
    });

    it('should execute getInvoiceVintageAnalysis successfully', async () => {
      const res = await executeAiTool('getInvoiceVintageAnalysis', { cohortMonth: '2026-06' });
      expect(res).toBeDefined();
      expect(res).toHaveProperty('metricId', 'COH-003');
    });

    it('should execute getPaymentSurvival successfully', async () => {
      const res = await executeAiTool('getPaymentSurvival', {});
      expect(res).toBeDefined();
      expect(res).toHaveProperty('metricId', 'FAN-004');
    });

    it('should execute getPeerBenchmark successfully', async () => {
      const res = await executeAiTool('getPeerBenchmark', {});
      expect(res).toBeDefined();
      expect(res).toHaveProperty('metricId', 'COH-007');
      expect(res).toHaveProperty('resultClass', 'INFERENCE');
    });

    it('should execute getFinancialConcentration successfully', async () => {
      const res = await executeAiTool('getFinancialConcentration', {});
      expect(res).toBeDefined();
      expect(res).toHaveProperty('metricId', 'COH-001');
    });
  });

  it('should filter relevant tools dynamically to save token bandwidth', async () => {
    const routineTools = getRelevantToolsForQuery('Ahmet Market bakiyesi ne kadar?');
    const toolNames = routineTools.map(t => t.name);

    expect(toolNames).toContain('searchCustomers');
    expect(toolNames).toContain('getCustomerDetails');
    expect(toolNames).not.toContain('addManualInvoice');
    expect(toolNames).not.toContain('advancedMapAndImportExcel');

    const mutationTools = getRelevantToolsForQuery('5000100015 kodlu müşteriye 1000 TL fatura ekle');
    const mutationNames = mutationTools.map(t => t.name);
    expect(mutationNames).toContain('addManualInvoice');
  });
});
