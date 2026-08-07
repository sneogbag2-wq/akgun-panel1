import test from 'node:test';
import assert from 'node:assert/strict';
import { createFinancialScenarioAnalyticsService } from '../financialScenarioAnalyticsService.js';

test('Financial Scenario Analytics Service (FAN-015..019)', async (t) => {
  const mockRepository = {
    saveCollectionPriorityScore: async () => true,
    saveStressScenarioResult: async () => true,
    saveCounterpartyLossTest: async () => true,
    saveExpectedLossScenario: async () => true,
    saveRestatementImpact: async () => true
  };
  const service = createFinancialScenarioAnalyticsService({ repository: mockRepository });

  await t.test('FAN-015: Collection Priority Score', async (st) => {
    await st.test('should calculate normalized score if weights >= 60', async () => {
      const result = await service.calculateCollectionPriority({
        riskMateriality: 80,
        agingSeverity: 60,
        instrumentRisk: 90,
        recentDeterioration: 0,
        limitBreach: 0,
        weightsProvided: [30, 25, 20] // Toplam %75
      });
      assert.equal(result.isManualReview, false);
      // Raw = (80*0.3) + (60*0.25) + (90*0.2) = 24 + 15 + 18 = 57
      // Normalized = 57 * (100 / 75) = 76
      assert.equal(result.score, 76);
    });

    await st.test('should fallback to MANUAL_REVIEW if weights < 60', async () => {
      const result = await service.calculateCollectionPriority({
        riskMateriality: 80,
        weightsProvided: [30] // Toplam %30 (< %60)
      });
      assert.equal(result.isManualReview, true);
      assert.equal(result.score, null);
    });
  });

  await t.test('FAN-016: Stress Scenario', async () => {
    const result = await service.runStressScenarioEngine({
      baseExposure: 100000,
      scenarioType: 'COLLECTION_MINUS_25'
    });
    // Expected to increase exposure by 25% for test logic
    assert.equal(result.scenarioExposure, 125000);
    assert.equal(result.impactAmount, 25000);
  });

  await t.test('FAN-017: Counterparty Loss Test', async () => {
    const result = await service.runCounterpartyLossTest({
      totalExposureAtRisk: 500000,
      lossRate: 1.0,
      scenarioHorizon: 'TOP_1_DEFAULT'
    });
    assert.equal(result.cashImpactAmount, 500000);
  });

  await t.test('FAN-018: Expected Loss (ECL)', async (st) => {
    await st.test('should calculate EAD * PD * LGD', async () => {
      const result = await service.calculateExpectedLossScenario({
        eadAmount: 100000,
        pdRate: 0.05,
        lgdRate: 0.40
      });
      // 100000 * 0.05 * 0.40 = 2000
      assert.equal(result.expectedLossAmount, 2000);
      assert.equal(result.isScenarioOnly, false);
    });

    await st.test('should mark as SCENARIO_ONLY if data is insufficient', async () => {
      const result = await service.calculateExpectedLossScenario({
        hasSufficientData: false,
        eadAmount: 100000,
        pdRate: 0.10,
        lgdRate: 0.50
      });
      assert.equal(result.expectedLossAmount, 5000);
      assert.equal(result.isScenarioOnly, true);
    });
  });

  await t.test('FAN-019: Restatement Impact', async () => {
    const result = await service.calculateRestatementImpact({
      originalPublishedValue: 150000,
      currentRecalculatedValue: 160000
    });
    assert.equal(result.varianceAmount, 10000);
  });
});
