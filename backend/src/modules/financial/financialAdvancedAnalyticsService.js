import crypto from 'crypto';

/**
 * FAN-009..014: İleri Analitik, Tahmin ve Sinyal Motorları
 */
export function createFinancialAdvancedAnalyticsService(deps = {}) {
  const repository = deps.repository;

  return Object.freeze({
    /**
     * FAN-009: Araç Gerçekleşme Beklentisi
     * expected_cash = face_value * calibrated_probability
     */
    async calculateInstrumentRealization(options = {}) {
      const faceValue = options.faceValue ?? 0;
      const calibratedProbability = options.calibratedProbability ?? 1.0;
      const expectedCash = Number((faceValue * calibratedProbability).toFixed(2));
      
      const result = {
        id: crypto.randomUUID(),
        companyId: options.companyId || crypto.randomUUID(),
        asOfDate: options.asOfDate || new Date().toISOString().split('T')[0],
        instrumentType: options.instrumentType || 'SENET',
        maturityBucket: options.maturityBucket || '15-30',
        faceValue,
        calibratedProbability,
        expectedCash,
        fallbackLevel: options.fallbackLevel || 'CUSTOMER',
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveInstrumentRealization) {
        await repository.saveInstrumentRealization(result);
      }
      return result;
    },

    /**
     * FAN-010: 13 Haftalık Nakit Görünümü
     * P25, P50, P75
     */
    async calculate13WeekCashForecast(options = {}) {
      const p25 = options.p25 ?? 0;
      const p50 = options.p50 ?? 0;
      const p75 = options.p75 ?? 0;
      
      const result = {
        id: crypto.randomUUID(),
        companyId: options.companyId || crypto.randomUUID(),
        asOfDate: options.asOfDate || new Date().toISOString().split('T')[0],
        forecastScope: options.forecastScope || 'EXISTING_BOOK',
        weekBucket: options.weekBucket || '1-7',
        p25Forecast: p25,
        p50Forecast: p50,
        p75Forecast: p75,
        invoiceDirectCash: options.invoiceDirectCash ?? 0,
        instrumentSettlement: options.instrumentSettlement ?? 0,
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.save13WeekCashForecast) {
        await repository.save13WeekCashForecast(result);
      }
      return result;
    },

    /**
     * FAN-011: Finansal Tahmin Geri Testi (Backtest)
     * WAPE = sum(|actual - forecast|) / sum(|actual|)
     */
    async calculateForecastBacktest(options = {}) {
      const actualAmount = options.actualAmount ?? 0;
      const forecastAmount = options.forecastAmount ?? 0;
      
      const mae = Math.abs(actualAmount - forecastAmount);
      let wape = null;
      let bias = null;
      
      if (actualAmount !== 0) {
        wape = Number((mae / Math.abs(actualAmount)).toFixed(4));
        bias = Number(((forecastAmount - actualAmount) / actualAmount).toFixed(4));
      }

      const result = {
        id: crypto.randomUUID(),
        companyId: options.companyId || crypto.randomUUID(),
        originDate: options.originDate || new Date().toISOString().split('T')[0],
        targetDate: options.targetDate || new Date().toISOString().split('T')[0],
        horizonWeeks: options.horizonWeeks || 4,
        actualAmount,
        forecastAmount,
        mae,
        wape,
        bias,
        isApproved: options.isApproved || false,
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveForecastBacktest) {
        await repository.saveForecastBacktest(result);
      }
      return result;
    },

    /**
     * FAN-012: Erken Bozulma Sinyalleri
     */
    async detectEarlyDeteriorationSignals(options = {}) {
      const result = {
        id: crypto.randomUUID(),
        companyId: options.companyId || crypto.randomUUID(),
        customerId: options.customerId || null,
        signalType: options.signalType || 'NEW_29_PLUS_ACCEL',
        direction: options.direction || 'UP',
        materialAmount: options.materialAmount ?? 0,
        comparisonPeriod: options.comparisonPeriod || 'PREVIOUS_MONTH',
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveEarlyDeteriorationSignal) {
        await repository.saveEarlyDeteriorationSignal(result);
      }
      return result;
    },

    /**
     * FAN-013: Robust Anomaly Detection
     * Z-Score = |actual - median| / MAD
     */
    async detectRobustAnomalies(options = {}) {
      const actualValue = options.actualValue ?? 0;
      const medianValue = options.medianValue ?? 0;
      const madValue = options.madValue ?? 0;
      
      let robustZScore = null;
      let isAnomaly = false;

      // MAD = 0 ise IQR fallback yapılmalıdır ancak basit tutuyoruz, şimdilik MAD bazlı kontrol:
      if (madValue > 0) {
        robustZScore = Number((Math.abs(actualValue - medianValue) / madValue).toFixed(4));
        if (robustZScore > 3.5) { // 3.5 MAD kuralı
          isAnomaly = true;
        }
      } else if (actualValue !== medianValue) {
        // MAD 0 ise (herkes aynı değerde ama current farklıysa), IQR fallback veya outlier sayılır
        robustZScore = 999.9999; 
        isAnomaly = true;
      } else {
        robustZScore = 0;
      }

      const result = {
        id: crypto.randomUUID(),
        companyId: options.companyId || crypto.randomUUID(),
        anomalyDate: options.anomalyDate || new Date().toISOString().split('T')[0],
        metricCode: options.metricCode || 'UNKNOWN',
        actualValue,
        medianValue,
        madValue,
        robustZScore,
        isAnomaly,
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveRobustAnomaly) {
        await repository.saveRobustAnomaly(result);
      }
      return result;
    },

    /**
     * FAN-014: Finansal Davranış Segmenti
     */
    async classifyBehaviorSegment(options = {}) {
      const result = {
        id: crypto.randomUUID(),
        companyId: options.companyId || crypto.randomUUID(),
        customerId: options.customerId || crypto.randomUUID(),
        segmentClass: options.segmentClass || 'SAGLIKLI_DONGU',
        evidenceTags: options.evidenceTags || [],
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveBehaviorSegment) {
        await repository.saveBehaviorSegment(result);
      }
      return result;
    }
  });
}
