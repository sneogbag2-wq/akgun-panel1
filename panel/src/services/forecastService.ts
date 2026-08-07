import { fetchApi } from '../lib/apiClient';

export interface ForecastModelResponse {
  data: any[];
}

export async function getDailyForecastModel(): Promise<ForecastModelResponse> {
  return fetchApi<ForecastModelResponse>('/forecast/daily-model');
}

export async function getSafetyStock(): Promise<ForecastModelResponse> {
  return fetchApi<ForecastModelResponse>('/forecast/safety-stock');
}

export async function getStockoutRisk(): Promise<ForecastModelResponse> {
  return fetchApi<ForecastModelResponse>('/forecast/stockout-risk');
}

export async function getReplenishmentRecommendations(): Promise<ForecastModelResponse> {
  return fetchApi<ForecastModelResponse>('/forecast/replenishment');
}
