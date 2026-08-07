import test from 'node:test';
import assert from 'node:assert/strict';
import { createFinancialReadService } from '../financialReadService.js';

test('Paket 12A: Temel Finansal Read Model Testleri (DSO)', async (t) => {
  const mockMetricEngine = {
    recorded: [],
    async recordMetric(runId, customerId, metricCode, metricValue) {
      this.recorded.push({ runId, customerId, metricCode, metricValue });
      return { success: true };
    }
  };

  const service = createFinancialReadService(mockMetricEngine);

  await t.test('1. DSO (Gün Tahsilat Süresi) Doğruluğu', () => {
    // Alacak: 50.000 TL, Satış: 150.000 TL, Periyot: 30 Gün
    // (50.000 / 150.000) * 30 = 10 Gün
    const dso = service.calculateDSO(50000, 150000, 30);
    assert.strictEqual(dso, 10);
  });

  await t.test('2. Satış Yoksa DSO Hesaplanmaz (Null Döner)', () => {
    const dso = service.calculateDSO(50000, 0, 30);
    assert.strictEqual(dso, null);
  });

  await t.test('3. FIN-014 (CEI): Tahsilat ve Alacak 0 ise Bölü Sıfır Hatası engellenir (Null Döner)', () => {
    const cei = service.calculateCEI(0, 0);
    assert.strictEqual(cei, null, '0/0 belirsizliği null dönmelidir');
  });

  await t.test('4. FIN-014 (CEI): Doğru hesaplama', () => {
    // Toplam Tahsilat: 80.000, Toplam Havuz (Tahsilat + Açık): 100.000 -> CEI: (80k / 100k) * 100 = 80
    const cei = service.calculateCEI(80000, 100000);
    assert.strictEqual(cei, 80);
  });

  await t.test('5. FIN-015 (Sağlık Skoru): Bileşen eksikse (null), ağırlıklar re-normalize edilir', () => {
    // Bileşenler: aging(35%), cei(25%), exposure(20%), close(10%), instrument(10%)
    // Senaryo: instrument null, exposure null (Kalan ağırlık: 35+25+10 = 70)
    // Puanlar: aging=80, cei=90, close=70
    // Hesap: (80*35 + 90*25 + 70*10) / 70 = (2800 + 2250 + 700) / 70 = 5750 / 70 = 82.14
    const components = {
      aging: 80,
      cei: 90,
      exposure: null,
      closeBehavior: 70,
      instrumentReliability: null
    };
    const score = service.calculateFinancialHealthScore(components);
    assert.strictEqual(Math.round(score * 100) / 100, 82.14);
  });

  await t.test('6. FIN-016 (Kredi Limiti Önerisi): Sağlık Skoru 49 ise Limit acımasızca 0 döner', () => {
    const limit = service.calculateSuggestedCreditLimit(100000, 20000, 1.2, 49);
    assert.strictEqual(limit, 0);
  });

  await t.test('7. FIN-016 (Kredi Limiti Önerisi): Sağlık Skoru 50+ ise Limit hesaplanır', () => {
    // min(100k, 20k) * 1.0 (healthScore=85) = 20k
    const limit = service.calculateSuggestedCreditLimit(100000, 20000, 85);
    assert.strictEqual(limit, 20000);
  });

  await t.test('8. Orkestrasyon (runFinancialAnalysis): Paket 12-13 İzolasyonu Nedeniyle Engine\'e Yazmaz', async () => {
    mockMetricEngine.recorded = [];
    
    const rawData = {
      totalReceivables: 50000,
      totalSales: 150000,
      daysInPeriod: 30,
      totalCollections: 80000,
      currentReceivables: 20000,
      components: {
        aging: 80, cei: 80, exposure: 80, closeBehavior: 80, instrumentReliability: 80
      },
      operatingNeed: 100000,
      cashRealization: 20000,
      behaviorFactor: 1.2
    };

    const result = await service.runFinancialAnalysis('CUST-99', 'RUN-XYZ', rawData);

    assert.strictEqual(mockMetricEngine.recorded.length, 0, 'İzolasyon gereği metrik yazılmamalıdır');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.metrics.healthScore, 80);
  });
});
