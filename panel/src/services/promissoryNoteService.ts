import { fetchApi } from '../lib/apiClient';

export interface PromissoryNoteDraftResponse {
  success: boolean;
  draft: any;
  installments: any[];
}

export async function createPromissoryNoteDraft(
  customerId: string, 
  totalAmount: number, 
  installmentCount: number, 
  startDate?: string
): Promise<PromissoryNoteDraftResponse> {
  return fetchApi<PromissoryNoteDraftResponse>('/instruments/promissory-note/create-draft', {
    method: 'POST',
    body: JSON.stringify({ customerId, totalAmount, installmentCount, startDate })
  });
}
