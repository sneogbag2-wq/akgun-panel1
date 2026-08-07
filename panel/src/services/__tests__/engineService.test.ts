import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getMetricRegistry, getOpsDocuments, getStlMatchedSignals } from '../engineService';
import * as apiClient from '../../lib/apiClient';

describe('engineService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls engine endpoints via fetchApi', async () => {
    const mockData = { data: [{ metric_id: 'MET-001' }] };
    const fetchApiSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValue(mockData);

    const registry = await getMetricRegistry();
    expect(fetchApiSpy).toHaveBeenCalledWith('/engine/advanced/metric-registry');
    expect(registry).toEqual(mockData);

    const ops = await getOpsDocuments();
    expect(fetchApiSpy).toHaveBeenCalledWith('/engine/ops-documents');
    expect(ops).toEqual(mockData);

    const stl = await getStlMatchedSignals();
    expect(fetchApiSpy).toHaveBeenCalledWith('/engine/stl-matched-signals');
    expect(stl).toEqual(mockData);
  });
});
