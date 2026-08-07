import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getFinancialAnalysis, getCEI, getHealthScore, getCreditLimit } from '../financialService';
import * as apiClient from '../../lib/apiClient';

describe('financialService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls financial endpoints via fetchApi', async () => {
    const mockAnalysis = { cei: { cei: 85 }, health: { healthScore: 90 }, limit: { effective_limit: 50000 } };
    const fetchApiSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValue(mockAnalysis);

    const result = await getFinancialAnalysis('CUST-1');
    expect(fetchApiSpy).toHaveBeenCalledWith('/financial/analysis?customerId=CUST-1');
    expect(result).toEqual(mockAnalysis);

    await getCEI('CUST-1');
    expect(fetchApiSpy).toHaveBeenCalledWith('/financial/cei?customerId=CUST-1');

    await getHealthScore('CUST-1');
    expect(fetchApiSpy).toHaveBeenCalledWith('/financial/health-score?customerId=CUST-1');

    await getCreditLimit('CUST-1');
    expect(fetchApiSpy).toHaveBeenCalledWith('/financial/credit-limit?customerId=CUST-1');
  });
});
