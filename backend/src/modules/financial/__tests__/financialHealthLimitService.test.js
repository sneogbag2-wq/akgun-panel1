import test from 'node:test';
import assert from 'node:assert/strict';
import { createFinancialHealthLimitService } from '../financialHealthLimitService.js';

const service = createFinancialHealthLimitService({});

test('Financial Health & Limit Service (AI-17: HLT, LIM, PRF)', async (t) => {

  // ─── HLT-001: Sağlık Skoru ────────────────────────────────────────────────
  await t.test('HLT-001: calculateHealthScore', async (st) => {

    await st.test('should produce 100 for perfect inputs', () => {
      const r = service.calculateHealthScore({
        collectionRate: 1.0,
        agingDropRatio: 1.0,
        instrumentRiskRatio: 0.0,
        paymentSpeedDays: 0,
      });
      assert.equal(r.healthScore, 100);
      assert.equal(r.category, 'EXCELLENT');
      assert.equal(r.confidence, 'HIGH');
    });

    await st.test('should produce 0 for worst-case inputs', () => {
      const r = service.calculateHealthScore({
        collectionRate: 0,
        agingDropRatio: 0,
        instrumentRiskRatio: 1.0,
        paymentSpeedDays: 90,
      });
      assert.equal(r.healthScore, 0);
      assert.equal(r.category, 'CRITICAL');
    });

    await st.test('score must never exceed 100 or go below 0', () => {
      const r = service.calculateHealthScore({
        collectionRate: 2.0,   // aşırı değer
        agingDropRatio: 2.0,
        instrumentRiskRatio: -1.0,
        paymentSpeedDays: -30,
      });
      assert.ok(r.healthScore <= 100, 'score should be capped at 100');
      assert.ok(r.healthScore >= 0, 'score should not go below 0');
    });

    await st.test('GOOD range: collectionRate=0.85, agingDrop=0.80', () => {
      const r = service.calculateHealthScore({
        collectionRate: 0.85,
        agingDropRatio: 0.80,
        instrumentRiskRatio: 0.15,
        paymentSpeedDays: 30,
      });
      // Collection=85, Aging=80, Instrument=85, Payment≈66.7
      // Raw = 85*0.35 + 80*0.30 + 85*0.20 + 66.7*0.15 = 29.75+24+17+10=80.75
      assert.ok(r.healthScore >= 70, `Expected GOOD range (>=70), got ${r.healthScore}`);
      assert.ok(['GOOD', 'EXCELLENT'].includes(r.category));
    });

    await st.test('should return 4 components', () => {
      const r = service.calculateHealthScore({ collectionRate: 0.8 });
      assert.equal(r.components.length, 4);
    });
  });

  // ─── LIM-001 / LIM-002: İç Limit ─────────────────────────────────────────
  await t.test('LIM-001/002: calculateInternalLimit', async (st) => {

    await st.test('EXCELLENT score gives 2.5x base limit', () => {
      const r = service.calculateInternalLimit({
        healthScore: 90,
        baseLimitAmount: 100000,
        currentUsage: 50000,
      });
      assert.equal(r.recommendedLimit, 250000);
      assert.equal(r.headroom, 200000);
    });

    await st.test('CRITICAL score gives zero limit', () => {
      const r = service.calculateInternalLimit({
        healthScore: 20,
        baseLimitAmount: 100000,
        currentUsage: 0,
      });
      assert.equal(r.recommendedLimit, 0);
      assert.equal(r.headroom, 0);
    });

    await st.test('headroom is capped at 0 when usage > limit', () => {
      const r = service.calculateInternalLimit({
        healthScore: 60,
        baseLimitAmount: 100000,
        currentUsage: 200000,
      });
      // Skor 60 → 1.5x = 150000 limit, kullanım 200000 → headroom 0
      assert.equal(r.headroom, 0);
    });

    await st.test('should generate history entry when limit changes', () => {
      const r = service.calculateInternalLimit({
        healthScore: 90,
        baseLimitAmount: 100000,
        currentUsage: 0,
        previousLimit: 100000,  // önceki limit farklı
      });
      assert.ok(r.history !== null, 'History should be generated on limit change');
      assert.equal(r.history.newLimit, 250000);
    });

    await st.test('should NOT generate history when limit unchanged', () => {
      const r = service.calculateInternalLimit({
        healthScore: 90,
        baseLimitAmount: 100000,
        currentUsage: 0,
        previousLimit: 250000,  // aynı limit
      });
      assert.equal(r.history, null);
    });
  });

  // ─── PRF-001: Temsilci Karnesi ────────────────────────────────────────────
  await t.test('PRF-001: calculateRepPerformance', async (st) => {

    await st.test('should return 100 overall for perfect rep', () => {
      const r = service.calculateRepPerformance({
        collectionRate: 1.0,
        ceiRate: 1.0,
        limitBreachCount: 0,
      });
      assert.equal(r.overallScore, 100);
      assert.equal(r.limitDisciplineScore, 100);
    });

    await st.test('each limit breach costs -10 points in limit discipline', () => {
      const r = service.calculateRepPerformance({
        collectionRate: 0,
        ceiRate: 0,
        limitBreachCount: 5,
      });
      // 5 breach → 100 - 50 = 50
      assert.equal(r.limitDisciplineScore, 50);
    });

    await st.test('10+ breaches floors limit discipline at 0', () => {
      const r = service.calculateRepPerformance({
        collectionRate: 0,
        ceiRate: 0,
        limitBreachCount: 15,
      });
      assert.equal(r.limitDisciplineScore, 0);
    });

    await st.test('overall score weights: 50% collection, 30% cei, 20% limit', () => {
      const r = service.calculateRepPerformance({
        collectionRate: 0.80,  // 80 * 0.50 = 40
        ceiRate: 0.60,         // 60 * 0.30 = 18
        limitBreachCount: 2,   // 80 * 0.20 = 16
      });
      // Overall = 40 + 18 + 16 = 74
      assert.equal(r.overallScore, 74);
    });
  });

  // ─── PRF-002: SSM Karnesi ─────────────────────────────────────────────────
  await t.test('PRF-002: calculateSsmPerformance', async (st) => {

    await st.test('should return null scores for empty rep list', () => {
      const r = service.calculateSsmPerformance({ repPerformances: [] });
      assert.equal(r.overallScore, null);
      assert.equal(r.repCount, 0);
    });

    await st.test('should average rep scores correctly', () => {
      const rep1 = service.calculateRepPerformance({ collectionRate: 1.0, ceiRate: 1.0, limitBreachCount: 0 });
      const rep2 = service.calculateRepPerformance({ collectionRate: 0.6, ceiRate: 0.6, limitBreachCount: 0 });
      // rep1 overall = (100*0.5 + 100*0.3 + 100*0.2) = 100
      // rep2 overall = (60*0.5 + 60*0.3 + 100*0.2) = 30+18+20 = 68
      // SSM avg = (100 + 68) / 2 = 84
      const ssm = service.calculateSsmPerformance({ repPerformances: [rep1, rep2] });
      assert.equal(ssm.overallScore, 84);
      assert.equal(ssm.repCount, 2);
    });
  });

  // ─── Section 1.3 Katalog Kısıt Kapıları ─────────────────────────────────
  await t.test('Section 1.3: Health Score & Limit Gating Rules', async (st) => {
    await st.test('should return healthScore null when active weight < 60% or valid components < 2', () => {
      const r = service.calculateHealthScore({
        collectionRate: 0.8,
        agingDropRatio: null,
        instrumentRiskRatio: null,
        paymentSpeedDays: null
      });
      assert.equal(r.healthScore, null);
      assert.equal(r.category, 'UNPUBLISHED_DATA_INSUFFICIENT');
      assert.equal(r.isPublished, false);
      assert.equal(r.validComponentCount, 1);
    });

    await st.test('should calculate internal limit using needP75 and cashCapacityP25 when provided', () => {
      const r = service.calculateInternalLimit({
        healthScore: 85,
        needP75: 120000,
        cashCapacityP25: 150000,
        currentUsage: 200000
      });
      // behaviorFactor for 85 = 1.2
      // capacityLimit = 150000 * 1.2 = 180000
      // targetLimit = min(120000, 180000) = 120000
      assert.equal(r.recommendedLimit, 120000);
      assert.equal(r.governedLimit, 120000);
      assert.equal(r.behaviorFactor, 1.2);
    });
  });
});
