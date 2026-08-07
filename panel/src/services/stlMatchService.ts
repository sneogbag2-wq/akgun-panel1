import { fetchApi } from '../lib/apiClient';

export interface StlDailyResult {
  id: string;
  sellout_date: string;
  collection_dates: string[];
  sellout_litres: number;
  operational_collection_amount: number;
  tl_per_litre: number;
  coverage_score: number;
  overlap_warning: boolean;
  calculated_at?: string;
}

export async function getStlDailyResults(): Promise<StlDailyResult[]> {
  const res = await fetchApi<{ data: StlDailyResult[] }>('/engine/stl-match/stl-daily-results');
  return res.data || [];
}

export async function calculateStlPairs(selloutDate?: string, selloutLitres?: number): Promise<any> {
  return fetchApi('/engine/stl-match/calculate-stl-pairs', {
    method: 'POST',
    body: JSON.stringify({ selloutDate, selloutLitres })
  });
}
