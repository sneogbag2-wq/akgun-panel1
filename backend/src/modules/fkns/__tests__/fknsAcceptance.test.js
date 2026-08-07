import test from 'node:test';
import assert from 'node:assert/strict';
import { createFknsService } from '../fknsService.js';

test('Paket 05: FKNS (Penetrasyon) Testleri', async (t) => {
  const mockMetricEngine = {
    recorded: [],
    async recordMetric(runId, regionId, metricCode, metricValue) {
      this.recorded.push({ runId, regionId, metricCode, metricValue });
      return { success: true };
    }
  };

  const service = createFknsService(mockMetricEngine);

  await t.test('1. Kapsam (FKNS-003/017): Expected Days 0 ise Bölü Sıfır Hatası engellenir, Null Döner', () => {
    // 0 / 0 -> null
    const coverage = service.calculateCoverage(0, 0);
    assert.strictEqual(coverage, null);
  });

  await t.test('2. Kapsam (FKNS-017): Geçerli hesaplama', () => {
    // 20 gün ziyaret / 25 beklenen gün = %80
    const coverage = service.calculateCoverage(20, 25);
    assert.strictEqual(coverage, 80);
  });

  await t.test('3. Nokta (FKNS-007): Müşteri Tekilliği (Point Penetration)', () => {
    // uniqueBuyers: 150, totalTargetCustomers: 500 => %30
    const point = service.calculatePointPenetration(150, 500);
    assert.strictEqual(point, 30);
  });

  await t.test('4. Nokta: Toplam Hedef Müşteri 0 ise Null döner', () => {
    const point = service.calculatePointPenetration(150, 0);
    assert.strictEqual(point, null);
  });

  await t.test('5. Sıklık (Frequency): Toplam / Toplam Formülü', () => {
    // 600 fatura / 150 tekil müşteri = 4
    const freq = service.calculateFrequency(600, 150);
    assert.strictEqual(freq, 4);
  });

  await t.test('6. Sıklık: Alıcı Müşteri Yoksa Null Döner', () => {
    const freq = service.calculateFrequency(0, 0);
    assert.strictEqual(freq, null);
  });

  await t.test('7. Orkestrasyon (runFknsAnalysis): Engine\'e Başarıyla Mühürleme', async () => {
    mockMetricEngine.recorded = [];
    const rawFknsData = {
      activeDays: 20,
      expectedDays: 25,
      uniqueBuyers: 150,
      totalTargetCustomers: 500,
      totalInvoices: 600
    };

    await service.runFknsAnalysis('REG-01', 'RUN-999', rawFknsData);

    assert.strictEqual(mockMetricEngine.recorded.length, 3, 'Kapsam, Nokta ve Sıklık olarak 3 metrik yazılmalı');
    
    const codes = mockMetricEngine.recorded.map(r => r.metricCode).sort();
    assert.deepStrictEqual(codes, ['FKNS-001', 'FKNS-002', 'FKNS-003']);
    
    // Değerleri doğrula (SISTEM_HESAPLAMA_MATRISI.md standartlarında)
    const coverageResult = mockMetricEngine.recorded.find(r => r.metricCode === 'FKNS-001').metricValue;
    assert.strictEqual(coverageResult, 500); // FKNS-001: Müşteri Evreni (Payda)
    
    const pointResult = mockMetricEngine.recorded.find(r => r.metricCode === 'FKNS-002').metricValue;
    assert.strictEqual(pointResult, 150); // FKNS-002: Fatura Alan Alıcı Müşteri (Pay)
    
    const freqResult = mockMetricEngine.recorded.find(r => r.metricCode === 'FKNS-003').metricValue;
    assert.strictEqual(freqResult, 30); // FKNS-003: Genel FKNS Oranı % (100 * 150 / 500 = 30%)
  });
});

