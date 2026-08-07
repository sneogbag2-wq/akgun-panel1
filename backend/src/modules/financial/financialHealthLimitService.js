import crypto from 'crypto';

/**
 * AI-17: Müşteri Finansal Sağlığı, İç Limitler ve Temsilci/SSM Performansı
 * HLT-001, HLT-002, LIM-001, LIM-002, PRF-001, PRF-002
 */
export function createFinancialHealthLimitService(deps = {}) {
  const repository = deps.repository;

  /**
   * Sağlık skorunu 0-100 aralığına kırpar.
   */
  function capScore(score) {
    return Math.min(100, Math.max(0, Number(score.toFixed(2))));
  }

  /**
   * 0-100 skora göre kategori döner.
   */
  function resolveCategory(score) {
    if (score >= 85) return 'EXCELLENT';
    if (score >= 70) return 'GOOD';
    if (score >= 50) return 'FAIR';
    if (score >= 30) return 'POOR';
    return 'CRITICAL';
  }

  return Object.freeze({

    /**
     * HLT-001: Müşteri Finansal Sağlık Skoru
     * Katalog 1.3: Null component 0 değildir. Aktif başlangıç ağırlığı <%60 veya uygun bileşen <2 ise skor yayımlanmaz.
     */
    calculateHealthScore(options = {}) {
      const collectionRateInput = options.collectionRate;
      const agingDropRatioInput = options.agingDropRatio;
      const instrumentRiskRatioInput = options.instrumentRiskRatio;
      const paymentSpeedDaysInput = options.paymentSpeedDays;
      const { customerId, companyId } = options;

      const baseWeights = {
        collection: 0.35,
        agingDrop: 0.30,
        instrumentRisk: 0.20,
        paymentSpeed: 0.15
      };

      // Eğer hiçbir parametre verilmediyse veya sadece kısmi verilmiş ve null yapılmamışsa varsayılanlar kullanılır
      const cVal = collectionRateInput !== null ? (collectionRateInput ?? 0) : null;
      const aVal = agingDropRatioInput !== null ? (agingDropRatioInput ?? 0) : null;
      const iVal = instrumentRiskRatioInput !== null ? (instrumentRiskRatioInput ?? 0) : null;
      const pVal = paymentSpeedDaysInput !== null ? (paymentSpeedDaysInput ?? 60) : null;

      const validComponents = [];
      let activeWeightSum = 0;

      // 1. Tahsilat Oranı
      if (cVal !== null) {
        const score = capScore(cVal * 100);
        const w = baseWeights.collection;
        activeWeightSum += w;
        validComponents.push({ componentName: 'collection', componentScore: score, baseWeight: w, impactPoints: score * w, reason: 'Ay içi tahsilat/fatura oranı' });
      }

      // 2. Yaşlı Borç Düşüş Oranı
      if (aVal !== null) {
        const score = capScore(aVal * 100);
        const w = baseWeights.agingDrop;
        activeWeightSum += w;
        validComponents.push({ componentName: 'aging_drop', componentScore: score, baseWeight: w, impactPoints: score * w, reason: 'Vadesi geçmiş borç stoku erime oranı' });
      }

      // 3. Çek/Senet Risk Yoğunluğu
      if (iVal !== null) {
        const score = capScore((1 - Math.min(iVal, 1)) * 100);
        const w = baseWeights.instrumentRisk;
        activeWeightSum += w;
        validComponents.push({ componentName: 'instrument_risk', componentScore: score, baseWeight: w, impactPoints: score * w, reason: 'Araç (çek/senet) riski yoğunluğu' });
      }

      // 4. Ödeme Hızı
      if (pVal !== null) {
        const score = capScore(Math.max(0, 1 - pVal / 90) * 100);
        const w = baseWeights.paymentSpeed;
        activeWeightSum += w;
        validComponents.push({ componentName: 'payment_speed', componentScore: score, baseWeight: w, impactPoints: score * w, reason: `Ortalama ödeme süresi: ${pVal} gün` });
      }

      // Kataloğun 1.3 Kapısı: Aktif başlangıç ağırlığı <%60 veya uygun bileşen <2 ise skor yayımlanmaz (null döner)
      if (activeWeightSum < 0.60 || validComponents.length < 2) {
        return {
          id: crypto.randomUUID(),
          companyId: companyId || crypto.randomUUID(),
          customerId: customerId || crypto.randomUUID(),
          healthScore: null,
          category: 'UNPUBLISHED_DATA_INSUFFICIENT',
          confidence: 'LOW',
          activeWeight: Number((activeWeightSum * 100).toFixed(2)),
          validComponentCount: validComponents.length,
          components: validComponents,
          isPublished: false,
          reason: `Aktif ağırlık %${(activeWeightSum * 100).toFixed(0)} (<%60) veya geçerli bileşen adedi ${validComponents.length} (<2) olduğundan skor yayımlanamaz.`,
          calculatedAt: new Date().toISOString()
        };
      }

      // Ağırlıkları re-normalize et ve skoru hesapla
      let rawScoreSum = 0;
      for (const comp of validComponents) {
        const normalizedWeight = comp.baseWeight / activeWeightSum;
        rawScoreSum += comp.componentScore * normalizedWeight;
      }

      const healthScore = capScore(rawScoreSum);
      const category = resolveCategory(healthScore);
      const confidence = (activeWeightSum >= 0.85 && validComponents.length >= 3) ? 'HIGH' : 'MEDIUM';

      return {
        id: crypto.randomUUID(),
        companyId: companyId || crypto.randomUUID(),
        customerId: customerId || crypto.randomUUID(),
        healthScore,
        category,
        confidence,
        activeWeight: Number((activeWeightSum * 100).toFixed(2)),
        validComponentCount: validComponents.length,
        components: validComponents,
        isPublished: true,
        calculatedAt: new Date().toISOString()
      };
    },

    /**
     * LIM-001 + LIM-002: İç Kredi Limiti Önerisi ve Tarihçe
     * Katalog 1.3: Need P75, cash capacity P25, behavior factor, governed limit
     */
    calculateInternalLimit(options = {}) {
      const {
        healthScore = 0,
        baseLimitAmount = 100000,
        currentUsage = 0,
        needP75 = null,
        cashCapacityP25 = null,
        previousLimit = null,
        customerId,
        companyId,
      } = options;

      let behaviorFactor = 0;
      if (healthScore !== null && healthScore >= 85)      behaviorFactor = 1.2;
      else if (healthScore !== null && healthScore >= 70) behaviorFactor = 1.0;
      else if (healthScore !== null && healthScore >= 50) behaviorFactor = 0.8;
      else if (healthScore !== null && healthScore >= 30) behaviorFactor = 0.4;
      else                                                behaviorFactor = 0.0;

      let limitMultiplier = 0;
      if (healthScore !== null && healthScore >= 85)      limitMultiplier = 2.5;
      else if (healthScore !== null && healthScore >= 70) limitMultiplier = 2.0;
      else if (healthScore !== null && healthScore >= 50) limitMultiplier = 1.5;
      else if (healthScore !== null && healthScore >= 30) limitMultiplier = 0.75;
      else                                                limitMultiplier = 0.0;

      let recommendedLimit = 0;
      if (healthScore === null || healthScore < 30) {
        recommendedLimit = 0;
      } else if (needP75 !== null || cashCapacityP25 !== null) {
        const capacityLimit = (cashCapacityP25 || baseLimitAmount) * behaviorFactor;
        const targetLimit = needP75 !== null ? Math.min(needP75, capacityLimit) : capacityLimit;
        recommendedLimit = Number(targetLimit.toFixed(2));
      } else {
        recommendedLimit = Number((baseLimitAmount * limitMultiplier).toFixed(2));
      }

      const headroom = Number(Math.max(0, recommendedLimit - currentUsage).toFixed(2));
      const hasChange = previousLimit !== null && previousLimit !== recommendedLimit;

      const history = hasChange ? {
        id: crypto.randomUUID(),
        companyId: companyId || crypto.randomUUID(),
        customerId: customerId || crypto.randomUUID(),
        previousLimit,
        newLimit: recommendedLimit,
        changeReason: healthScore === null
          ? 'Yetersiz veri nedeniyle limit sıfırlandı'
          : `Sağlık skoru değişimi: ${healthScore.toFixed(1)}/100`,
        triggeredBy: 'HEALTH_SCORE',
        changedAt: new Date().toISOString(),
      } : null;

      return {
        id: crypto.randomUUID(),
        companyId: companyId || crypto.randomUUID(),
        customerId: customerId || crypto.randomUUID(),
        healthScore,
        behaviorFactor,
        needP75,
        cashCapacityP25,
        recommendedLimit,
        governedLimit: recommendedLimit,
        currentUsage,
        headroom,
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        history,
        calculatedAt: new Date().toISOString(),
      };
    },

    /**
     * PRF-001: Temsilci Finansal Performans Karnesi
     * collectionRate: Tahsilat Başarısı (0-1)
     * ceiRate: CEI oranı (0-1)
     * limitBreachCount: Limit aşım sayısı (0 = tam puan)
     */
    calculateRepPerformance(options = {}) {
      const {
        representativeId,
        representativeName = 'Bilinmeyen Temsilci',
        companyId,
        periodLabel = '',
        collectionRate = 0,
        ceiRate = 0,
        limitBreachCount = 0,
      } = options;

      const collectionScore    = capScore(collectionRate * 100);
      const ceiScore           = capScore(ceiRate * 100);
      // Her limit aşımı için -10 puan, minimum 0
      const limitDisciplineScore = capScore(Math.max(0, 100 - limitBreachCount * 10));

      // Ağırlıklar: Tahsilat %50, CEI %30, Limit Disiplini %20
      const overallScore = capScore(
        (collectionScore * 0.50) +
        (ceiScore * 0.30) +
        (limitDisciplineScore * 0.20)
      );

      return {
        id: crypto.randomUUID(),
        companyId: companyId || crypto.randomUUID(),
        representativeId: representativeId || crypto.randomUUID(),
        representativeName,
        periodLabel,
        overallScore,
        collectionScore,
        ceiScore,
        limitDisciplineScore,
        calculatedAt: new Date().toISOString(),
      };
    },

    /**
     * PRF-002: SSM (Bölge) Finansal Performans Karnesi
     * repPerformances: PRF-001 sonuçlarının listesi
     */
    calculateSsmPerformance(options = {}) {
      const {
        ssmId,
        ssmName = 'Bilinmeyen Bölge',
        companyId,
        periodLabel = '',
        repPerformances = [],  // PRF-001 nesneleri dizisi
      } = options;

      if (repPerformances.length === 0) {
        return {
          id: crypto.randomUUID(),
          companyId: companyId || crypto.randomUUID(),
          ssmId: ssmId || crypto.randomUUID(),
          ssmName,
          periodLabel,
          overallScore: null,
          ceiScore: null,
          limitDisciplineScore: null,
          repCount: 0,
          calculatedAt: new Date().toISOString(),
        };
      }

      const avg = (key) => {
        const vals = repPerformances.map(r => r[key] ?? 0);
        return capScore(vals.reduce((a, b) => a + b, 0) / vals.length);
      };

      return {
        id: crypto.randomUUID(),
        companyId: companyId || crypto.randomUUID(),
        ssmId: ssmId || crypto.randomUUID(),
        ssmName,
        periodLabel,
        overallScore:           avg('overallScore'),
        ceiScore:               avg('ceiScore'),
        limitDisciplineScore:   avg('limitDisciplineScore'),
        repCount:               repPerformances.length,
        calculatedAt:           new Date().toISOString(),
      };
    },
  });
}
