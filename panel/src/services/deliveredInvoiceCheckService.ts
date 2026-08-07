import { fetchApi } from '../lib/apiClient';

export interface DeliveredInvoiceCheckResponse {
  success: boolean;
  check: any;
}

export interface DeliveredInvoiceOpenStackItem {
  id: string;
  customer_id: string;
  open_amount: number;
  stack_type: 'PREVIOUS' | 'CURRENT';
}

export async function checkDeliveredInvoice(
  customerId: string, 
  invoiceNo: string, 
  deliveryDocNo?: string, 
  amount: number = 0, 
  hasDMinus1Proof: boolean = false
): Promise<DeliveredInvoiceCheckResponse> {
  return fetchApi<DeliveredInvoiceCheckResponse>('/ledger/delivered-invoice/check', {
    method: 'POST',
    body: JSON.stringify({ customerId, invoiceNo, deliveryDocNo, amount, hasDMinus1Proof })
  });
}

export async function getDeliveredInvoiceOpenStack(customerId?: string): Promise<DeliveredInvoiceOpenStackItem[]> {
  const url = customerId 
    ? `/ledger/delivered-invoice/open-stack?customerId=${encodeURIComponent(customerId)}`
    : '/ledger/delivered-invoice/open-stack';
  const res = await fetchApi<{ data: DeliveredInvoiceOpenStackItem[] }>(url);
  return res.data || [];
}
