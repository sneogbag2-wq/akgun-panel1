import * as XLSX from 'xlsx';
import { formatCurrency, formatDate } from './formatters';
import { getCustomerStatementSync, searchCustomersSync } from '../services/customerService';
import type { AiReportDataType } from '../types/ai';

export function exportToCorporateExcel({
  title = 'CARİ HESAP EKSTRESİ',
  customer,
  subtitle = '',
  columns,
  rows,
  fileName = 'Rapor.xlsx',
  sheetName = 'Ekstre'
}: {
  title?: string;
  customer?: any;
  subtitle?: string;
  columns: any[];
  rows: any[];
  fileName?: string;
  sheetName?: string;
}) {
  try {
    const custName = customer?.signName || customer?.customerName || 'Tüm Şirket (Genel)';
    const custId = customer?.customerId || '-';
    const salesRep = customer?.salesRepName || customer?.salesRep || 'Key Account';
    const reportDate = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const totalCols = columns.length;
    const lastColIdx = Math.max(0, totalCols - 1);

    const sheetData: any[][] = [
      ['AKGÜN MEŞRUBAT GIDA SAN. VE TİC. LTD. ŞTİ.'],
      [`RAPOR: ${title.toUpperCase()} ${subtitle ? `(${subtitle})` : ''}`],
      [`Cari Adı: ${custName}  |  Cari Kod: ${custId}  |  Temsilci: ${salesRep}`],
      [`Rapor Oluşturma Tarihi: ${reportDate}`],
      [],
      columns.map(c => c.header)
    ];

    rows.forEach(r => {
      const rowValues = columns.map(c => {
        const rawVal = c.excelValue ? c.excelValue(r) : (c.key ? r[c.key] : '');
        if (c.isNumeric) {
          const num = parseFloat(rawVal) || 0;
          return Math.round(num * 100) / 100;
        }
        return rawVal ?? '';
      });
      sheetData.push(rowValues);
    });

    const hasNumericCols = columns.some(c => c.isNumeric);
    const summaryRowIdx = sheetData.length + 1;
    
    if (hasNumericCols) {
      sheetData.push([]);
      const totalRow = columns.map((c, idx) => {
        if (idx === 0) return 'GENEL TOPLAM / SON DURUM';
        if (c.isNumeric && c.key) {
          const sum = rows.reduce((acc, curr) => acc + (parseFloat(curr[c.key]) || 0), 0);
          return Math.round(sum * 100) / 100;
        }
        return '';
      });
      sheetData.push(totalRow);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    const firstNumericColIdx = columns.findIndex(c => c.isNumeric);
    const labelMergeEndCol = firstNumericColIdx > 0 ? firstNumericColIdx - 1 : Math.max(0, totalCols - 4);

    const merges: XLSX.Range[] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastColIdx } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastColIdx } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: lastColIdx } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: lastColIdx } }
    ];

    if (hasNumericCols) {
      merges.push({ s: { r: summaryRowIdx, c: 0 }, e: { r: summaryRowIdx, c: labelMergeEndCol } });
    }

    worksheet['!merges'] = merges;

    const colWidths = columns.map((col, colIdx) => {
      let maxLen = (col.header || '').length;
      sheetData.slice(5).forEach(row => {
        const val = row[colIdx];
        if (val !== undefined && val !== null) {
          const strLen = String(val).length;
          if (strLen > maxLen) maxLen = strLen;
        }
      });
      return { wch: Math.max(maxLen + 5, 16) };
    });

    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const cleanFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName.replace('.xls', '')}.xlsx`;
    XLSX.writeFile(workbook, cleanFileName);

  } catch (error) {
    console.error('Kurumsal Excel oluşturma hatası:', error);
    exportToBasicExcel(rows, fileName, sheetName);
  }
}

export function exportToBasicExcel(data: any[], fileName = 'Rapor.xlsx', sheetName = 'Sayfa1') {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, fileName);
  } catch (error: any) {
    console.error('Basic Excel Error:', error);
    alert(`Excel dosyası oluşturulamadı: ${error.message}`);
  }
}

type ExecutiveReportColumn = {
  key: string;
  header: string;
  isNumeric?: boolean;
  dataType?: AiReportDataType;
  excelValue?: (row: any) => unknown;
};

function safeExcelValue(value: unknown): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value === 'number' || typeof value === 'boolean') return value;
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function getExecutiveCellValue(column: ExecutiveReportColumn, row: any): string | number | boolean | Date | null {
  const value = column.excelValue ? column.excelValue(row) : row[column.key];
  if (column.dataType === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return safeExcelValue(value);
}

function isMoneyLikeColumn(column: ExecutiveReportColumn): boolean {
  return /(tutar|bakiye|borç|alacak|satış|tahsilat|ciro|amount|balance|debit|credit|sales|collection|revenue|total)/i.test(`${column.key} ${column.header}`);
}

/**
 * AI tarafından üretilen büyük listeler için çalışma kitabı şeması: yönetici özeti,
 * filtrelenebilir ayrıntı ve veri sözlüğü. `buildExecutiveReportWorkbook` ayrıca
 * testlerde dosyaya yazmadan şemayı doğrulamak için dışa aktarılmıştır.
 */
export function buildExecutiveReportWorkbook({
  title,
  subtitle = '',
  columns,
  rows,
  summaryBoxes = [],
  sheetName = 'Detay Rapor'
}: {
  title: string;
  subtitle?: string;
  columns: ExecutiveReportColumn[];
  rows: any[];
  summaryBoxes?: Array<{ label: string; value: string; color?: string }>;
  sheetName?: string;
}) {
  const workbook = XLSX.utils.book_new();
  const generatedAt = new Date().toLocaleString('tr-TR');
  const detailSheetName = sheetName.slice(0, 31) || 'Detay Rapor';
  const headerRow = 6;
  const firstDataRow = headerRow + 1;
  const lastDataRow = Math.max(firstDataRow, firstDataRow + rows.length - 1);
  const detailMatrix: any[][] = [
    ['AKGÜN MEŞRUBAT GIDA SAN. VE TİC. LTD. ŞTİ.'],
    [title.toUpperCase()],
    [subtitle || 'Karar desteği için ayrıntılı analiz raporu'],
    [`Oluşturulma: ${generatedAt}`],
    [],
    columns.map((column) => column.header),
    ...rows.map((row) => columns.map((column) => getExecutiveCellValue(column, row)))
  ];
  const detailSheet = XLSX.utils.aoa_to_sheet(detailMatrix);
  const lastColumn = XLSX.utils.encode_col(Math.max(0, columns.length - 1));
  detailSheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, columns.length - 1) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(0, columns.length - 1) } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: Math.max(0, columns.length - 1) } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: Math.max(0, columns.length - 1) } }
  ];
  detailSheet['!autofilter'] = { ref: `A${headerRow}:${lastColumn}${lastDataRow}` };
  detailSheet['!freeze'] = { xSplit: 0, ySplit: headerRow, topLeftCell: `A${firstDataRow}`, activePane: 'bottomLeft', state: 'frozen' };
  detailSheet['!cols'] = columns.map((column) => ({ wch: Math.min(42, Math.max(14, column.header.length + 4)) }));
  detailSheet['!rows'] = [{ hpt: 24 }, { hpt: 20 }, { hpt: 18 }];

  columns.forEach((column, index) => {
    if (!column.isNumeric && column.dataType !== 'date') return;
    const letter = XLSX.utils.encode_col(index);
    for (let row = firstDataRow; row <= lastDataRow; row++) {
      const cell = detailSheet[`${letter}${row}`];
      if (!cell) continue;
      if (column.dataType === 'date') {
        cell.z = 'yyyy-mm-dd';
      } else if (typeof cell.v === 'number') {
        cell.z = column.dataType === 'percentage'
          ? '0.00%'
          : isMoneyLikeColumn(column) ? '#,##0.00;[Red](#,##0.00);-' : '#,##0;[Red](#,##0);-';
      }
    }
  });
  XLSX.utils.book_append_sheet(workbook, detailSheet, detailSheetName);

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['AKGÜN MEŞRUBAT GIDA - YÖNETİCİ RAPORU'],
    [title],
    [subtitle || 'Detay veri ayrı sekmede filtrelenebilir olarak sunulmuştur.'],
    [`Rapor tarihi: ${generatedAt}`],
    [],
    ['YÖNETİCİ ÖZETİ'],
    ['KPI', 'DEĞER', 'AÇIKLAMA'],
    ['Kayıt sayısı', null, `Kaynak: ${detailSheetName}`],
    ...summaryBoxes.map((box) => [box.label, box.value, 'Araç sonucundan türetilen gösterge']),
    [],
    ['RAPOR KULLANIM NOTU'],
    ['1. Bu sayfa karar özeti içindir.'],
    [`2. ${detailSheetName} sekmesinde filtre, sabit başlık ve sayısal biçimler vardır.`],
    ['3. Veri Sözlüğü sekmesi alanların anlamını ve veri türlerini açıklar.']
  ]);
  summarySheet['B8'] = { t: 'n', f: `COUNTA('${detailSheetName}'!A${firstDataRow}:A${lastDataRow})`, z: '#,##0;[Red](#,##0);-' };
  summarySheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: 2 } },
    { s: { r: 10 + summaryBoxes.length, c: 0 }, e: { r: 10 + summaryBoxes.length, c: 2 } }
  ];
  summarySheet['!cols'] = [{ wch: 28 }, { wch: 24 }, { wch: 52 }];
  summarySheet['!rows'] = [{ hpt: 26 }, { hpt: 22 }, { hpt: 18 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Yönetici Özeti');

  const dictionarySheet = XLSX.utils.aoa_to_sheet([
    ['VERİ SÖZLÜĞÜ'],
    ['ALAN', 'RAPOR BAŞLIĞI', 'VERİ TÜRÜ', 'KULLANIM NOTU'],
    ...columns.map((column) => [
      column.key,
      column.header,
      column.dataType === 'currency' || isMoneyLikeColumn(column)
        ? 'Para / finansal değer'
        : column.dataType === 'percentage'
          ? 'Yüzde'
          : column.dataType === 'date'
            ? 'Tarih'
            : column.dataType === 'identifier'
              ? 'Kimlik / kod'
              : column.isNumeric ? 'Sayısal değer' : 'Metin',
      'Detay Rapor sekmesinden filtrelenebilir ve denetlenebilir.'
    ])
  ]);
  dictionarySheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  dictionarySheet['!autofilter'] = { ref: `A2:D${Math.max(2, columns.length + 2)}` };
  dictionarySheet['!freeze'] = { xSplit: 0, ySplit: 2, topLeftCell: 'A3', activePane: 'bottomLeft', state: 'frozen' };
  dictionarySheet['!cols'] = [{ wch: 28 }, { wch: 30 }, { wch: 24 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(workbook, dictionarySheet, 'Veri Sözlüğü');

  workbook.Props = { Title: title, Subject: subtitle, Author: 'AKGÜN Panel', Company: 'AKGÜN Meşrubat Gıda' };
  return workbook;
}

export function exportToExecutiveExcel(options: Parameters<typeof buildExecutiveReportWorkbook>[0] & { fileName: string }) {
  try {
    const workbook = buildExecutiveReportWorkbook(options);
    const fileName = options.fileName.endsWith('.xlsx') ? options.fileName : `${options.fileName}.xlsx`;
    XLSX.writeFile(workbook, fileName, { compression: true });
  } catch (error: any) {
    console.error('Yönetici Excel raporu oluşturma hatası:', error);
    alert(`Excel raporu oluşturulamadı: ${error.message}`);
  }
}

type PrintableReportColumn = {
  key?: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  render?: (row: any) => unknown;
};

type PrintableReportOptions = {
  title: string;
  customer?: any;
  subtitle?: string;
  columns: PrintableReportColumn[];
  rows: any[];
  summaryBoxes?: Array<{ label: string; value: string; color?: string }>;
};

function escapePrintableHtml(value: unknown): string {
  return String(value ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Tarayıcı yazdırma penceresi için A4 uyumlu rapor işaretlemesi üretir. Saf fonksiyon
 * olması, sayfa düzeni ve güvenli metin üretiminin DOM olmadan test edilmesini sağlar.
 */
export function buildPrintableReportHtml({ title, customer, subtitle, columns, rows, summaryBoxes }: PrintableReportOptions): string {
  const orientation = columns.length > 6 ? 'landscape' : 'portrait';
  const safeTitle = escapePrintableHtml(title);
  const safeSubtitle = escapePrintableHtml(subtitle || '');
  const custName = customer?.signName || customer?.customerName || 'Tüm Şirket (Genel)';
  const custId = customer?.customerId || '-';
  const salesRep = customer?.salesRepName || customer?.salesRep || 'Key Account';
  const printDate = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const summaryHtml = summaryBoxes && summaryBoxes.length > 0 ? `
    <section class="summary-grid" aria-label="Temel göstergeler">
      ${summaryBoxes.map(b => `
        <div class="summary-card">
          <div class="summary-label">${escapePrintableHtml(b.label)}</div>
          <div class="summary-value" style="color: ${/^#[0-9a-f]{3,8}$/i.test(b.color || '') ? b.color : '#0F172A'};">${escapePrintableHtml(b.value)}</div>
        </div>
      `).join('')}
    </section>
  ` : '';

  const tableHeaderHtml = `
    <thead>
      <tr>
        ${columns.map(c => `<th class="align-${c.align || 'left'}">${escapePrintableHtml(c.header)}</th>`).join('')}
      </tr>
    </thead>
  `;

  const tableBodyHtml = `
    <tbody>
      ${rows.map((r, idx) => `
        <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
          ${columns.map(c => `<td class="align-${c.align || 'left'}">${escapePrintableHtml(c.render ? c.render(r) : (r[c.key || ''] ?? '-'))}</td>`).join('')}
        </tr>
      `).join('')}
    </tbody>
  `;

  const html = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>${safeTitle} - ${escapePrintableHtml(custName)}</title>
      <style>
        @page { size: A4 ${orientation}; margin: 12mm 10mm 18mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A; margin: 0; padding: 20px; font-size: 12px; background: #FFFFFF; }
        .report-document { max-width: ${orientation === 'landscape' ? '277mm' : '190mm'}; margin: 0 auto; }
        .brand-container { display: flex; justify-content: space-between; align-items: flex-end; gap: 18px; border-bottom: 2px solid #8A6D1F; padding-bottom: 12px; margin-bottom: 16px; }
        .brand-title { font-size: 22px; font-weight: 900; color: #8A6D1F; letter-spacing: -0.5px; line-height: 1.1; }
        .brand-subtitle { font-size: 11px; color: #64748B; font-weight: 600; margin-top: 2px; }
        .report-title-box { text-align: right; }
        .report-title { font-size: 18px; font-weight: 800; color: #0F172A; text-transform: uppercase; letter-spacing: -0.3px; }
        .report-subtitle { font-size: 11px; color: #64748B; margin-top: 2px; }
        .info-card { background: #F1F5F9; border: 1px solid #CBD5E1; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px 15px; }
        .info-item { font-size: 11px; color: #475569; }
        .info-item strong { color: #0F172A; font-weight: 700; margin-left: 4px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 10px; margin: 0 0 16px; break-inside: avoid; page-break-inside: avoid; }
        .summary-card { background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; padding: 10px 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
        .summary-label { font-size: 10px; color: #64748B; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
        .summary-value { font-size: 16px; font-weight: 800; margin-top: 4px; overflow-wrap: anywhere; }
        .table-heading { display: flex; justify-content: space-between; align-items: baseline; margin: 16px 0 7px; }
        .table-heading h2 { margin: 0; font-size: 13px; color: #0F172A; }
        .table-heading span { font-size: 10px; color: #64748B; }
        table.data-table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1px solid #CBD5E1; }
        th { background: #0F172A; color: #FFFFFF; padding: 8px 9px; font-size: 10px; text-transform: uppercase; border: 1px solid #334155; font-weight: 700; letter-spacing: 0.03em; overflow-wrap: anywhere; }
        td { padding: 7px 9px; font-size: 10px; color: #0F172A; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #F1F5F9; vertical-align: top; overflow-wrap: anywhere; }
        .row-odd { background: #F8FAFC; } .row-even { background: #FFFFFF; }
        .align-left { text-align: left; } .align-right { text-align: right; } .align-center { text-align: center; }
        .footer { margin-top: 24px; border-top: 1px solid #E2E8F0; padding-top: 10px; font-size: 9px; color: #64748B; display: flex; justify-content: space-between; gap: 12px; }
        @media print {
          body { padding: 0; }
          .report-document { max-width: none; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          tr, .info-card, .summary-card { break-inside: avoid; page-break-inside: avoid; }
          th { padding: 6px 7px; } td { padding: 5px 7px; }
          .footer { position: fixed; bottom: 5mm; left: 10mm; right: 10mm; }
        }
        @media screen and (max-width: 700px) { .brand-container { align-items: flex-start; flex-direction: column; } .report-title-box { text-align: left; } .info-card { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      </style>
    </head>
    <body>
      <main class="report-document">
      <header class="brand-container">
        <div>
          <div class="brand-title">AKGÜN MEŞRUBAT GIDA</div>
          <div class="brand-subtitle">Finansal Dağıtım & Risk Yönetim Sistemi</div>
        </div>
        <div class="report-title-box">
          <div class="report-title">${safeTitle}</div>
          <div class="report-subtitle">${safeSubtitle}</div>
        </div>
      </header>

      <section class="info-card" aria-label="Rapor kapsamı">
        <div class="info-item">Cari Adı:<strong>${escapePrintableHtml(custName)}</strong></div>
        <div class="info-item">Cari Kod:<strong>${escapePrintableHtml(custId)}</strong></div>
        <div class="info-item">Temsilci:<strong>${escapePrintableHtml(salesRep)}</strong></div>
        <div class="info-item">Rapor Tarihi:<strong>${escapePrintableHtml(printDate)}</strong></div>
      </section>

      ${summaryHtml}

      <div class="table-heading"><h2>Ayrıntılı Kayıtlar</h2><span>${rows.length} kayıt</span></div>
      <table class="data-table">
        ${tableHeaderHtml}
        ${tableBodyHtml}
      </table>

      <div class="footer">
        <span>AKGÜN Meşrubat Gıda San. ve Tic. Ltd. Şti. — Resmi Rapor Çıktısı</span>
        <span>Raporlama Sistemi v1.1</span>
      </div>
      </main>
    </body>
    </html>
  `;

  return html;
}

