import { fetchApi } from '../lib/apiClient';

export interface AcceptNoteParams {
  customerId: string;
  amount: number;
  dueDate?: string;
  noteNumber?: string;
  idempotencyKey: string;
}

export interface AcceptNoteResponse {
  success: boolean;
  instrumentId?: string;
  exposureUpdated?: boolean;
}

export async function acceptNote(params: AcceptNoteParams): Promise<AcceptNoteResponse> {
  return fetchApi<AcceptNoteResponse>('/instruments/accept-note', {
    method: 'POST',
    body: JSON.stringify(params)
  });
}
