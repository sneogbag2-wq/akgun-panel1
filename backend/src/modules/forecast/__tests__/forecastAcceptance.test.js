import test from 'node:test';
import assert from 'node:assert/strict';
import { createForecastService } from '../forecastService.js';

test('Paket 06: Tahmin, Güvenlik Stoğu ve Sipariş (Forecast) Testleri', async (t) => {
  const mockMetricEngine = {
    recorded: [],
    async recordMetric(runId, entityId, metricCode, metricValue) {
      this.recorded.push({ runId, entityId, metricCode, metricValue });
      return { success: true };
    }
  };

  const service = createForecastService(mockMetricEngine);

  await t.test('1. FCST-001 (Ortalama Günlük Tahmin): Tarihsel süre 0 ise Null Döner (0\'a Bölme Yok)', () => {
    const forecast = service.calculateForecast(1000, 0);
    assert.strictEqual(forecast, null);
  });

  await t.test('2. FCST-001 (Ortalama Günlük Tahmin): Geçerli hesaplama', () => {
    // 3000 satış / 30 gün = günlük 100 satış tahmini
    const forecast = service.calculateForecast(3000, 30);
    assert.strictEqual(forecast, 100);
  });

  await t.test('3. SS-001 (Güvenlik Stoğu): (Maks Satış * Maks Süre) - (Ort Satış * Ort Süre)', () => {
    // Maksimum: Günde 150 satış * 10 gün teslim = 1500
    // Ortalama: Günde 100 satış * 7 gün teslim = 700
    // Güvenlik Stoğu: 1500 - 700 = 800
    const safetyStock = service.calculateSafetyStock(150, 10, 100, 7);
    assert.strictEqual(safetyStock, 800);
  });

  await t.test('4. SS-001 (Güvenlik Stoğu): Herhangi bir parametre null ise Null döner (Zincirleme Kuralı)', () => {
    const safetyStock = service.calculateSafetyStock(150, 10, null, 7);
    assert.strictEqual(safetyStock, null);
  });

  await t.test('5. ORD-001 (Sipariş Önerisi): Stok eksikse hesaplanır', () => {
    // Ortalama Tahmin (100) * Lead Time (7) = 700 (Reorder Point Temeli)
    // Reorder Point = 700 + Güvenlik Stoğu (800) = 1500
    // Mevcut Stok = 500
    // Sipariş = 1500 - 500 = 1000
    const order = service.calculateOrderProposal(500, 800, 100, 7);
    assert.strictEqual(order, 1000);
  });

  await t.test('6. ORD-001 (Sipariş Önerisi): Mevcut Stok (Reorder Point\'ten) fazlaysa acımasızca 0 Döner', () => {
    // Reorder Point = (100 * 7) + 800 = 1500
    // Mevcut Stok = 2000
    // 1500 - 2000 = -500 --> Acımasızca 0 dönmeli
    const order = service.calculateOrderProposal(2000, 800, 100, 7);
    assert.strictEqual(order, 0);
  });

  await t.test('7. Orkestrasyon (runForecastAnalysis): Engine\'e Başarıyla Mühürleme', async () => {
    mockMetricEngine.recorded = [];
    const rawData = {
      historicalSales: 3000,
      historicalDays: 30, // Forecast -> 100
      maxDailySales: 150,
      maxLeadTime: 10,
      avgLeadTime: 7, // Safety Stock -> 800
      currentStock: 500 // Reorder Point 1500 - 500 = Order 1000
    };

    await service.runForecastAnalysis('PROD-42', 'RUN-1010', rawData);

    assert.strictEqual(mockMetricEngine.recorded.length, 3, 'FCST, SS ve ORD yazılmalı');
    
    const codes = mockMetricEngine.recorded.map(r => r.metricCode).sort();
    assert.deepStrictEqual(codes, ['FCST-001', 'ORD-001', 'SS-001']);
    
    // Doğrulamalar
    const fcstValue = mockMetricEngine.recorded.find(r => r.metricCode === 'FCST-001').metricValue;
    assert.strictEqual(fcstValue, 100);

    const ssValue = mockMetricEngine.recorded.find(r => r.metricCode === 'SS-001').metricValue;
    assert.strictEqual(ssValue, 800);

    const ordValue = mockMetricEngine.recorded.find(r => r.metricCode === 'ORD-001').metricValue;
    assert.strictEqual(ordValue, 1000);
  });
});
