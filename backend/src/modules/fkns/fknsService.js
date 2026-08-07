export function createFknsService(metricEngineService = null) {
  return Object.freeze({
    // FKNS-001 denominator_general: Kapsamdaki benzersiz uygun aktif müşteri sayısı (Target Evreni)
    calculateDenominatorGeneral(uniqueTargetCustomers) {
      if (uniqueTargetCustomers == null || uniqueTargetCustomers <= 0) return null;
      return Number(uniqueTargetCustomers);
    },

    // FKNS-002 numerator_invoice: En az 1 geçerli pozitif faturalama belgesi olan alıcı müşteri sayısı
    calculateNumeratorInvoice(uniqueBuyingCustomers) {
      if (uniqueBuyingCustomers == null || uniqueBuyingCustomers < 0) return null;
      return Number(uniqueBuyingCustomers);
    },

    // FKNS-003 rate_general: Genel FKNS Oranı (100 * FKNS-002 / FKNS-001)
    calculateRateGeneral(numeratorInvoice, denominatorGeneral) {
      if (!denominatorGeneral || denominatorGeneral <= 0) return null;
      if (numeratorInvoice == null || numeratorInvoice < 0) return null;
      const rate = (numeratorInvoice / denominatorGeneral) * 100;
      return Math.round(rate * 100) / 100;
    },

    // FKNS-004 denominator_channel: Açık/Kapalı kanal bazı müşteri evreni
    calculateDenominatorChannel(channelTargetCustomers) {
      if (channelTargetCustomers == null || channelTargetCustomers <= 0) return null;
      return Number(channelTargetCustomers);
    },

    // FKNS-006 numerator_product: Ürünü alan uygun müşteri adedi
    calculateNumeratorProduct(productBuyingCustomers) {
      if (productBuyingCustomers == null || productBuyingCustomers < 0) return null;
      return Number(productBuyingCustomers);
    },

    // FKNS-008 rate_product_or: 100 * FKNS-006 / FKNS-007
    calculateRateProductOr(numeratorProduct, denominatorProductOr) {
      if (!denominatorProductOr || denominatorProductOr <= 0) return null;
      if (numeratorProduct == null || numeratorProduct < 0) return null;
      const rate = (numeratorProduct / denominatorProductOr) * 100;
      return Math.round(rate * 100) / 100;
    },

    // Legacy / Yardımcı Metotlar (Geriye Dönük Uyumluluk)
    calculateCoverage(activeDays, expectedDays) {
      if (expectedDays <= 0) return null;
      const coverage = (activeDays / expectedDays) * 100;
      return Math.round(coverage * 100) / 100;
    },

    calculatePointPenetration(uniqueBuyers, totalTargetCustomers) {
      if (totalTargetCustomers <= 0) return null;
      const point = (uniqueBuyers / totalTargetCustomers) * 100;
      return Math.round(point * 100) / 100;
    },

    calculateFrequency(totalInvoices, uniqueBuyers) {
      if (uniqueBuyers <= 0) return null;
      const freq = totalInvoices / uniqueBuyers;
      return Math.round(freq * 100) / 100;
    },

    // Ana Orkestratör: SISTEM_HESAPLAMA_MATRISI.md standartlarına tam uyumlu
    async runFknsAnalysis(regionId, runId, rawFknsData) {
      if (!metricEngineService) {
        throw new Error('metricEngineService is required for orchestration');
      }

      // Matris standartlarına göre FKNS-001 (Payda Müşteri), FKNS-002 (Pay Müşteri), FKNS-003 (Genel Oran %)
      const targetCount = rawFknsData.totalTargetCustomers ?? rawFknsData.uniqueTargetCustomers;
      const buyerCount = rawFknsData.uniqueBuyers ?? rawFknsData.uniqueBuyingCustomers;

      const fkns001 = this.calculateDenominatorGeneral(targetCount);
      const fkns002 = this.calculateNumeratorInvoice(buyerCount);
      const fkns003 = this.calculateRateGeneral(fkns002, fkns001);

      if (fkns001 !== null) await metricEngineService.recordMetric(runId, regionId, 'FKNS-001', fkns001);
      if (fkns002 !== null) await metricEngineService.recordMetric(runId, regionId, 'FKNS-002', fkns002);
      if (fkns003 !== null) await metricEngineService.recordMetric(runId, regionId, 'FKNS-003', fkns003);

      return { success: true, FKNS_001: fkns001, FKNS_002: fkns002, FKNS_003: fkns003 };
    }
  });
}

