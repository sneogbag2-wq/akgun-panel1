import { fetchApi } from '../lib/apiClient';

export interface RawFknsData {
  activeDays?: number;
  expectedDays?: number;
  uniqueBuyers?: number;
  totalTargetCustomers?: number;
  totalInvoices?: number;
}

export interface FknsAnalysisResponse {
  success: boolean;
  result?: any;
  error?: string;
}

export async function runFknsAnalysis(
  regionId: string,
  runId: string,
  rawFknsData: RawFknsData
): Promise<FknsAnalysisResponse> {
  return fetchApi<FknsAnalysisResponse>('/fkns/analyze', {
    method: 'POST',
    body: JSON.stringify({ regionId, runId, rawFknsData })
  });
}
