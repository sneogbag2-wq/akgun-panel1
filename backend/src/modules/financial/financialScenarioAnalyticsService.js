import crypto from 'crypto';

/**
 * FAN-015..019: Stres Senaryoları, Tahsilat Önceliği ve Restatement
 */
export function createFinancialScenarioAnalyticsService(deps = {}) {
  const repository = deps.repository;

  return Object.freeze({
    /**
     * FAN-015: Açıklanabilir Tahsilat Takip Önceliği
     */
    async calculateCollectionPriority(options = {}) {
      const {
        riskMateriality = 0,   // %30
        agingSeverity = 0,     // %25
        instrumentRisk = 0,    // %20
        recentDeterioration = 0, // %15
        limitBreach = 0,       // %10
        weightsProvided = []
      } = options;

      let score = null;
      let isManualReview = false;
      
      const totalWeight = weightsProvided.reduce((a, b) => a + b, 0);

      // Ağırlık toplamı %60 altındaysa (kapsam eksikliği) veya manuel çatışma varsa
      if (totalWeight < 60 || options.forceManualReview) {
        isManualReview = true;
      } else {
        // Normalize the score based on active weights
        const rawScore = (riskMateriality * 0.30) +
                         (agingSeverity * 0.25) +
                         (instrumentRisk * 0.20) +
                         (recentDeterioration * 0.15) +
                         (limitBreach * 0.10);
        
        score = Number((rawScore * (100 / totalWeight)).toFixed(2));
      }

      const result = {
        id: crypto.randomUUID(),
        companyId: options.companyId || crypto.randomUUID(),
        customerId: options.customerId || crypto.randomUUID(),
        score,
        isManualReview,
        riskMaterialityScore: riskMateriality,
        agingSeverityScore: agingSeverity,
        instrumentRiskScore: instrumentRisk,
        recentDeteriorationScore: recentDeterioration,
        limitBreachScore: limitBreach,
        activeWeightsSum: totalWeight,
        top3Reasons: options.top3Reasons || [],
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveCollectionPriorityScore) {
        await repository.saveCollectionPriorityScore(result);
      }
      return result;
    },

    /**
     * FAN-016: Stres ve Senaryo Motoru
     */
    async runStressScenarioEngine(options = {}) {
      const baseExposure = options.baseExposure ?? 0;
      const scenarioType = options.scenarioType || 'COLLECTION_MINUS_25';
      let scenarioExposure = baseExposure;

      if (scenarioType === 'COLLECTION_MINUS_25') {
        // Tahsilatın %25 eksik gelmesi durumu (örneğin exposure artar)
        scenarioExposure = baseExposure * 1.25; 
      }

      const impactAmount = Number((scenarioExposure - baseExposure).toFixed(2));

      const result = {
        id: crypto.randomUUID(),
        companyId: options.companyId || crypto.randomUUID(),
        scenarioType,
        baseExposure,
        scenarioExposure: Number(scenarioExposure.toFixed(2)),
        impactAmount,
        assumptions: options.assumptions || {},
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveStressScenarioResult) {
        await repository.saveStressScenarioResult(result);
      }
      return result;
    },

    /**
     * FAN-017: En Büyük Karşı Taraf Kaybı Testi
     */
    async runCounterpartyLossTest(options = {}) {
      const totalExposureAtRisk = options.totalExposureAtRisk ?? 0;
      // Default durumunda kaybedilecek tahmini nakit
      const cashImpactAmount = Number((totalExposureAtRisk * (options.lossRate || 1.0)).toFixed(2));

      const result = {
        id: crypto.randomUUID(),
        companyId: options.companyId || crypto.randomUUID(),
        scenarioHorizon: options.scenarioHorizon || 'TOP_5_DEFAULT',
        defaultedCustomerIds: options.defaultedCustomerIds || [],
        totalExposureAtRisk,
        cashImpactAmount,
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveCounterpartyLossTest) {
        await repository.saveCounterpartyLossTest(result);
      }
      return result;
    },

    /**
     * FAN-018: Yönetimsel Beklenen Zarar Senaryosu (ECL)
     * Expected Loss = EAD * PD * LGD
     */
    async calculateExpectedLossScenario(options = {}) {
      const ead = options.eadAmount ?? 0;
      const pd = options.pdRate ?? 0;
      const lgd = options.lgdRate ?? 0;

      let expectedLoss = null;
      let isScenarioOnly = false;

      // Event/Recovery modeli yoksa
      if (options.hasSufficientData === false) {
        isScenarioOnly = true;
      }

      expectedLoss = Number((ead * pd * lgd).toFixed(2));

      const result = {
        id: crypto.randomUUID(),
        companyId: options.companyId || crypto.randomUUID(),
        customerId: options.customerId || null,
        segmentId: options.segmentId || 'UNKNOWN',
        eadAmount: ead,
        pdRate: pd,
        lgdRate: lgd,
        expectedLossAmount: expectedLoss,
        isScenarioOnly,
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveExpectedLossScenario) {
        await repository.saveExpectedLossScenario(result);
      }
      return result;
    },

    /**
     * FAN-019: Yeniden Açıklama (Restatement) Etkisi
     */
    async calculateRestatementImpact(options = {}) {
      const originalValue = options.originalPublishedValue ?? 0;
      const currentValue = options.currentRecalculatedValue ?? 0;
      const varianceAmount = Number((currentValue - originalValue).toFixed(2));

      const result = {
        id: crypto.randomUUID(),
        companyId: options.companyId || crypto.randomUUID(),
        periodLabel: options.periodLabel || '2026-07',
        metricCode: options.metricCode || 'UNKNOWN',
        originalPublishedValue: originalValue,
        currentRecalculatedValue: currentValue,
        varianceAmount,
        varianceReasons: options.varianceReasons || { late_upload: 0, user_correction: 0 },
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveRestatementImpact) {
        await repository.saveRestatementImpact(result);
      }
      return result;
    }
  });
}
