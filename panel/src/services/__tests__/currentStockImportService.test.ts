import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentStockImportService } from '../currentStockImportService';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

describe('currentStockImportService', () => {
  it('uses a bearer-auth v2 endpoint and never falls through to the legacy archive service', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ freshness: 'NO_ACTIVE_STOCK' }) });
    globalThis.fetch = fetchMock as typeof fetch;
    await expect(currentStockImportService.status('anonymous-bearer-token')).resolves.toEqual({ freshness: 'NO_ACTIVE_STOCK' });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/v2/current-stock/status', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer anonymous-bearer-token' }) }));
  });

  it('fails closed without a bearer token', async () => {
    await expect(currentStockImportService.status('')).rejects.toThrow('yetkili v2 oturumu');
  });
});
