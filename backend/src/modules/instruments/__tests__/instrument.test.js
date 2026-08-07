import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createInstrumentRepository } from '../instrumentRepository.js';

describe('Instrument Acceptance (Senet Kabulü) Rules - Paket 08B', () => {
  let mockUserClient;
  let instrumentRepository;

  beforeEach(() => {
    mockUserClient = {
      rpc: mock.fn()
    };
    instrumentRepository = createInstrumentRepository({ userClient: mockUserClient, serviceClient: {} });
  });

  it('test_instrument_acceptance_is_not_cash: Senet kabulü nakit değildir, sadece exposure kaydırır', async () => {
    mockUserClient.rpc.mock.mockImplementation(async () => {
      return {
        data: {
          new_customer_balance: 5000, // Varsayalım 10000 idi, 5000'e düştü
          new_note_exposure: 5000,    // 0 idi, 5000 oldu
          new_total_exposure: 10000   // Değişmedi
        },
        error: null
      };
    });

    const result = await instrumentRepository.acceptNote({
      customerId: 'CUST-001',
      amount: 5000,
      dueDate: '2026-10-10',
      noteNumber: 'SNT-2026-001',
      idempotencyKey: 'idem-key-1'
    });

    assert.strictEqual(mockUserClient.rpc.mock.calls.length, 1);
    assert.deepEqual(mockUserClient.rpc.mock.calls[0].arguments, ['accept_instrument_note', {
      p_customer_id: 'CUST-001',
      p_amount: 5000,
      p_due_date: '2026-10-10',
      p_note_number: 'SNT-2026-001',
      p_idempotency_key: 'idem-key-1'
    }]);
    assert.strictEqual(result.success, true);
  });

  it('test_total_exposure_remains_constant_on_acceptance: Toplam risk senet kabulünde değişmez', async () => {
    mockUserClient.rpc.mock.mockImplementation(async () => {
      return {
        data: { new_total_exposure: 10000 },
        error: null
      };
    });

    const result = await instrumentRepository.acceptNote({
      customerId: 'CUST-001',
      amount: 5000,
      dueDate: '2026-10-10',
      noteNumber: 'SNT-2026-001',
      idempotencyKey: 'idem-key-2'
    });

    assert.strictEqual(result.instrument.new_total_exposure, 10000);
  });

  it('test_idempotent_note_creation: Aynı istek mükerrer kabul edilmez', async () => {
    mockUserClient.rpc.mock.mockImplementation(async () => {
      return {
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' }
      };
    });

    await assert.rejects(
      async () => {
        await instrumentRepository.acceptNote({
          customerId: 'CUST-001',
          amount: 5000,
          dueDate: '2026-10-10',
          noteNumber: 'SNT-2026-001',
          idempotencyKey: 'idem-key-1'
        });
      },
      (err) => {
        return err.code === '23505';
      }
    );
  });
});
