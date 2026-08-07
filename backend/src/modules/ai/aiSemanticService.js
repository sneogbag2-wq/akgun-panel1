export function createAiSemanticService(metricEngineService = null) {
  return Object.freeze({
    // AI'ın tek konuşma yetkisi: Onaylı verileri okuyup cümle kurmak
    async generateInsights(runId, entityId) {
      if (!metricEngineService) {
        throw new Error('metricEngineService is required for AI to access Single Source of Truth');
      }

      // Faz 2, Faz 3 ve Faz 4'ten onaylı metrikleri ÇEK (Hesaplama YOK!)
      const healthMetric = await metricEngineService.getLatestMetric(entityId, 'FIN-015');
      const coverageMetric = await metricEngineService.getLatestMetric(entityId, 'FKNS-001');
      const orderMetric = await metricEngineService.getLatestMetric(entityId, 'ORD-001');

      // 3 ana metrikten biri bile eksikse konuşma! (Fail-Closed)
      if (!healthMetric || !coverageMetric || !orderMetric) {
        return "Müşterinin güncel (onaylanmış) ana metrikleri (FIN-015, FKNS-001, ORD-001) eksik olduğu için kesin yorum yapılamıyor.";
      }

      const healthScore = healthMetric.value;
      const coverage = coverageMetric.value;
      const orderQuantity = orderMetric.value;

      // Sadece ve sadece var olan kesin verilerle yorum üret
      const insightString = `AI Analiz Özeti:\n` +
        `- Sağlık Skorunuz: ${healthScore}/100. ${healthScore >= 50 ? 'İyi durumda.' : 'Riskli!'}\n` +
        `- Kapsam (Penetrasyon): %${coverage}.\n` +
        `- Önerilen Sipariş Miktarı: ${orderQuantity} birim. Lojistik motoru tarafından onaylanmıştır.`;

      return insightString;
    }
  });
}
