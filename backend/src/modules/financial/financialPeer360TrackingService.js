import crypto from 'crypto';

/**
 * FAN-022, FAN-023, FAN-024: Eş Grup Kıyaslama, Müşteri 360 ve Takip Önerisi Ölçümü
 */
export function createFinancialPeer360TrackingService(deps = {}) {
  const repository = deps.repository;

  return Object.freeze({

    /**
     * FAN-022: Eş Grup ve Dönem Kıyasları
     * Akran grubu en az 10 birim içermelidir, aksi takdirde COMPANY_FALLBACK uygulanır.
     */
    calculatePeerGroupComparison(options = {}) {
      const {
        entityType = 'CUSTOMER',
        entityId = crypto.randomUUID(),
        companyId = crypto.randomUUID(),
        metricCode = 'DSO',
        entityValue = 0,
        peerValues = [], // Akran değerler dizisi
        peerGroupType = 'CHANNEL',
      } = options;

      const isFallback = peerValues.length < 10;
      const effectiveGroupType = isFallback ? 'COMPANY_FALLBACK' : peerGroupType;

      let p25 = 0;
      let median = 0;
      let p75 = 0;
      let percentileRank = 50;

      if (peerValues.length > 0) {
        const sorted = [...peerValues].sort((a, b) => a - b);
        const len = sorted.length;

        p25 = sorted[Math.floor(len * 0.25)] ?? 0;
        median = sorted[Math.floor(len * 0.50)] ?? 0;
        p75 = sorted[Math.floor(len * 0.75)] ?? 0;

        // CUME_DIST percentile calculation
        const countLessOrEqual = sorted.filter(v => v <= entityValue).length;
        percentileRank = Number(((countLessOrEqual / len) * 100).toFixed(2));
      }

      return {
        id: crypto.randomUUID(),
        companyId,
        entityType,
        entityId,
        metricCode,
        peerGroupType: effectiveGroupType,
        peerGroupSize: peerValues.length,
        entityValue,
        percentileRank,
        p25Value: Number(p25.toFixed(2)),
        medianValue: Number(median.toFixed(2)),
        p75Value: Number(p75.toFixed(2)),
        isFallback,
        calculatedAt: new Date().toISOString(),
      };
    },

    /**
     * FAN-023: Müşteri 360 Finansal Özet
     * Bağımsız metrikleri tek bir konsolide sözleşmede birleştirir.
     */
    generateCustomer360Summary(options = {}) {
      const {
        customerId = crypto.randomUUID(),
        companyId = crypto.randomUUID(),
        periodLabel = '2026-07',
        totalBalance = 0,
        openInstrumentRisk = 0,
        dsoDays = 0,
        ceiPercent = 0,
        healthScore = 50,
        recommendedLimit = 0,
        activeWarningsCount = 0,
        behaviorSegment = 'SAGLIKLI_DONGU',
        metricResultIds = [],
      } = options;

      const totalRisk = Number((totalBalance + openInstrumentRisk).toFixed(2));
      const limitUsagePercent = recommendedLimit > 0
        ? Number(((totalRisk / recommendedLimit) * 100).toFixed(2))
        : 0;

      return {
        id: crypto.randomUUID(),
        companyId,
        customerId,
        periodLabel,
        totalBalance,
        openInstrumentRisk,
        totalRisk,
        dsoDays,
        ceiPercent,
        healthScore,
        recommendedLimit,
        limitUsagePercent,
        activeWarningsCount,
        behaviorSegment,
        metricResultIds,
        calculatedAt: new Date().toISOString(),
      };
    },

    /**
     * FAN-024: Takip Önerisi Sonuç Ölçümü
     * PRESENTED, OPENED, CONVERTED, DISMISSED, EXPIRED durumlarını ve 7/14/30 günlük nakit rahatlamasını izler.
     */
    trackRecommendationConversion(options = {}) {
      const {
        recommendationId = crypto.randomUUID(),
        customerId = crypto.randomUUID(),
        companyId = crypto.randomUUID(),
        status = 'PRESENTED',
        initialRiskAmount = 0,
        actionTakenAt = null,
        relief7dAmount = 0,
        relief14dAmount = 0,
        relief30dAmount = 0,
        associationType = 'TEMPORAL_ASSOCIATION',
      } = options;

      const validStatuses = ['PRESENTED', 'OPENED', 'CONVERTED', 'DISMISSED', 'EXPIRED'];
      const effectiveStatus = validStatuses.includes(status) ? status : 'PRESENTED';

      const conversionRate7d = initialRiskAmount > 0 ? Number(((relief7dAmount / initialRiskAmount) * 100).toFixed(2)) : 0;
      const conversionRate30d = initialRiskAmount > 0 ? Number(((relief30dAmount / initialRiskAmount) * 100).toFixed(2)) : 0;

      return {
        id: crypto.randomUUID(),
        companyId,
        recommendationId,
        customerId,
        status: effectiveStatus,
        initialRiskAmount,
        actionTakenAt,
        relief7dAmount,
        relief14dAmount,
        relief30dAmount,
        conversionRate7d,
        conversionRate30d,
        associationType, // AI "tahsil etti" diyemez, kesinlikle TEMPORAL/DESCRIPTIVE kalır
        createdAt: new Date().toISOString(),
      };
    },

  });
}
