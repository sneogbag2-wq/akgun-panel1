import { MetricResultEnvelope } from '../types/ai';

export interface QueryMetricsRequest {
  metricIds: string[];
  period?: string;
  filters?: Record<string, any>;
  dimensions?: string[];
}

export interface CompareMetricsRequest {
  metricId: string;
  basePeriod: string;
  comparePeriod: string;
  filters?: Record<string, any>;
}

export interface CompareResult {
  base: MetricResultEnvelope;
  compare: MetricResultEnvelope;
  delta: number;
  percentageChange: number;
}

/**
 * Mocks the central calculation engine's metric fetching logic.
 * In a real implementation, this would call a backend endpoint.
 */
export function queryMetrics(request: QueryMetricsRequest): MetricResultEnvelope[] {
  const results: MetricResultEnvelope[] = [];

  for (const metricId of request.metricIds) {
    // Fail-fast on unknown metrics (as mandated by the plan)
    if (!['ACT-004', 'FIN-006', 'STK-005', 'FIN-015'].includes(metricId)) {
      throw new Error(`Unknown metric ID requested: ${metricId}`);
    }

    // Mock response envelope
    results.push({
      metric_result_id: `mr_${Date.now()}_${metricId}`,
      metric_id: metricId,
      metric_version: '1.0.0',
      calculation_run_id: `run_${Date.now()}`,
      value: 125000, // Mock value
      unit: metricId.startsWith('STK') ? 'LT' : 'TRY',
      value_type: 'numeric',
      status: 'SUCCESS',
      period: request.period || 'CURRENT',
      filters: request.filters,
      as_of: new Date().toISOString()
    });
  }

  return results;
}

/**
 * Compares a metric across two periods.
 */
export function compareMetrics(request: CompareMetricsRequest): CompareResult {
  const baseResult = queryMetrics({
    metricIds: [request.metricId],
    period: request.basePeriod,
    filters: request.filters
  })[0];

  const compareResult = queryMetrics({
    metricIds: [request.metricId],
    period: request.comparePeriod,
    filters: request.filters
  })[0];

  // In a real system, we'd extract actual numerical values.
  // Using mocks for now. Let's pretend base was 100000 and compare is 125000.
  const baseValue: number = 100000;
  const compareValue = 125000;

  // Override the mocked queryMetrics values just for comparison demonstration
  baseResult.value = baseValue;
  compareResult.value = compareValue;

  const delta = compareValue - baseValue;
  const percentageChange = baseValue === 0 
    ? (delta > 0 ? 100 : 0) // Or null, but let's use 100% for growth from 0, 0 for no change
    : (delta / baseValue) * 100;

  return {
    base: baseResult,
    compare: compareResult,
    delta,
    percentageChange
  };
}
