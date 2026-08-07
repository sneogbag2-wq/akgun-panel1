import { describe, expect, it, vi, beforeEach } from 'vitest';
import { acceptNote } from '../instrumentService';
import * as apiClient from '../../lib/apiClient';

describe('instrumentService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls POST /instruments/accept-note via fetchApi', async () => {
    const mockResponse = { success: true, instrumentId: 'INST-100', exposureUpdated: true };
    const fetchApiSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValue(mockResponse);

    const params = { customerId: 'CUST-10', amount: 25000, idempotencyKey: 'IDEM-100' };
    const result = await acceptNote(params);

    expect(fetchApiSpy).toHaveBeenCalledWith('/instruments/accept-note', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(params)
    }));
    expect(result).toEqual(mockResponse);
  });
});
