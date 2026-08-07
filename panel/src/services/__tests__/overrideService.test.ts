import { describe, expect, it, vi, beforeEach } from 'vitest';
import { softDeleteEntry, overrideEntry } from '../overrideService';
import * as apiClient from '../../lib/apiClient';

describe('overrideService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls POST /ledger/override/soft-delete via fetchApi', async () => {
    const mockResponse = { success: true, message: 'Soft deleted successfully' };
    const fetchApiSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValue(mockResponse);

    const result = await softDeleteEntry('entry-1');

    expect(fetchApiSpy).toHaveBeenCalledWith('/ledger/override/soft-delete', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ entryId: 'entry-1' })
    }));
    expect(result).toEqual(mockResponse);
  });

  it('calls POST /ledger/override/override via fetchApi', async () => {
    const mockResponse = { success: true, oldEntryId: 'entry-1', newEntryId: 'entry-2' };
    const fetchApiSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValue(mockResponse);

    const result = await overrideEntry('entry-1', 750);

    expect(fetchApiSpy).toHaveBeenCalledWith('/ledger/override/override', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ oldEntryId: 'entry-1', newAmount: 750 })
    }));
    expect(result).toEqual(mockResponse);
  });
});
