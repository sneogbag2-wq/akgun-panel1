import { describe, expect, it, vi, beforeEach } from 'vitest';
import { reconcileOfficialTakeover } from '../officialTakeoverService';
import * as apiClient from '../../lib/apiClient';

describe('officialTakeoverService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls POST /payment/official-takeover/reconcile-takeover with officialCollections body', async () => {
    const mockResponse = {
      success: true,
      totalOfficialCollections: 2,
      matchedCount: 2,
      batchMatchRate: 100,
      status: 'RECONCILED_WITH_EXCEPTIONS'
    };

    const fetchApiSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValue(mockResponse);

    const testCollections = [
      { id: '1', documentNo: 'OFF-01', amount: 100 },
      { id: '2', documentNo: 'OFF-02', amount: 200 }
    ];

    const result = await reconcileOfficialTakeover(testCollections);

    expect(fetchApiSpy).toHaveBeenCalledWith(
      '/payment/official-takeover/reconcile-takeover',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ officialCollections: testCollections })
      })
    );

    expect(result).toEqual(mockResponse);
  });
});
