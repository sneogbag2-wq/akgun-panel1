import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  getDailyForecastModel,
  getSafetyStock,
  getStockoutRisk,
  getReplenishmentRecommendations
} from '../forecastService';
import * as apiClient from '../../lib/apiClient';

describe('forecastService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls forecast endpoints via fetchApi', async () => {
    const mockData = { data: [{ id: '1', item: 'MAT-100' }] };
    const fetchApiSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValue(mockData);

    const daily = await getDailyForecastModel();
    expect(fetchApiSpy).toHaveBeenCalledWith('/forecast/daily-model');
    expect(daily).toEqual(mockData);

    const safety = await getSafetyStock();
    expect(fetchApiSpy).toHaveBeenCalledWith('/forecast/safety-stock');
    expect(safety).toEqual(mockData);

    const risk = await getStockoutRisk();
    expect(fetchApiSpy).toHaveBeenCalledWith('/forecast/stockout-risk');
    expect(risk).toEqual(mockData);

    const repl = await getReplenishmentRecommendations();
    expect(fetchApiSpy).toHaveBeenCalledWith('/forecast/replenishment');
    expect(repl).toEqual(mockData);
  });
});
