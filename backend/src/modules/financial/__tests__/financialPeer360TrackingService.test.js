import test from 'node:test';
import assert from 'node:assert/strict';
import { createFinancialPeer360TrackingService } from '../financialPeer360TrackingService.js';

const service = createFinancialPeer360TrackingService({});

test('Financial Peer, 360 & Recommendation Tracking Service (FAN-022..024)', async (t) => {

  // ─── FAN-022: Eş Grup Kıyaslama ─────────────────────────────────────────
  await t.test('FAN-022: calculatePeerGroupComparison', async (st) => {

    await st.test('should trigger fallback when peer group size < 10', () => {
      const result = service.calculatePeerGroupComparison({
        entityValue: 45,
        peerValues: [30, 40, 50, 60, 70], // 5 peers (< 10)
        peerGroupType: 'CHANNEL',
      });
      assert.equal(result.isFallback, true);
      assert.equal(result.peerGroupType, 'COMPANY_FALLBACK');
    });

    await st.test('should keep original peerGroupType when peer group size >= 10', () => {
      const peers = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]; // 12 peers
      const result = service.calculatePeerGroupComparison({
        entityValue: 50,
        peerValues: peers,
        peerGroupType: 'CHANNEL',
      });
      assert.equal(result.isFallback, false);
      assert.equal(result.peerGroupType, 'CHANNEL');
      assert.ok(result.percentileRank > 0);
    });

    await st.test('should calculate P25, Median and P75 correctly', () => {
      const peers = Array.from({ length: 100 }, (_, i) => i + 1); // 1-100
      const result = service.calculatePeerGroupComparison({
        entityValue: 50,
        peerValues: peers,
      });
      assert.equal(result.medianValue, 51);
      assert.equal(result.percentileRank, 50);
    });
  });

  // ─── FAN-023: Müşteri 360 Finansal Özet ──────────────────────────────────
  await t.test('FAN-023: generateCustomer360Summary', async (st) => {

    await st.test('should consolidate balance and instrument risk into total risk', () => {
      const summary = service.generateCustomer360Summary({
        totalBalance: 100000,
        openInstrumentRisk: 50000,
        recommendedLimit: 300000,
      });
      assert.equal(summary.totalRisk, 150000);
      assert.equal(summary.limitUsagePercent, 50);
    });

    await st.test('should handle zero limit without division by zero', () => {
      const summary = service.generateCustomer360Summary({
        totalBalance: 100000,
        recommendedLimit: 0,
      });
      assert.equal(summary.limitUsagePercent, 0);
    });
  });

  // ─── FAN-024: Takip Önerisi Sonuç Ölçümü ─────────────────────────────────
  await t.test('FAN-024: trackRecommendationConversion', async (st) => {

    await st.test('should calculate 7d and 30d conversion rates', () => {
      const tracking = service.trackRecommendationConversion({
        initialRiskAmount: 100000,
        relief7dAmount: 25000,
        relief30dAmount: 80000,
        status: 'CONVERTED',
      });
      assert.equal(tracking.conversionRate7d, 25);
      assert.equal(tracking.conversionRate30d, 80);
      assert.equal(tracking.associationType, 'TEMPORAL_ASSOCIATION');
    });

    await st.test('should fallback invalid status to PRESENTED', () => {
      const tracking = service.trackRecommendationConversion({
        status: 'INVALID_STATUS',
      });
      assert.equal(tracking.status, 'PRESENTED');
    });
  });
});
