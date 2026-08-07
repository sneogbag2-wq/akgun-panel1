import { describe, expect, it } from 'vitest';
import { AI_REPORTING_LIMITS, buildCompactToolResponse, buildExecutiveReportChatSummary, createAiReportDescriptor } from '../aiReportUtils';

describe('AI large result reporting', () => {
  const largeResult = {
    totalBalance: 125000,
    customers: Array.from({ length: 30 }, (_, index) => ({
      customerId: `5000000${index}`,
      customerName: `Müşteri ${index}`,
      balance: index * 1000
    }))
  };

  it('moves large row sets to a downloadable report descriptor', () => {
    const report = createAiReportDescriptor('searchCustomers', largeResult);

    expect(report).not.toBeNull();
    expect(report?.rowCount).toBe(30);
    expect(report!.columns!.map((column) => column.key)).toEqual(expect.arrayContaining(['customerId', 'customerName', 'balance']));
    expect(report!.columns!.find((column) => column.key === 'customerId')?.dataType).toBe('identifier');
    expect(report!.columns!.find((column) => column.key === 'balance')?.dataType).toBe('currency');
    expect(report?.summaryBoxes.length).toBeLessThanOrEqual(AI_REPORTING_LIMITS.maxSummaryMetrics);
  });

  it('sends only a compact management summary back to the model', () => {
    const report = createAiReportDescriptor('searchCustomers', largeResult);
    const compact = buildCompactToolResponse(largeResult, report) as Record<string, any>;

    expect(compact.status).toBe('LARGE_DATASET_EXPORTED');
    expect(compact.rowCount).toBe(30);
    expect(JSON.stringify(compact)).not.toContain('Müşteri 29');
    expect(compact.summary.totalBalance).toBe(125000);
  });

  it('excludes direct personal identifiers from the model summary while retaining aggregate metrics', () => {
    const report = createAiReportDescriptor('searchCustomers', largeResult);
    const compact = buildCompactToolResponse({
      customerName: 'Gizli Cari',
      customerId: '5000123456',
      phone: '5551234567',
      totalBalance: 125000,
      customerCount: 30
    }, report) as Record<string, any>;

    expect(compact.summary).toEqual({ totalBalance: 125000, customerCount: 30 });
    expect(JSON.stringify(compact.summary)).not.toMatch(/Gizli Cari|5000123456|5551234567/);
  });

  it('keeps small results inline for a direct conversational answer', () => {
    const result = { customers: [{ customerName: 'Küçük Liste' }] };
    expect(createAiReportDescriptor('searchCustomers', result)).toBeNull();
    expect(buildCompactToolResponse(result, null)).toBe(result);
  });

  it('renders at most five safe management-summary bullets when reports are available', () => {
    const reports = ['searchCustomers', 'queryTransactions', 'getShipmentTrackingReport', 'getSalesRepSummary']
      .map((toolName) => createAiReportDescriptor(toolName, largeResult))
      .filter((report): report is NonNullable<typeof report> => report !== null);
    const summary = buildExecutiveReportChatSummary(reports);

    expect(summary.match(/^- /gm)).toHaveLength(AI_REPORTING_LIMITS.maxSummaryMetrics);
    expect(summary).toContain('Müşteri Arama Raporu');
    expect(summary).toContain('Excel indir');
    expect(summary).not.toContain('Müşteri 29');
    expect(summary).not.toContain('|');
  });
});
