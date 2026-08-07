export function createFinancialReadService(metricEngineService = null) {
  return Object.freeze({
    // FIN-013: DSO Formülü: (Açık Alacak / Toplam Satış) * Gün Sayısı
    calculateDSO(totalReceivables, totalSales, daysInPeriod) {
      if (totalSales <= 0) return null; // Satış yoksa DSO hesaplanmaz
      const dso = (totalReceivables / totalSales) * daysInPeriod;
      return Math.round(dso * 100) / 100;
    },

    // FIN-014: CEI Formülü: 100 * (eligible_aged_settlement_amount / adjusted_aged_receivable_pool)
    calculateCEI(eligibleAgedSettlementAmount, adjustedAgedReceivablePool) {
      if (!adjustedAgedReceivablePool || adjustedAgedReceivablePool === 0) return null;
      const cei = (eligibleAgedSettlementAmount / adjustedAgedReceivablePool) * 100;
      return Math.round(cei * 100) / 100;
    },

    // FIN-015: Finansal Sağlık Skoru (Eksik veri varsa ağırlıklar re-normalize edilir)
    // Kural: Kullanılabilir ağırlık < 60 veya bileşen < 2 ise null
    calculateFinancialHealthScore(components) {
      const weights = {
        aging: 35,
        cei: 25,
        exposure: 20,
        closeBehavior: 10,
        instrumentReliability: 10
      };

      let activeWeightSum = 0;
      let weightedScoreSum = 0;
      let validComponentsCount = 0;

      for (const [key, weight] of Object.entries(weights)) {
        if (components[key] !== null && components[key] !== undefined) {
          activeWeightSum += weight;
          weightedScoreSum += components[key] * weight;
          validComponentsCount++;
        }
      }

      if (activeWeightSum < 60 || validComponentsCount < 2) return null;

      const normalizedScore = weightedScoreSum / activeWeightSum;
      return Math.round(normalizedScore * 100) / 100;
    },

    // FIN-016 & FIN-051: Kredi Limiti Önerisi
    // Formül: HALF_UP(min(need, capacity) * behavior_factor, 1000 TRY)
    calculateSuggestedCreditLimit(operatingNeedLimit, cashRealizationCapacityLimit, healthScore) {
      if (healthScore === null || healthScore === undefined) return null;
      
      let behaviorFactor = 1.0;
      if (healthScore < 50) behaviorFactor = 0; // Kural: Sağlık Skoru 49 ve altı ise limit 0
      else if (healthScore >= 85) behaviorFactor = 1.00;
      else if (healthScore >= 70) behaviorFactor = 0.80;
      else if (healthScore >= 50) behaviorFactor = 0.50;

      const baseLimit = Math.min(operatingNeedLimit, cashRealizationCapacityLimit);
      const limit = baseLimit * behaviorFactor;
      
      // Nearest 1000 TRY rounding
      return Math.round(limit / 1000) * 1000;
    },

    // Ana Orkestratör: Gelen verileri hesaplar ve sonuçları obje olarak döner (Metrik Motoru BLOCKED olduğu için)
    async runFinancialAnalysis(customerId, runId, rawData) {
      const dso = this.calculateDSO(rawData.totalReceivables, rawData.totalSales, rawData.daysInPeriod);
      const cei = this.calculateCEI(rawData.eligibleAgedSettlementAmount, rawData.adjustedAgedReceivablePool);
      
      const healthComponents = {
        ...rawData.components,
        cei: cei !== null ? cei : (rawData.components ? rawData.components.cei : null)
      };
      
      const healthScore = this.calculateFinancialHealthScore(healthComponents);
      const creditLimit = this.calculateSuggestedCreditLimit(
        rawData.operatingNeedLimit, 
        rawData.cashRealizationCapacityLimit, 
        healthScore
      );

      /*
      if (metricEngineService && metricEngineService.recordMetric) {
        await metricEngineService.recordMetric(runId, customerId, 'FIN-013', dso);
        await metricEngineService.recordMetric(runId, customerId, 'FIN-014', cei);
        await metricEngineService.recordMetric(runId, customerId, 'FIN-015', healthScore);
        await metricEngineService.recordMetric(runId, customerId, 'FIN-016', creditLimit);
      }
      */
      return { 
        success: true, 
        metrics: {
          dso,
          cei,
          healthScore,
          creditLimit
        }
      };
    }
  });
}
