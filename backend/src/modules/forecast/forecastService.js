export function createForecastService(metricEngineService = null) {
  return Object.freeze({
    // FCST-001: Net Günlük Talep / Ortalama Günlük Tahmin
    calculateForecast(historicalSales, historicalDays) {
      if (!historicalDays || historicalDays <= 0) return null; // Null Policy
      if (historicalSales == null || historicalSales < 0) return null;
      const forecast = historicalSales / historicalDays;
      return Math.round(forecast * 100) / 100;
    },

    // SS-001 protection_horizon_days: Koruma süresi günü H (SISTEM_HESAPLAMA_MATRISI.md Bölüm 9)
    calculateProtectionHorizon(hDays = 14) {
      if (hDays == null || hDays <= 0) return 14;
      return Number(hDays);
    },

    // SS-002 protection_demand: Koruma süresi talebi = H gün boyunca günlük talep toplamı
    calculateProtectionDemand(dailyDemand, hDays = 14) {
      if (dailyDemand == null || dailyDemand < 0 || !hDays || hDays <= 0) return null;
      return Math.round(dailyDemand * hDays * 100) / 100;
    },

    // SS-007 active_safety_stock: Aktif Güvenlik Stoğu (Tampon gün stoğu / Quantile)
    calculateActiveSafetyStock(dailyDemand, bufferDays = 7) {
      if (dailyDemand == null || dailyDemand < 0 || bufferDays == null || bufferDays < 0) return null;
      return Math.round(dailyDemand * bufferDays * 100) / 100;
    },

    // SS-008 critical_threshold: Koruma Süresi Talebi + Aktif SS
    calculateCriticalThreshold(protectionDemand, activeSafetyStock) {
      if (protectionDemand == null || activeSafetyStock == null) return null;
      return Math.round((protectionDemand + activeSafetyStock) * 100) / 100;
    },

    // ORD-001 net_order_litres: max(0, gross_target_stock_need - stock_position)
    calculateNetOrderLitres(grossNeed, stockPosition) {
      if (grossNeed == null || stockPosition == null) return null;
      const order = grossNeed - stockPosition;
      return order < 0 ? 0 : Math.round(order * 100) / 100;
    },

    // ORD-002 / ORD-003 / ORD-005: Paket yuvarlama ve ikmal varyant miktarı
    calculatePackageOrder(netOrderLitres, litresPerUnit) {
      if (netOrderLitres == null || !litresPerUnit || litresPerUnit <= 0) return null;
      const rawQty = netOrderLitres / litresPerUnit; // ORD-002
      const roundedQty = Math.ceil(rawQty); // ORD-003
      const finalLitres = roundedQty * litresPerUnit; // ORD-005
      return { rawQty, roundedQty, finalLitres };
    },

    // Legacy / Yardımcı Metotlar (Geriye Dönük Uyumluluk)
    calculateSafetyStock(maxDailySales, maxLeadTime, avgDailySales, avgLeadTime) {
      if (
        maxDailySales == null || 
        maxLeadTime == null || 
        avgDailySales == null || 
        avgLeadTime == null
      ) {
        return null;
      }
      const maxDemand = maxDailySales * maxLeadTime;
      const avgDemand = avgDailySales * avgLeadTime;
      const safetyStock = maxDemand - avgDemand;
      return safetyStock < 0 ? 0 : Math.round(safetyStock * 100) / 100;
    },

    calculateOrderProposal(currentStock, safetyStock, forecastDemand, avgLeadTime) {
      if (
        currentStock == null || 
        safetyStock == null || 
        forecastDemand == null || 
        avgLeadTime == null
      ) {
        return null;
      }
      const reorderPoint = (forecastDemand * avgLeadTime) + safetyStock;
      const order = reorderPoint - currentStock;
      return order < 0 ? 0 : Math.round(order * 100) / 100;
    },

    // Ana Orkestratör: SISTEM_HESAPLAMA_MATRISI.md standartlarında zincirleme hesaplar
    async runForecastAnalysis(productId, runId, rawData) {
      if (!metricEngineService) {
        throw new Error('metricEngineService is required for orchestration');
      }

      // 1. FCST-001: Günlük Tahmin
      const forecast = this.calculateForecast(rawData.historicalSales, rawData.historicalDays);

      // 2. SS-007 / SS-001: Güvenlik Stoğu
      let safetyStock = null;
      if (rawData.maxDailySales != null && rawData.maxLeadTime != null && rawData.avgLeadTime != null) {
        safetyStock = this.calculateSafetyStock(rawData.maxDailySales, rawData.maxLeadTime, forecast, rawData.avgLeadTime);
      } else if (forecast != null) {
        safetyStock = this.calculateActiveSafetyStock(forecast, rawData.bufferDays || 7);
      }

      // 3. ORD-001: Sipariş Önerisi
      let order = null;
      if (rawData.currentStock != null && safetyStock != null) {
        if (rawData.avgLeadTime != null && forecast != null) {
          order = this.calculateOrderProposal(rawData.currentStock, safetyStock, forecast, rawData.avgLeadTime);
        } else if (forecast != null) {
          const protectionDemand = this.calculateProtectionDemand(forecast, rawData.hDays || 14);
          const grossNeed = (protectionDemand || 0) + safetyStock;
          order = this.calculateNetOrderLitres(grossNeed, rawData.currentStock);
        }
      }

      // Veritabanına (Engine'e) yaz
      if (forecast !== null) await metricEngineService.recordMetric(runId, productId, 'FCST-001', forecast);
      if (safetyStock !== null) await metricEngineService.recordMetric(runId, productId, 'SS-001', safetyStock);
      if (order !== null) await metricEngineService.recordMetric(runId, productId, 'ORD-001', order);
      
      return { success: true, forecast, safetyStock, order };
    }
  });
}

