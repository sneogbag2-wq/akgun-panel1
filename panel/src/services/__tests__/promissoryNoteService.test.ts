import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createPromissoryNoteDraft } from '../promissoryNoteService';
import * as apiClient from '../../lib/apiClient';

describe('promissoryNoteService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls POST /instruments/promissory-note/create-draft with payload', async () => {
    const mockResponse = {
      success: true,
      draft: { id: 'draft-1', customer_id: 'CUST-100', total_amount: 5000 },
      installments: [
        { draft_id: 'draft-1', installment_no: 1, amount: 2500, due_date: '2026-09-01' },
        { draft_id: 'draft-1', installment_no: 2, amount: 2500, due_date: '2026-10-01' }
      ]
    };

    const fetchApiSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValue(mockResponse);

    const result = await createPromissoryNoteDraft('CUST-100', 5000, 2, '2026-09-01');

    expect(fetchApiSpy).toHaveBeenCalledWith(
      '/instruments/promissory-note/create-draft',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ customerId: 'CUST-100', totalAmount: 5000, installmentCount: 2, startDate: '2026-09-01' })
      })
    );

    expect(result).toEqual(mockResponse);
  });
});
