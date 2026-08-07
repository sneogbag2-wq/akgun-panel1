import test from 'node:test';
import assert from 'node:assert/strict';
import { createFinancialCoreAnalyticsService } from '../financialCoreAnalyticsService.js';

test('Financial Core Analytics Service (FAN-004..008)', async (t) => {
  const mockRepository = {
    savePaymentSurvival: async () => true,
    saveAgedBurdenBridge: async () => true,
    saveTotalExposureBridge: async () => true,
    saveEconomicCollectionBridge: async () => true,
    saveInstrumentMaturityLadder: async () => true
  };
  const service = createFinancialCoreAnalyticsService({ repository: mockRepository });

  await t.test('FAN-004: Payment Survival Curve', async (st) => {
    await st.test('should find median survival days where S(d) <= 0.50', async () => {
      const survivalData = [
        { day: 10, survival_prob: 0.80 },
        { day: 20, survival_prob: 0.60 },
        { day: 35, survival_prob: 0.45 },
        { day: 45, survival_prob: 0.20 }
      ];
      const result = await service.calculatePaymentSurvival({ survivalData });
      assert.equal(result.medianSurvivalDays, 35);
    });

    await st.test('should return null if S(d) never drops below or equal to 0.50', async () => {
      const survivalData = [
        { day: 10, survival_prob: 0.80 },
        { day: 20, survival_prob: 0.60 }
      ];
      const result = await service.calculatePaymentSurvival({ survivalData });
      assert.equal(result.medianSurvivalDays, null);
    });
  });

  await t.test('FAN-005: Aged Burden Bridge', async (st) => {
    await st.test('should calculate closing 29+ and variance correctly', async () => {
      const result = await service.calculateAgedBurdenBridge({
        opening29Plus: 1000,
        new29PlusInflow: 500,
        agedSettlementOutflow: 300,
        closing29Plus: 1200 // expected is 1200
      });
      assert.equal(result.bridgeVariance, 0);
    });

    await st.test('should calculate variance if closing is unexpected', async () => {
      const result = await service.calculateAgedBurdenBridge({
        opening29Plus: 1000,
        new29PlusInflow: 500,
        agedSettlementOutflow: 300,
        closing29Plus: 1250 // expected is 1200, variance should be 50
      });
      assert.equal(result.bridgeVariance, 50);
    });
  });

  await t.test('FAN-006: Total Exposure Bridge', async (st) => {
    await st.test('should calculate unreconciled variance', async () => {
      const result = await service.calculateTotalExposureBridge({
        openingTotalExposure: 5000,
        salesInflow: 2000,
        cashCollectionOutflow: 1500,
        writeOffs: 100,
        instrumentBounceInflow: 200,
        closingTotalExposure: 5600 // expected = 5000 + 2000 - 1500 - 100 + 200 = 5600
      });
      assert.equal(result.bridgeVariance, 0);
    });

    await st.test('should show non-zero variance when unreconciled', async () => {
      const result = await service.calculateTotalExposureBridge({
        openingTotalExposure: 5000,
        salesInflow: 2000,
        cashCollectionOutflow: 1500,
        writeOffs: 100,
        instrumentBounceInflow: 200,
        closingTotalExposure: 5700 // expected is 5600
      });
      assert.equal(result.bridgeVariance, 100);
    });
  });

  await t.test('FAN-007: Economic Collection Bridge', async (st) => {
    await st.test('should sum cash, non-cash and pending instruments to economic collection', async () => {
      const result = await service.calculateEconomicCollectionBridge({
        cashRiskRelief: 1000,
        noncashRelief: 200,
        pendingInstrumentVolume: 300
      });
      assert.equal(result.totalEconomicCollection, 1500);
    });
  });

  await t.test('FAN-008: Instrument Maturity Ladder', async (st) => {
    await st.test('should return maturity ladder struct', async () => {
      const result = await service.calculateInstrumentMaturityLadder({
        pastDueAmount: 500,
        pastDueCount: 2,
        due_0_7Amount: 1000,
        due_0_7Count: 3
      });
      assert.equal(result.pastDueAmount, 500);
      assert.equal(result.due_0_7Count, 3);
      assert.equal(result.due_91_PlusAmount, 0);
    });
  });

  await t.test('FAN-001: Concentration Pareto & HHI', async (st) => {
    await st.test('should calculate top N shares and HHI correctly', async () => {
      const items = [
        { id: 'c1', name: 'Cust 1', amount: 500 },
        { id: 'c2', name: 'Cust 2', amount: 300 },
        { id: 'c3', name: 'Cust 3', amount: 200 }
      ];
      const result = await service.calculateConcentrationPareto({ items });
      assert.equal(result.totalAmount, 1000);
      assert.equal(result.top1Share, 50); // 500 / 1000 * 100
      assert.equal(result.top5Share, 100);
      // HHI = 10000 * (0.5^2 + 0.3^2 + 0.2^2) = 10000 * (0.25 + 0.09 + 0.04) = 3800
      assert.equal(result.hhi, 3800);
    });
  });

  await t.test('FAN-002: Aging Transition Matrix', async (st) => {
    await st.test('should categorize opening lots into target status matrix', async () => {
      const openingLots = [
        { lotId: 'l1', startBucket: 'CURRENT', endBucket: 'CLOSED', amount: 100 },
        { lotId: 'l2', startBucket: 'CURRENT', endBucket: '1_30', amount: 50 },
        { lotId: 'l3', startBucket: '31_60', endBucket: '61_90', amount: 200 }
      ];
      const result = await service.calculateAgingTransitionMatrix({ openingLots });
      assert.equal(result.totalOpeningAmount, 350);
      assert.equal(result.matrix.CURRENT.CLOSED.amount, 100);
      assert.equal(result.matrix.CURRENT['1_30'].amount, 50);
      assert.equal(result.matrix['31_60']['61_90'].amount, 200);
    });
  });

  await t.test('FAN-003: Invoice Vintage Curve', async (st) => {
    await st.test('should calculate cumulative closure ratios at milestone days', async () => {
      const realizedClosures = [
        { day: 5, closedAmount: 200 },
        { day: 14, closedAmount: 300 },
        { day: 30, closedAmount: 500 }
      ];
      const result = await service.calculateInvoiceVintageCurve({
        cohortMonth: '2026-01',
        totalCohortPrincipal: 1000,
        realizedClosures
      });
      assert.equal(result.cohortMonth, '2026-01');
      // day 7: 200 -> 20%
      const point7 = result.vintagePoints.find(p => p.day === 7);
      assert.equal(point7.closureRatio, 20);
      // day 14: 200 + 300 = 500 -> 50%
      const point14 = result.vintagePoints.find(p => p.day === 14);
      assert.equal(point14.closureRatio, 50);
    });
  });
});
