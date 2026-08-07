import { fetchApi } from '../lib/apiClient';

export interface EngineListResponse {
  data: any[];
}

export async function getMetricRegistry(): Promise<EngineListResponse> {
  return fetchApi<EngineListResponse>('/engine/advanced/metric-registry');
}

export async function getOpsDocuments(): Promise<EngineListResponse> {
  return fetchApi<EngineListResponse>('/engine/ops-documents');
}

export async function getStlMatchedSignals(): Promise<EngineListResponse> {
  return fetchApi<EngineListResponse>('/engine/stl-matched-signals');
}
