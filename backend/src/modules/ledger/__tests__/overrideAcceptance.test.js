import test from 'node:test';
import assert from 'node:assert/strict';
import { createOverrideService } from '../overrideService.js';

test('Paket 11: Manuel İşlem ve Override Testleri', async (t) => {

  const createMockRepository = (initialData = []) => {
    let memory = initialData.map(d => ({ ...d }));

    return {
      memory,
      async runInTransaction(callback) {
        const tx = {
          getEntryById: async (id) => memory.find(e => e.id === id),
          updateEntry: async (id, updates) => {
            const entry = memory.find(e => e.id === id);
            if (entry) Object.assign(entry, updates);
          },
          insertEntry: async (data) => {
            const id = `new-id-${Math.random()}`;
            memory.push({ id, ...data });
            return id;
          }
        };
        return await callback(tx);
      }
    };
  };

  await t.test('1. Soft-Delete Kalkanı: Veri fiziksel olarak silinmez, deleted_at dolar', async () => {
    const repo = createMockRepository([
      { id: 'entry-1', customer_id: 'CUST-1', amount: 1000, source: 'SYSTEM', validity: 'VALID', deleted_at: null }
    ]);
    const service = createOverrideService(repo);

    await service.softDeleteEntry('entry-1');

    assert.strictEqual(repo.memory.length, 1, 'Kayıt sayısı azalmamalı (Fiziksel silinme yasak)');
    assert.notEqual(repo.memory[0].deleted_at, null, 'deleted_at kolonu dolmalı');
  });

  await t.test('2. Override Flag İzolasyonu: Eski veri OVERRIDDEN olur, yeni veri MANUAL_OVERRIDE olur', async () => {
    const repo = createMockRepository([
      { id: 'entry-2', customer_id: 'CUST-2', amount: 500, source: 'SYSTEM', validity: 'VALID', deleted_at: null }
    ]);
    const service = createOverrideService(repo);

    await service.overrideEntry('entry-2', 750); // 500'ü ezip 750 yapıyoruz

    // Bellekte 2 kayıt olmalı (Biri iptal edilen, biri yeni giren)
    assert.strictEqual(repo.memory.length, 2);

    const oldEntry = repo.memory.find(e => e.id === 'entry-2');
    assert.strictEqual(oldEntry.validity, 'OVERRIDDEN', 'Eski kaydın geçerliliği OVERRIDDEN olmalı');

    const newEntry = repo.memory.find(e => e.id !== 'entry-2');
    assert.strictEqual(newEntry.amount, 750);
    assert.strictEqual(newEntry.source, 'MANUAL_OVERRIDE');
    assert.strictEqual(newEntry.validity, 'VALID');
  });
});
