import { fetchApi } from '../lib/apiClient';

export interface SoftDeleteResponse {
  success: boolean;
  message: string;
}

export interface OverrideResponse {
  success: boolean;
  oldEntryId: string;
  newEntryId: string;
}

export async function softDeleteEntry(entryId: string): Promise<SoftDeleteResponse> {
  return fetchApi<SoftDeleteResponse>('/ledger/override/soft-delete', {
    method: 'POST',
    body: JSON.stringify({ entryId })
  });
}

export async function overrideEntry(oldEntryId: string, newAmount: number): Promise<OverrideResponse> {
  return fetchApi<OverrideResponse>('/ledger/override/override', {
    method: 'POST',
    body: JSON.stringify({ oldEntryId, newAmount })
  });
}
