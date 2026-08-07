export function createFinancialReadService(deps = {}) {
  const repository = deps.repository;

  return Object.freeze({
    /**
     * FIN-014: Collection Effectiveness Index (CEI)
     * SISTEM_HESAPLAMA_MATRISI.md Bölüm 12 kuralı:
     * 100 * eligible_aged_settlement_amount / adjusted_aged_receivable_pool
     * Havuz: 29+ yaşındaki alacaklar + dönem içi 29+ olan + virman giriş - virman çıkış
     * Pay: 29+ faturalara uygulanan nakit/havale/çek/senet/iade/hizmet tahsilatı.
     */
    async calculateCEI(customerId) {
      if (!repository) throw new Error('Repository is required');
      const lots = await repository.getReceivableLots(customerId) || [];
      
      let totalAgedReceivablePool = 0;
      let eligibleAgedSettlement = 0;
      
      lots.forEach(lot => {
        const isAgedOver28 = lot.age_days >= 29 || lot.status === 'OVERDUE';
        if (isAgedOver28) {
          const poolAmount = lot.adjusted_pool_amount ?? lot.amount ?? 0;
          totalAgedReceivablePool += poolAmount;

          if (lot.collection_type !== 'DEVIR_ALACAK' && lot.collection_type !== 'VIRMAN_OUT') {
            const settled = lot.eligible_settlement_amount ?? lot.collected_amount ?? 0;
            eligibleAgedSettlement += settled;
          }
        }
      });
      
      if (totalAgedReceivablePool === 0) return { cei: 100, metric_result_id: null, raw_total_receivable: 0, raw_total_collected: 0 };
      const cei = (eligibleAgedSettlement / totalAgedReceivablePool) * 100;
      const clampedCEI = Math.max(0, Math.min(100, Math.round(cei * 100) / 100));
      return { 
        cei: clampedCEI, 
        raw_total_receivable: totalAgedReceivablePool, 
        raw_total_collected: eligibleAgedSettlement 
      };
    },

    /**
     * FIN-015: Finansal Sağlık Skoru
     * SISTEM_HESAPLAMA_MATRISI.md kuralı:
     * 5 Bileşenli Ağırlıklandırma:
     * 1) Aging (%35)
     * 2) CEI (%25)
     * 3) Exposure Burden (%20)
     * 4) Close Behavior (%10)
     * 5) Instrument Reliability (%10)
     * DSO KESİNLİKLE SKOR BİLEŞENİ DEĞİLDİR (FIN-049).
     * Coverage %60 altında ise BLOCKED_DATA.
     */
    async calculateHealthScore(customerId) {
      if (!repository) throw new Error('Repository is required');
      const components = await repository.getHealthScoreComponents(customerId) || {};
      
      // %60 coverage gate
      if ((components.coverage || 0) < 60) {
         return { healthScore: null, riskLevel: 'BLOCKED_DATA', riskColor: 'gray', risk_flags: ['COVERAGE_INCOMPLETE'] };
      }
      
      const agingScore = components.aging_score ?? 100;
      const ceiScore = components.cei_score ?? (components.cei != null ? components.cei : 100);
      const exposureScore = components.exposure_score ?? 100;
      const closeBehaviorScore = components.close_behavior_score ?? (components.payment_trend ?? 100);
      const instrumentScore = components.instrument_reliability_score ?? 100;

      // 5 bileşenli matris formülü (%35, %25, %20, %10, %10)
      const score = (agingScore * 0.35) + 
                    (ceiScore * 0.25) + 
                    (exposureScore * 0.20) + 
                    (closeBehaviorScore * 0.10) + 
                    (instrumentScore * 0.10);
      
      let riskLevel = 'LOW_RISK';
      let color = 'green';
      
      if (score < 50) { riskLevel = 'HIGH_RISK'; color = 'red'; }
      else if (score < 75) { riskLevel = 'ATTENTION'; color = 'orange'; }
      
      return { 
        healthScore: Math.round(score), 
        riskLevel, 
        riskColor: color, 
        confidence: components.coverage,
        risk_flags: components.flags || [],
        dso_context: components.dso || components.dso_score || null, // DSO yalnız context olarak saklanır
        metric_result_id: components.result_id || 'mock-id-phase2'
      };
    },

    /**
     * FIN-016: Kredi Limiti Motoru
     * SISTEM_HESAPLAMA_MATRISI.md kuralı:
     * min(operating_need_limit, cash_capacity_limit) * limit_behavior_factor
     * cash_capacity_limit = cash_capacity * 0.25 (%25 muhafazakar quantile)
     * limit_behavior_factor = Sağlık skoruna bağlı (85-100: 1.0, 70-84: 0.8, 50-69: 0.5, <50: 0.25)
     * 1000 TL yuvarlama.
     */
    async calculateCreditLimit(customerId) {
      if (!repository) throw new Error('Repository is required');
      const factors = await repository.getLimitFactors(customerId) || {};
      
      const operatingNeed = factors.operating_need || 0;
      const cashCapacity = (factors.cash_capacity || 0) * 0.25; // %25 muhafazakar nakit kısıtı
      
      // Davranış faktörü sağlık skoruna bağlı
      let behaviorFactor = factors.behavior_factor;
      if (behaviorFactor == null && factors.health_score != null) {
        const hs = factors.health_score;
        if (hs >= 85) behaviorFactor = 1.0;
        else if (hs >= 70) behaviorFactor = 0.8;
        else if (hs >= 50) behaviorFactor = 0.5;
        else behaviorFactor = 0.25;
      }
      if (behaviorFactor == null) behaviorFactor = 1.0;
      
      let rawLimit = Math.min(operatingNeed, cashCapacity) * behaviorFactor;
      
      // 1000 TL yuvarlama
      let effectiveLimit = Math.round(rawLimit / 1000) * 1000;
      
      return {
        operating_need: operatingNeed,
        cash_capacity: cashCapacity,
        behavior_factor: behaviorFactor,
        effective_limit: effectiveLimit,
        headroom: effectiveLimit - (factors.current_total_exposure || 0),
        stress_results: factors.stress_scenarios || {},
        metric_result_id: factors.result_id || 'mock-id-phase2'
      };
    }
  });
}