export function printReportHTML(options: PrintableReportOptions) {
  const printWindow = window.open('', '_blank', 'width=1050,height=850');
  if (!printWindow) {
    alert('Yazdırma penceresi açılamadı. Lütfen tarayıcınızın pop-up engelleyicisini kontrol edin.');
    return;
  }

  const html = buildPrintableReportHtml(options);
  printWindow.onload = () => printWindow.setTimeout(() => printWindow.print(), 300);

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export function parseDateRangeFromQuery(query = '') {
  if (!query || typeof query !== 'string') return null;
  const q = query.toLowerCase();
  const months = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
  
  const rangeMatch = q.match(/(\d{1,2})\s+([a-zğüşıöç]+)(?:\s+(\d{4}))?\s*[-–—a-zğüşıöç\s]*\s*(\d{1,2})\s+([a-zğüşıöç]+)(?:\s+(\d{4}))?/i);
  if (rangeMatch) {
    const day1 = parseInt(rangeMatch[1], 10);
    const m1Idx = months.indexOf(rangeMatch[2].toLowerCase());
    const year1 = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : 2026;

    const day2 = parseInt(rangeMatch[4], 10);
    const m2Idx = months.indexOf(rangeMatch[5].toLowerCase());
    const year2 = rangeMatch[6] ? parseInt(rangeMatch[6], 10) : year1;

    if (m1Idx !== -1 && m2Idx !== -1) {
      const startDate = `${year1}-${String(m1Idx + 1).padStart(2, '0')}-${String(day1).padStart(2, '0')}`;
      const endDate = `${year2}-${String(m2Idx + 1).padStart(2, '0')}-${String(day2).padStart(2, '0')}`;
      return { startDate, endDate };
    }
  }

  for (let i = 0; i < months.length; i++) {
    if (q.includes(months[i])) {
      const mNum = String(i + 1).padStart(2, '0');
      const lastDay = new Date(2026, i + 1, 0).getDate();
      return {
        startDate: `2026-${mNum}-01`,
        endDate: `2026-${mNum}-${String(lastDay).padStart(2, '0')}`
      };
    }
  }

  return null;
}

export function triggerCustomerPDFPrintSync(customerIdOrQuery: string, options: any = {}) {
  try {
    let stmt = getCustomerStatementSync(customerIdOrQuery);
    if (!stmt || !stmt.transactions || stmt.transactions.length === 0) {
      const matched = searchCustomersSync(customerIdOrQuery, true);
      if (matched && matched.length > 0) {
        stmt = getCustomerStatementSync(matched[0].customerId);
      }
    }
    if (!stmt || !stmt.customer) {
      alert(`Belirtilen cari hesap (${customerIdOrQuery}) için kayıt bulunamadı.`);
      return false;
    }

    let rows = stmt.transactions || [];
    let startDate = options?.startDate;
    let endDate = options?.endDate;

    if (!startDate && typeof customerIdOrQuery === 'string') {
      const parsed = parseDateRangeFromQuery(customerIdOrQuery);
      if (parsed) {
        startDate = parsed.startDate;
        endDate = parsed.endDate;
      }
    }

    if (startDate && endDate) {
      rows = rows.filter((r: any) => {
        const d = String(r.date || '');
        return d >= startDate && d <= endDate;
      });
    }

    const totalSales = rows.filter((r: any) => (r.type || '') === 'SATIŞ').reduce((sum: number, r: any) => sum + (r.debit || 0), 0);
    const totalCollections = rows.filter((r: any) => (r.type || '').includes('TAHSİLAT')).reduce((sum: number, r: any) => sum + (r.credit || 0), 0);
    
    let subtitleStr = `Toplam ${rows.length} Hareket`;
    if (startDate && endDate) {
      subtitleStr = `${formatDate(startDate)} - ${formatDate(endDate)} Tarihleri Arası (${rows.length} İşlem)`;
    }

    printReportHTML({
      title: 'CARİ HESAP EKSTRESİ',
      customer: stmt.customer,
      subtitle: subtitleStr,
      summaryBoxes: [
        { label: 'GÜNCEL BAKİYE', value: `${formatCurrency(Math.abs(stmt.balance || 0))} ${stmt.balance > 0 ? '(B)' : '(A)'}`, color: stmt.balance > 0 ? '#dc2626' : '#059669' },
        { label: 'DÖNEM SATIŞ', value: formatCurrency(totalSales), color: '#2563eb' },
        { label: 'DÖNEM TAHSİLAT', value: formatCurrency(totalCollections), color: '#059669' }
      ],
      columns: [
        { header: 'İşlem Tarihi', render: (r: any) => formatDate(r.date) },
        { header: 'İşlem Türü', render: (r: any) => r.type },
        { header: 'Belge No', render: (r: any) => r.docNo },
        { header: 'Açıklama', render: (r: any) => r.description },
        { header: 'Borç (TL)', align: 'right', render: (r: any) => r.debit > 0 ? formatCurrency(r.debit) : '-' },
        { header: 'Alacak (TL)', align: 'right', render: (r: any) => r.credit > 0 ? formatCurrency(r.credit) : '-' },
        { header: 'Bakiye (TL)', align: 'right', render: (r: any) => `${formatCurrency(Math.abs(r.balance))} ${r.balance > 0 ? '(B)' : '(A)'}` }
      ],
      rows: rows
    });
    return true;
  } catch (err) {
    console.error('triggerCustomerPDFPrintSync error:', err);
    return false;
  }
}

export function triggerCustomerExcelExportSync(customerIdOrQuery: string, options: any = {}) {
  try {
    let stmt = getCustomerStatementSync(customerIdOrQuery);
    if (!stmt || !stmt.transactions || stmt.transactions.length === 0) {
      const matched = searchCustomersSync(customerIdOrQuery, true);
      if (matched && matched.length > 0) {
        stmt = getCustomerStatementSync(matched[0].customerId);
      }
    }
    if (!stmt || !stmt.customer) {
      alert(`Belirtilen cari hesap (${customerIdOrQuery}) için kayıt bulunamadı.`);
      return false;
    }

    let rows = stmt.transactions || [];
    let startDate = options?.startDate;
    let endDate = options?.endDate;

    if (!startDate && typeof customerIdOrQuery === 'string') {
      const parsed = parseDateRangeFromQuery(customerIdOrQuery);
      if (parsed) {
        startDate = parsed.startDate;
        endDate = parsed.endDate;
      }
    }

    if (startDate && endDate) {
      rows = rows.filter((r: any) => {
        const d = String(r.date || '');
        return d >= startDate && d <= endDate;
      });
    }

    let subtitleStr = `Toplam ${rows.length} Hareket`;
    if (startDate && endDate) {
      subtitleStr = `${formatDate(startDate)} - ${formatDate(endDate)} Tarihleri Arası (${rows.length} İşlem)`;
    }

    exportToCorporateExcel({
      title: 'CARİ HESAP EKSTRESİ',
      customer: stmt.customer,
      subtitle: subtitleStr,
      fileName: `Cari_Ekstre_${stmt.customer?.customerId}_${Date.now()}.xlsx`,
      sheetName: 'Ekstre',
      columns: [
        { header: 'İşlem Tarihi', excelValue: (r: any) => formatDate(r.date) },
        { header: 'İşlem Türü', excelValue: (r: any) => r.type },
        { header: 'Açıklama', excelValue: (r: any) => r.description || '' },
        { header: 'Belge / Fatura No', excelValue: (r: any) => r.docNo || '' },
        { header: 'Borç (TL)', key: 'debit', isNumeric: true, excelValue: (r: any) => r.debit || 0 },
        { header: 'Alacak (TL)', key: 'credit', isNumeric: true, excelValue: (r: any) => r.credit || 0 },
        { header: 'Küm. Bakiye (TL)', key: 'balance', isNumeric: true, excelValue: (r: any) => r.balance || 0 }
      ],
      rows: rows
    });
    return true;
  } catch (err) {
    console.error('triggerCustomerExcelExportSync error:', err);
    return false;
  }
}

if (typeof window !== 'undefined') {
  (window as any).__triggerCustomerPDFPrint = triggerCustomerPDFPrintSync;
  (window as any).__triggerCustomerExcelExport = triggerCustomerExcelExportSync;
}
