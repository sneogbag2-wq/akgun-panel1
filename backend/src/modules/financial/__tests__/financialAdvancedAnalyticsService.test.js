import test from 'node:test';
import assert from 'node:assert/strict';
import { createFinancialAdvancedAnalyticsService } from '../financialAdvancedAnalyticsService.js';

test('Financial Advanced Analytics Service (FAN-009..014)', async (t) => {
  const mockRepository = {
    saveInstrumentRealization: async () => true,
    save13WeekCashForecast: async () => true,
    saveForecastBacktest: async () => true,
    saveEarlyDeteriorationSignal: async () => true,
    saveRobustAnomaly: async () => true,
    saveBehaviorSegment: async () => true
  };
  const service = createFinancialAdvancedAnalyticsService({ repository: mockRepository });

  await t.test('FAN-009: Instrument Realization', async () => {
    const result = await service.calculateInstrumentRealization({
      faceValue: 1000,
      calibratedProbability: 0.85
    });
    assert.equal(result.expectedCash, 850);
  });

  await t.test('FAN-010: 13-Week Cash Forecast', async () => {
    const result = await service.calculate13WeekCashForecast({
      p25: 100,
      p50: 150,
      p75: 200
    });
    assert.equal(result.p25Forecast, 100);
    assert.equal(result.p50Forecast, 150);
    assert.equal(result.p75Forecast, 200);
  });

  await t.test('FAN-011: Forecast Backtest WAPE', async (st) => {
    await st.test('should calculate correct WAPE and BIAS', async () => {
      const result = await service.calculateForecastBacktest({
        actualAmount: 1000,
        forecastAmount: 1200
      });
      // MAE = 200
      // WAPE = 200 / 1000 = 0.2000
      // Bias = 200 / 1000 = 0.2000
      assert.equal(result.mae, 200);
      assert.equal(result.wape, 0.2000);
      assert.equal(result.bias, 0.2000);
    });

    await st.test('should handle division by zero smoothly', async () => {
      const result = await service.calculateForecastBacktest({
        actualAmount: 0,
        forecastAmount: 500
      });
      assert.equal(result.mae, 500);
      assert.equal(result.wape, null);
      assert.equal(result.bias, null);
    });
  });

  await t.test('FAN-012: Early Deterioration Signals', async () => {
    const result = await service.detectEarlyDeteriorationSignals({
      signalType: 'CEI_DROP',
      direction: 'DOWN'
    });
    assert.equal(result.signalType, 'CEI_DROP');
  });

  await t.test('FAN-013: Robust Anomaly Z-Score', async (st) => {
    await st.test('should mark as anomaly if Z-Score > 3.5', async () => {
      const result = await service.detectRobustAnomalies({
        actualValue: 5000,
        medianValue: 1000,
        madValue: 500
      });
      // Z-Score = |5000 - 1000| / 500 = 8.0000
      assert.equal(result.robustZScore, 8.0000);
      assert.equal(result.isAnomaly, true);
    });

    await st.test('should not mark as anomaly if Z-Score <= 3.5', async () => {
      const result = await service.detectRobustAnomalies({
        actualValue: 2000,
        medianValue: 1000,
        madValue: 500
      });
      // Z-Score = |2000 - 1000| / 500 = 2.0000
      assert.equal(result.robustZScore, 2.0000);
      assert.equal(result.isAnomaly, false);
    });
    
    await st.test('should handle MAD=0 smoothly', async () => {
      const result = await service.detectRobustAnomalies({
        actualValue: 2000,
        medianValue: 1000,
        madValue: 0
      });
      assert.equal(result.robustZScore, 999.9999);
      assert.equal(result.isAnomaly, true);
    });
  });

  await t.test('FAN-014: Behavior Segment', async () => {
    const result = await service.classifyBehaviorSegment({
      segmentClass: 'BUYUYEN_RISK'
    });
    assert.equal(result.segmentClass, 'BUYUYEN_RISK');
  });
});
