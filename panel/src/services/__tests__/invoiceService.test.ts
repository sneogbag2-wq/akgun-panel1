import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getSalesInvoicesList } from '../invoiceService';
import * as apiClient from '../../lib/apiClient';

describe('invoiceService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls GET /invoice via fetchApi', async () => {
    const mockData = { data: [{ invoiceId: 'INV-100', amount: 5000 }], total: 1 };
    const fetchApiSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValue(mockData);

    const result = await getSalesInvoicesList();

    expect(fetchApiSpy).toHaveBeenCalledWith('/invoice');
    expect(result).toEqual(mockData);
  });
});
