import test from 'node:test';
import assert from 'node:assert/strict';
import { createCutoverService } from '../cutoverService.js';

test('Paket 15: Geçiş, Karşılaştırmalı Yayın ve Eski Yapının Kapatılması', async (t) => {
  const createMockSystem = (name) => {
    let callCount = 0;
    return {
      name,
      getCallCount: () => callCount,
      async write(data) {
        callCount++;
        return { system: name, value: data.amount };
      },
      async access() {
        return 'ACCESS_GRANTED';
      }
    };
  };

  await t.test('1. Shadow Mode: Cutover öncesi her iki sisteme de yazılır', async () => {
    const legacy = createMockSystem('Legacy');
    const v4 = createMockSystem('V4');
    
    // isCutoverComplete = false (Shadow mode)
    const service = createCutoverService(legacy, v4, false);
    
    await service.writeFinancialData({ amount: 100 });

    assert.strictEqual(legacy.getCallCount(), 1, 'Legacy sisteme yazılmalı');
    assert.strictEqual(v4.getCallCount(), 1, 'V4 sisteme paralel yazılmalı');
  });

  await t.test('2. Hard Cutover: Fiş Çekildiğinde Legacy Sistem tamamen kilitlenir', async () => {
    const legacy = createMockSystem('Legacy');
    const v4 = createMockSystem('V4');
    
    // isCutoverComplete = true (Hard Cutover yapıldı)
    const service = createCutoverService(legacy, v4, true);
    
    await service.writeFinancialData({ amount: 100 });

    assert.strictEqual(legacy.getCallCount(), 0, 'Kırmızı Çizgi: Legacy sisteme KESİNLİKLE yazılmamalı!');
    assert.strictEqual(v4.getCallCount(), 1, 'Sadece V4 sisteme yazılmalı');

    // Legacy'ye doğrudan erişim engellenmeli
    await assert.rejects(
      async () => await service.accessLegacyDirectly(),
      { name: 'CutoverError', message: 'Legacy System is Deprecated and Locked.' }
    );
  });
});
