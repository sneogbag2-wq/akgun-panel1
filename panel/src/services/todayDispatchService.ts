import { fetchApi } from '../lib/apiClient';

export interface TodayDispatchSummary {
  as_of_date: string;
  total_orders: number;
  total_litres: number;
  total_amount: number;
}

export interface DispatchOrderCard {
  id: string;
  sales_document_no: string;
  customer_id: string;
  view_class: 'SIPARIS' | 'EMANET_SP';
  operational_state: string;
  document_amount: number;
  document_litres: number;
}

export async function getTodayDispatchSummary(): Promise<TodayDispatchSummary> {
  const res = await fetchApi<{ data: TodayDispatchSummary }>('/dispatch/today/summary');
  return res.data;
}

export async function getTodayDispatchOrders(): Promise<DispatchOrderCard[]> {
  const res = await fetchApi<{ data: DispatchOrderCard[] }>('/dispatch/today/orders');
  return res.data || [];
}
