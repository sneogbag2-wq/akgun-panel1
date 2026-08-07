/**
 * Read-only AI tool handlers.
 *
 * The execution boundary intentionally lives outside aiTools.ts: registering a
 * new reporting tool is now a local change, while mutation confirmation and
 * administration remain in the main dispatcher.
 */
import { fetchApi } from '../lib/apiClient';
import {
  getCollectionEffectivenessIndexSync,
  getCurrentStatusSync,
  getCustomerPaymentTrendSync,
  getDashboardChartDataSync,
  getFinancialHealthReportSync,
  getGlobalFinancialSummarySync,
  getGlobalHighestTransactionsSync,
  getInvoiceControlReportSync,
  getMonthlyComparisonSync,
  getMonthlyRiskAndRevenueReportSync,
  getOverdueCustomersListSync,
  getParetoConcentrationAnalysisSync
} from './customerService';
import { formatCurrency } from '../utils/formatters';
import {
  getCustomerReadToolHandler,
  getRegisteredCustomerReadToolNames
} from './aiCustomerReadToolRegistry';
import {
  getAnalyticsReadToolHandler,
  getRegisteredAnalyticsReadToolNames
} from './aiAnalyticsReadToolRegistry';

export type AiToolArgs = Record<string, unknown>;
export type AiToolHandler = (args: AiToolArgs) => unknown | Promise<unknown>;

function getString(args: AiToolArgs, key: string, fallback = ''): string {
  const value = args[key];
  return typeof value === 'string' ? value : fallback;
}

function getNumber(args: AiToolArgs, key: string, fallback: number): number {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const handlers: Record<string, AiToolHandler> = {
  getFinancialHealthReport: (args) => getFinancialHealthReportSync(getString(args, 'query')),

  getInvoiceControlReport: (args) => getInvoiceControlReportSync(args),

  getParetoConcentrationAnalysis: () => getParetoConcentrationAnalysisSync(),

  getCollectionEffectivenessIndex: (args) => getCollectionEffectivenessIndexSync(getString(args, 'query')),

  getGlobalHighestTransactions: (args) => {
    const type = getString(args, 'type', 'TAHSILAT').toUpperCase();
    const limit = getNumber(args, 'limit', 5);
    const transactions = getGlobalHighestTransactionsSync({ type, limit });
    const highestRecord = transactions[0] || null;

    return {
      type,
      count: transactions.length,
      highestRecord,
      transactions,
      summary: highestRecord
        ? `Tüm veritabanı genelinde en yüksek ${type} işlemi: ${highestRecord.formattedAmount} (Müşteri: ${highestRecord.customerName}, Tarih: ${highestRecord.formattedDate})`
        : 'Kayıt bulunamadı'
    };
  },

  getMonthlyComparisonReport: (args) => getMonthlyComparisonSync({
    query: getString(args, 'query'),
    period1: getString(args, 'period1', 'Nisan'),
    period2: getString(args, 'period2', 'Mayıs')
  }),

  getMonthlyRiskAndRevenueReport: (args) => getMonthlyRiskAndRevenueReportSync(args),

  getCollectionBreakdown: () => {
    const breakdown = getDashboardChartDataSync().tahsilatData || [];
    const total = breakdown.reduce((sum: number, item: any) => sum + (item.value || 0), 0);

    return {
      totalCollections: formatCurrency(total),
      breakdown: breakdown.map((item: any) => ({
        method: item.name,
        amount: formatCurrency(item.value),
        rawAmount: item.value,
        percentage: total > 0 ? `${((item.value / total) * 100).toFixed(1)}%` : '0%'
      }))
    };
  },

  getCustomerPaymentTrend: (args) => getCustomerPaymentTrendSync(getString(args, 'query')),

  getGlobalFinancialSummary: () => {
    const summary = getGlobalFinancialSummarySync();
    return {
      totalSales: formatCurrency(summary.totalSalesAmount || summary.totalSales || 0),
      totalCollections: formatCurrency(summary.totalCollectionAmount || summary.totalCollections || 0),
      totalCreditNotes: formatCurrency(summary.totalCreditNoteAmount || summary.totalCreditNotes || 0),
      netReceivables: formatCurrency(summary.totalNetReceivables || summary.netReceivables || 0),
      raw: summary
    };
  },

  getCurrentStatus: () => {
    const status = getCurrentStatusSync();
    return {
      openInvoicesCount: status.openInvoiceCount || status.openInvoicesCount || 0,
      todayCollections: formatCurrency(status.todayCollections || 0),
      averageTermDays: typeof status.portfolioAverageTerm === 'number' ? `${status.portfolioAverageTerm} gün` : '0 gün',
      raw: status
    };
  },

  getOverdueCustomersList: (args) => getOverdueCustomersListSync(getNumber(args, 'minDays', 90)),

  getAgingBreakdown: () => ({
    agingBuckets: (getDashboardChartDataSync().vadeData || []).map((bucket: any) => ({
      range: bucket.name,
      amount: formatCurrency(bucket.value),
      rawAmount: bucket.value
    }))
  }),

  getPaymentMethodsBreakdown: () => ({
    methods: (getDashboardChartDataSync().tahsilatData || []).map((method: any) => ({
      method: method.name,
      amount: formatCurrency(method.value),
      rawAmount: method.value
    }))
  }),

  // Phase 3 Stage 2: AI Panel Integration
  getMetricRegistry: async () => {
    try {
      const res = await fetchApi('/advanced/metric-registry');
      return res.data || [];
    } catch (error: any) {
      return { error: 'Failed to fetch metric registry: ' + error.message };
    }
  },

  getAiLogs: async () => {
    try {
      const res = await fetchApi('/advanced/ai-logs');
      return res.data || [];
    } catch (error: any) {
      return { error: 'Failed to fetch AI logs: ' + error.message };
    }
  }
};

export function getReadToolHandler(toolName: string): AiToolHandler | undefined {
  return handlers[toolName] || getCustomerReadToolHandler(toolName) || getAnalyticsReadToolHandler(toolName);
}

export function getRegisteredReadToolNames(): string[] {
  return [
    ...Object.keys(handlers),
    ...getRegisteredCustomerReadToolNames(),
    ...getRegisteredAnalyticsReadToolNames()
  ];
}
