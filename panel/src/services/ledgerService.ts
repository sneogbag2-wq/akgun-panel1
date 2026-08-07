import { fetchApi } from '../lib/apiClient';

export interface LedgerListResponse {
  data: any[];
  total?: number;
}

export async function getLedgerEntries(): Promise<LedgerListResponse> {
  return fetchApi<LedgerListResponse>('/ledger');
}

export async function getAgingMigration(): Promise<LedgerListResponse> {
  return fetchApi<LedgerListResponse>('/ledger/aging-migration');
}

export async function getStressScenarios(): Promise<LedgerListResponse> {
  return fetchApi<LedgerListResponse>('/ledger/stress-scenarios');
}
