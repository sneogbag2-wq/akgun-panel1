import { fetchApi } from '../lib/apiClient';

export interface FinancialAnalysisResponse {
  cei: any;
  health: any;
  limit: any;
}

export async function getFinancialAnalysis(customerId?: string): Promise<FinancialAnalysisResponse> {
  const query = customerId ? `?customerId=${encodeURIComponent(customerId)}` : '';
  return fetchApi<FinancialAnalysisResponse>(`/financial/analysis${query}`);
}

export async function getCEI(customerId?: string): Promise<any> {
  const query = customerId ? `?customerId=${encodeURIComponent(customerId)}` : '';
  return fetchApi<any>(`/financial/cei${query}`);
}

export async function getHealthScore(customerId?: string): Promise<any> {
  const query = customerId ? `?customerId=${encodeURIComponent(customerId)}` : '';
  return fetchApi<any>(`/financial/health-score${query}`);
}

export async function getCreditLimit(customerId?: string): Promise<any> {
  const query = customerId ? `?customerId=${encodeURIComponent(customerId)}` : '';
  return fetchApi<any>(`/financial/credit-limit${query}`);
}
