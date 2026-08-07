import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getActiveSalesOrders, publishSalesOrders } from '../salesOrderService';
import * as apiClient from '../../lib/apiClient';

describe('salesOrderService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls GET /dispatch/sales-orders/active via fetchApi', async () => {
    const mockOrders = [{ id: 'so-1', sales_document_no: 'SO-100', customer_id: 'CUST-1', total_amount: 500, order_status: 'NEW', is_active: true, requested_delivery_date: '2026-08-10' }];
    const fetchApiSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValue({ data: mockOrders });

    const result = await getActiveSalesOrders();

    expect(fetchApiSpy).toHaveBeenCalledWith('/dispatch/sales-orders/active');
    expect(result).toEqual(mockOrders);
  });

  it('calls POST /dispatch/sales-orders/publish via fetchApi', async () => {
    const mockResponse = { success: true, publishedDocumentsCount: 2 };
    const fetchApiSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValue(mockResponse);

    const testOrders = [{ salesDocumentNo: 'SO-1' }, { salesDocumentNo: 'SO-2' }];
    const result = await publishSalesOrders(testOrders);

    expect(fetchApiSpy).toHaveBeenCalledWith('/dispatch/sales-orders/publish', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ orders: testOrders })
    }));
    expect(result).toEqual(mockResponse);
  });
});
