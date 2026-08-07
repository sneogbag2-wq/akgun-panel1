import { describe, expect, it } from 'vitest';
import { buildExecutiveReportWorkbook } from '../exportUtils';

describe('executive AI report workbook', () => {
  const workbook = buildExecutiveReportWorkbook({
    title: 'Tahsilat Riski',
    subtitle: 'Temmuz 2026',
    columns: [
      { key: 'customerId', header: 'Müşteri Kodu', dataType: 'identifier' },
      { key: 'balance', header: 'Bakiye', dataType: 'currency', isNumeric: true },
      { key: 'riskRate', header: 'Risk Oranı', dataType: 'percentage', isNumeric: true },
      { key: 'dueDate', header: 'Vade Tarihi', dataType: 'date' },
      { key: 'note', header: 'Not', dataType: 'text' }
    ],
    rows: [{ customerId: '50000001', balance: -1250.5, riskRate: 0.25, dueDate: '2026-07-31', note: '=SUM(A1:A2)' }],
    summaryBoxes: [{ label: 'TOPLAM BAKİYE', value: '1.250,50 TL' }]
  });

  it('creates the executive summary, detail, and data dictionary sheets', () => {
    expect(workbook.SheetNames).toEqual(['Detay Rapor', 'Yönetici Özeti', 'Veri Sözlüğü']);
    expect(workbook.Sheets['Detay Rapor']['!autofilter']).toEqual({ ref: 'A6:E7' });
    expect(workbook.Sheets['Detay Rapor']['!freeze']).toMatchObject({ ySplit: 6, state: 'frozen' });
    expect(workbook.Sheets['Yönetici Özeti'].B8.f).toBe("COUNTA('Detay Rapor'!A7:A7)");
  });

  it('formats typed values and protects spreadsheet formulas', () => {
    const detail = workbook.Sheets['Detay Rapor'];
    expect(detail.B7.z).toBe('#,##0.00;[Red](#,##0.00);-');
    expect(detail.C7.z).toBe('0.00%');
    expect(detail.D7.z).toBe('yyyy-mm-dd');
    expect(detail.E7.v).toBe("'=SUM(A1:A2)");
    expect(workbook.Sheets['Veri Sözlüğü'].C5.v).toBe('Yüzde');
    expect(workbook.Sheets['Veri Sözlüğü'].C6.v).toBe('Tarih');
  });
});
