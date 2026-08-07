import { fetchApi } from '../lib/apiClient';

export interface ValidateOpsDocResponse {
  stagingId: string;
  filename: string;
  totalRawRows: number;
  stagedValidRows: number;
  duplicateCount: number;
  status: string;
}

export async function validateOpsDocImport(filename: string, rows: any[]): Promise<ValidateOpsDocResponse> {
  return fetchApi<ValidateOpsDocResponse>('/imports/ops-doc/validate', {
    method: 'POST',
    body: JSON.stringify({ filename, rows })
  });
}

export async function publishOpsDocSnapshot(stagingId: string): Promise<{ success: boolean; publishedCount: number }> {
  return fetchApi<{ success: boolean; publishedCount: number }>(`/imports/ops-doc/${stagingId}/publish-snapshot`, {
    method: 'POST'
  });
}

export async function getCurrentOpsDocSnapshot(): Promise<any[]> {
  const res = await fetchApi<{ data: any[] }>('/imports/ops-doc/current-snapshot');
  return res.data || [];
}
