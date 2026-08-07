import { describe, expect, it, vi, beforeEach } from 'vitest';
import { registerReturnServiceCredit } from '../returnServiceCreditService';
import * as apiClient from '../../lib/apiClient';

describe('returnServiceCreditService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls POST /ledger/return-service-credit/register with payload', async () => {
    const mockResponse = {
      success: true,
      record: { id: 'rec-1', customer_id: 'CUST-100', document_no: 'HZMT-01', credit_type: 'HIZMET', amount: 2500 }
    };

    const fetchApiSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValue(mockResponse);

    const result = await registerReturnServiceCredit('CUST-100', 'HZMT-01', 'HIZMET', 2500);

    expect(fetchApiSpy).toHaveBeenCalledWith(
      '/ledger/return-service-credit/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ customerId: 'CUST-100', documentNo: 'HZMT-01', creditType: 'HIZMET', amount: 2500 })
      })
    );

    expect(result).toEqual(mockResponse);
  });
});
