import { fetchApi } from '../lib/apiClient';

export interface CommercialStockItem {
  id: string;
  document_no: string;
  customer_id: string;
  product_id: string;
  remaining_quantity: number;
  remaining_litres: number;
  is_active: boolean;
}

export async function getCommercialStockSummary(): Promise<CommercialStockItem[]> {
  const res = await fetchApi<{ data: CommercialStockItem[] }>('/stock/commercial/summary');
  return res.data || [];
}

export async function publishCommercialStock(filename: string, items: any[]): Promise<{ success: boolean; publishedItems: number }> {
  return fetchApi<{ success: boolean; publishedItems: number }>('/stock/commercial/publish', {
    method: 'POST',
    body: JSON.stringify({ filename, items })
  });
}
