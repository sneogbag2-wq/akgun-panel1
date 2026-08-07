import { describe, expect, it } from 'vitest';
import { buildPrintableReportHtml } from '../exportUtils';

describe('printable report markup', () => {
  const columns = Array.from({ length: 7 }, (_, index) => ({
    key: `column${index}`,
    header: `Alan ${index + 1}`,
    align: index > 4 ? 'right' as const : 'left' as const
  }));
  const row = Object.fromEntries(columns.map((column, index) => [column.key, index === 0 ? '<img src=x onerror=alert(1)>' : `Değer ${index}`]));

  it('uses landscape A4, repeating headers, and page-safe table rows for wide reports', () => {
    const html = buildPrintableReportHtml({ title: 'Geniş Rapor', columns, rows: [row] });

    expect(html).toContain('@page { size: A4 landscape;');
    expect(html).toContain('thead { display: table-header-group; }');
    expect(html).toContain('tr, .info-card, .summary-card { break-inside: avoid; page-break-inside: avoid; }');
    expect(html).toContain('<span>1 kayıt</span>');
  });

  it('escapes report values before they are written to the print document', () => {
    const html = buildPrintableReportHtml({
      title: '<b>Rapor</b>',
      customer: { customerName: 'Müşteri <script>alert(1)</script>' },
      columns: columns.slice(0, 2),
      rows: [row],
      summaryBoxes: [{ label: '<b>Risk</b>', value: '<script>alert(1)</script>' }]
    });

    expect(html).toContain('&lt;b&gt;Rapor&lt;/b&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
