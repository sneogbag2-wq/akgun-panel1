import { fetchApi } from '../lib/apiClient';

export interface SalesInvoiceListResponse {
  data: any[];
  total?: number;
}

export async function getSalesInvoicesList(): Promise<SalesInvoiceListResponse> {
  return fetchApi<SalesInvoiceListResponse>('/invoice');
}
