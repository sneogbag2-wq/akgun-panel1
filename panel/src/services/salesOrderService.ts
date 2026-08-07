import { fetchApi } from '../lib/apiClient';

export interface SalesOrderDocument {
  id: string;
  sales_document_no: string;
  customer_id: string;
  requested_delivery_date: string;
  total_amount: number;
  order_status: string;
  is_active: boolean;
}

export async function getActiveSalesOrders(): Promise<SalesOrderDocument[]> {
  const res = await fetchApi<{ data: SalesOrderDocument[] }>('/dispatch/sales-orders/active');
  return res.data || [];
}

export async function publishSalesOrders(orders: any[]): Promise<{ success: boolean; publishedDocumentsCount: number }> {
  return fetchApi<{ success: boolean; publishedDocumentsCount: number }>('/dispatch/sales-orders/publish', {
    method: 'POST',
    body: JSON.stringify({ orders })
  });
}
