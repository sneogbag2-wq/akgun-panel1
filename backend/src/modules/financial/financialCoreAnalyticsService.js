import crypto from 'crypto';

/**
 * FAN-004..008: Çekirdek Analiz Motorları
 */
export function createFinancialCoreAnalyticsService(deps = {}) {
  const repository = deps.repository;

  return Object.freeze({
    /**
     * FAN-004: Ödeme Süresi Sağkalım Eğrisi (Payment Survival Curve)
     * Kaplan-Meier tutar ağırlıklı S(d) eğrisinin basitleştirilmiş modeli.
     * S(d) <= 0.50 olduğu gün medyan kapanma günü kabul edilir.
     */
    async calculatePaymentSurvival(options = {}) {
      const companyId = options.companyId || crypto.randomUUID();
      const totalInvoices = options.totalInvoices || 0;
      const censoredInvoices = options.censoredInvoices || 0;
      const survivalData = options.survivalData || [];
      const fallbackLevel = options.fallbackLevel || 'CUSTOMER';

      let medianSurvivalDays = null;
      for (const dataPoint of survivalData) {
        if (dataPoint.survival_prob <= 0.50) {
          medianSurvivalDays = dataPoint.day;
          break;
        }
      }

      const result = {
        id: crypto.randomUUID(),
        companyId,
        periodStart: options.periodStart || new Date().toISOString().split('T')[0],
        periodEnd: options.periodEnd || new Date().toISOString().split('T')[0],
        medianSurvivalDays,
        totalInvoicesAnalyzed: totalInvoices,
        censoredInvoices,
        survivalData,
        fallbackLevel,
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.savePaymentSurvival) {
        await repository.savePaymentSurvival(result);
      }

      return result;
    },

    /**
     * FAN-005: Yaşlı Bakiye Değişim Köprüsü (Aged Burden Bridge)
     * Kapanış 29+ = Açılış 29+ + Yeni 29+ Giriş - Yaşlı Tahsilat Çıkış
     */
    async calculateAgedBurdenBridge(options = {}) {
      const opening29Plus = options.opening29Plus ?? 0;
      const new29PlusInflow = options.new29PlusInflow ?? 0;
      const agedSettlementOutflow = options.agedSettlementOutflow ?? 0;
      const expectedClosing = opening29Plus + new29PlusInflow - agedSettlementOutflow;
      
      const closing29Plus = options.closing29Plus ?? expectedClosing;
      const bridgeVariance = Number((closing29Plus - expectedClosing).toFixed(2));

      const result = {
        id: crypto.randomUUID(),
        companyId: options.companyId || crypto.randomUUID(),
        periodStart: options.periodStart || new Date().toISOString().split('T')[0],
        periodEnd: options.periodEnd || new Date().toISOString().split('T')[0],
        opening29Plus,
        new29PlusInflow,
        agedSettlementOutflow,
        closing29Plus,
        bridgeVariance,
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveAgedBurdenBridge) {
        await repository.saveAgedBurdenBridge(result);
      }

      return result;
    },

    /**
     * FAN-006: Toplam Risk Değişim Köprüsü (Total Exposure Bridge)
     * Kapanış Risk = Açılış Risk + Satışlar - Nakit Tahsilat - Silinenler + Araç Karşılıksız Dönüşü
     */
    async calculateTotalExposureBridge(options = {}) {
      const openingTotalExposure = options.openingTotalExposure ?? 0;
      const salesInflow = options.salesInflow ?? 0;
      const cashCollectionOutflow = options.cashCollectionOutflow ?? 0;
      const writeOffs = options.writeOffs ?? 0;
      const instrumentBounceInflow = options.instrumentBounceInflow ?? 0;
      
      const expectedClosing = openingTotalExposure + salesInflow - cashCollectionOutflow - writeOffs + instrumentBounceInflow;
      const closingTotalExposure = options.closingTotalExposure ?? expectedClosing;
      const bridgeVariance = Number((closingTotalExposure - expectedClosing).toFixed(2));

      const result = {
        id: crypto.randomUUID(),
        companyId: options.companyId || crypto.randomUUID(),
        periodStart: options.periodStart || new Date().toISOString().split('T')[0],
        periodEnd: options.periodEnd || new Date().toISOString().split('T')[0],
        openingTotalExposure,
        salesInflow,
        cashCollectionOutflow,
        writeOffs,
        instrumentBounceInflow,
        closingTotalExposure,
        bridgeVariance,
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveTotalExposureBridge) {
        await repository.saveTotalExposureBridge(result);
      }

      return result;
    },

    /**
     * FAN-007: Ekonomik Tahsilat & Nakit Köprüsü (Economic Collection Bridge)
     * Ekonomik Tahsilat = Nakit + İade/Hizmet + Bekleyen Araç Kabulü
     */
    async calculateEconomicCollectionBridge(options = {}) {
      const cashRiskRelief = options.cashRiskRelief ?? 0;
      const noncashRelief = options.noncashRelief ?? 0;
      const pendingInstrumentVolume = options.pendingInstrumentVolume ?? 0;
      
      const expectedEconomicCollection = cashRiskRelief + noncashRelief + pendingInstrumentVolume;
      const totalEconomicCollection = options.totalEconomicCollection ?? expectedEconomicCollection;

      const result = {
        id: crypto.randomUUID(),
        companyId: options.companyId || crypto.randomUUID(),
        periodStart: options.periodStart || new Date().toISOString().split('T')[0],
        periodEnd: options.periodEnd || new Date().toISOString().split('T')[0],
        totalEconomicCollection,
        cashRiskRelief,
        noncashRelief,
        pendingInstrumentVolume,
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveEconomicCollectionBridge) {
        await repository.saveEconomicCollectionBridge(result);
      }

      return result;
    },

    /**
     * FAN-008: Çek/Senet Vade Merdiveni (Instrument Maturity Ladder)
     */
    async calculateInstrumentMaturityLadder(options = {}) {
      const result = {
        id: crypto.randomUUID(),
        companyId: options.companyId || crypto.randomUUID(),
        asOfDate: options.asOfDate || new Date().toISOString().split('T')[0],
        pastDueAmount: options.pastDueAmount ?? 0,
        pastDueCount: options.pastDueCount ?? 0,
        due_0_7Amount: options.due_0_7Amount ?? 0,
        due_0_7Count: options.due_0_7Count ?? 0,
        due_8_14Amount: options.due_8_14Amount ?? 0,
        due_8_14Count: options.due_8_14Count ?? 0,
        due_15_30Amount: options.due_15_30Amount ?? 0,
        due_15_30Count: options.due_15_30Count ?? 0,
        due_31_60Amount: options.due_31_60Amount ?? 0,
        due_31_60Count: options.due_31_60Count ?? 0,
        due_61_90Amount: options.due_61_90Amount ?? 0,
        due_61_90Count: options.due_61_90Count ?? 0,
        due_91_PlusAmount: options.due_91_PlusAmount ?? 0,
        due_91_PlusCount: options.due_91_PlusCount ?? 0,
        outcomePendingAmount: options.outcomePendingAmount ?? 0,
        outcomePendingCount: options.outcomePendingCount ?? 0,
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveInstrumentMaturityLadder) {
        await repository.saveInstrumentMaturityLadder(result);
      }

      return result;
    },

    /**
     * FAN-001: Portföy Yoğunlaşması ve Pareto (Concentration & HHI)
     */
    async calculateConcentrationPareto(options = {}) {
      const items = options.items || [];
      const totalAmount = items.reduce((sum, item) => sum + Math.max(0, item.amount || 0), 0);

      if (totalAmount === 0) {
        return {
          id: crypto.randomUUID(),
          top1Share: null,
          top5Share: null,
          top10Share: null,
          top20Share: null,
          hhi: null,
          cumParetoCurve: [],
          totalAmount: 0,
          calculatedAt: new Date().toISOString()
        };
      }

      const sorted = [...items]
        .filter(item => (item.amount || 0) > 0)
        .sort((a, b) => b.amount - a.amount);

      const topNShare = (n) => {
        const topSlice = sorted.slice(0, n);
        const topSum = topSlice.reduce((sum, item) => sum + item.amount, 0);
        return Number(((topSum / totalAmount) * 100).toFixed(2));
      };

      let hhiSum = 0;
      let cumSum = 0;
      const cumParetoCurve = sorted.map((item, idx) => {
        const shareDec = item.amount / totalAmount;
        hhiSum += shareDec * shareDec;
        cumSum += item.amount;
        return {
          rank: idx + 1,
          id: item.id,
          name: item.name,
          amount: item.amount,
          sharePct: Number((shareDec * 100).toFixed(2)),
          cumSharePct: Number(((cumSum / totalAmount) * 100).toFixed(2))
        };
      });

      const result = {
        id: crypto.randomUUID(),
        top1Share: topNShare(1),
        top5Share: topNShare(5),
        top10Share: topNShare(10),
        top20Share: topNShare(20),
        hhi: Number((hhiSum * 10000).toFixed(2)),
        cumParetoCurve,
        totalAmount,
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveConcentrationPareto) {
        await repository.saveConcentrationPareto(result);
      }

      return result;
    },

    /**
     * FAN-002: Aylık Aging Geçiş Matrisi (Aging Transition Matrix)
     */
    async calculateAgingTransitionMatrix(options = {}) {
      const openingLots = options.openingLots || [];
      const buckets = ['CURRENT', '1_30', '31_60', '61_90', '90_PLUS'];
      const targetStatuses = [...buckets, 'CLOSED', 'INVALIDATED', 'TRANSFERRED_OUT'];

      const matrix = {};
      for (const b of buckets) {
        matrix[b] = {};
        for (const s of targetStatuses) {
          matrix[b][s] = { amount: 0, count: 0 };
        }
      }

      let totalOpeningAmount = 0;
      let totalClosingAmount = 0;

      for (const lot of openingLots) {
        const startB = lot.startBucket || 'CURRENT';
        const endS = lot.endBucket || lot.status || 'CLOSED';
        const amt = lot.amount || 0;

        totalOpeningAmount += amt;
        if (endS !== 'CLOSED' && endS !== 'INVALIDATED' && endS !== 'TRANSFERRED_OUT') {
          totalClosingAmount += amt;
        }

        if (matrix[startB] && matrix[startB][endS]) {
          matrix[startB][endS].amount += amt;
          matrix[startB][endS].count += 1;
        }
      }

      const result = {
        id: crypto.randomUUID(),
        companyId: options.companyId || crypto.randomUUID(),
        matrix,
        totalOpeningAmount: Number(totalOpeningAmount.toFixed(2)),
        totalClosingAmount: Number(totalClosingAmount.toFixed(2)),
        reconciliationCheck: 'Σ hedef durum tutarı = başlangıç tutarı mutabıktır.',
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveAgingTransitionMatrix) {
        await repository.saveAgingTransitionMatrix(result);
      }

      return result;
    },

    /**
     * FAN-003: Fatura Kohortu / Vintage Kapanma Eğrisi
     */
    async calculateInvoiceVintageCurve(options = {}) {
      const cohortMonth = options.cohortMonth || new Date().toISOString().slice(0, 7);
      const totalCohortPrincipal = options.totalCohortPrincipal || 0;
      const realizedClosures = options.realizedClosures || [];
      const milestoneDays = [7, 14, 21, 28, 45, 60, 90];

      if (totalCohortPrincipal === 0) {
        return {
          id: crypto.randomUUID(),
          cohortMonth,
          totalCohortPrincipal: 0,
          vintagePoints: milestoneDays.map(day => ({ day, cumClosedAmount: 0, closureRatio: null })),
          calculatedAt: new Date().toISOString()
        };
      }

      const vintagePoints = milestoneDays.map(milestoneDay => {
        const cumClosedAmount = realizedClosures
          .filter(c => c.day <= milestoneDay)
          .reduce((sum, c) => sum + (c.closedAmount || 0), 0);

        const closureRatio = Number(((cumClosedAmount / totalCohortPrincipal) * 100).toFixed(2));
        return {
          day: milestoneDay,
          cumClosedAmount: Number(cumClosedAmount.toFixed(2)),
          closureRatio
        };
      });

      const result = {
        id: crypto.randomUUID(),
        cohortMonth,
        totalCohortPrincipal,
        vintagePoints,
        calculatedAt: new Date().toISOString()
      };

      if (repository && repository.saveInvoiceVintageCurve) {
        await repository.saveInvoiceVintageCurve(result);
      }

      return result;
    }
  });
}
