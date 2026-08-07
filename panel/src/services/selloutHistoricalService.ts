import { fetchApi } from '../lib/apiClient';

export interface SelloutHistoricalSnapshot {
  id: string;
  period: string;
  channel: string;
  open_litres: number;
  closed_litres: number;
  total_litres: number;
  mom_growth: number;
  yoy_growth: number;
  calculated_at?: string;
}

export async function getSelloutHistoricalTrends(): Promise<SelloutHistoricalSnapshot[]> {
  const res = await fetchApi<{ data: SelloutHistoricalSnapshot[] }>('/sellout/historical/historical-trends');
  return res.data || [];
}

export async function generateSelloutNarrativeReport(period: string): Promise<{ narrativeText: string }> {
  return fetchApi<{ narrativeText: string }>('/sellout/historical/generate-narrative-report', {
    method: 'POST',
    body: JSON.stringify({ period })
  });
}
