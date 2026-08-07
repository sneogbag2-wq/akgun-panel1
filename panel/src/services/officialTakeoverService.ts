import { fetchApi } from '../lib/apiClient';

export interface ReconcileTakeoverResponse {
  success: boolean;
  totalOfficialCollections: number;
  matchedCount: number;
  batchMatchRate: number;
  status: string;
}

export async function reconcileOfficialTakeover(officialCollections: any[]): Promise<ReconcileTakeoverResponse> {
  return fetchApi<ReconcileTakeoverResponse>('/payment/official-takeover/reconcile-takeover', {
    method: 'POST',
    body: JSON.stringify({ officialCollections })
  });
}
