import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiSemanticService } from '../aiSemanticService.js';

test('Paket 14: AI Semantik (Yapay Zeka) Testleri', async (t) => {
  
  await t.test('1. Eksik Metriklerde AI Yorum Yapmaz (Fail-Closed)', async () => {
    const emptyMockEngine = {
      getLatestMetric: async () => null
    };
    const service = createAiSemanticService(emptyMockEngine);

    const result = await service.generateInsights('RUN-99', 'ENT-01');
    assert.match(result, /eksik olduğu için kesin yorum yapılamıyor/);
  });

  await t.test('2. Tam Metriklerde Doğru Analiz Özeti Üretilir', async () => {
    const fullMockEngine = {
      getLatestMetric: async (entityId, metricCode) => {
        if (metricCode === 'FIN-015') return { value: 75 };
        if (metricCode === 'FKNS-001') return { value: 90 };
        if (metricCode === 'ORD-001') return { value: 120 };
        return null;
      }
    };
    const service = createAiSemanticService(fullMockEngine);

    const result = await service.generateInsights('RUN-100', 'ENT-01');
    assert.match(result, /Sağlık Skorunuz: 75\/100/);
    assert.match(result, /Kapsam \(Penetrasyon\): %90/);
    assert.match(result, /Önerilen Sipariş Miktarı: 120 birim/);
  });
});
