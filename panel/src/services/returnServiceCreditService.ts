import { fetchApi } from '../lib/apiClient';

export interface RegisterReturnServiceCreditResponse {
  success: boolean;
  record: any;
}

export async function registerReturnServiceCredit(
  customerId: string, 
  documentNo: string, 
  creditType: 'IADE' | 'HIZMET', 
  amount: number
): Promise<RegisterReturnServiceCreditResponse> {
  return fetchApi<RegisterReturnServiceCreditResponse>('/ledger/return-service-credit/register', {
    method: 'POST',
    body: JSON.stringify({ customerId, documentNo, creditType, amount })
  });
}
