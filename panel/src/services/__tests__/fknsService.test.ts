import { describe, expect, it, vi, beforeEach } from 'vitest';
import { runFknsAnalysis } from '../fknsService';
import * as apiClient from '../../lib/apiClient';

describe('fknsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls POST /fkns/analyze with payload', async () => {
    const mockResponse = {
      success: true,
      result: { status: 'COMPLETED' }
    };

    const fetchApiSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValue(mockResponse);

    const testData = { activeDays: 20, expectedDays: 25, uniqueBuyers: 50 };
    const result = await runFknsAnalysis('REG-01', 'RUN-100', testData);

    expect(fetchApiSpy).toHaveBeenCalledWith(
      '/fkns/analyze',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ regionId: 'REG-01', runId: 'RUN-100', rawFknsData: testData })
      })
    );

    expect(result).toEqual(mockResponse);
  });
});
