import type { AiReportColumn, AiReportDataType, AiReportDescriptor } from '../types/ai';

export const AI_REPORTING_LIMITS = {
  minRows: 25,
  minSerializedChars: 12_000,
  maxSummaryMetrics: 5,
  maxColumns: 8
} as const;

const REPORT_TITLES: Record<string, string> = {
  searchCustomers: 'Müşteri Arama Raporu',
  queryTransactions: 'İşlem Detay Raporu',
  getTopDebtors: 'En Borçlu Müşteriler Raporu',
  getTopCustomersBySalesVolume: 'Satış Hacmi Raporu',
  getCustomerStatement: 'Cari Hesap Ekstresi',
  getCustomerCheques: 'Çek ve Senet Raporu',
  getOverdueCustomersList: 'Vadesi Geçmiş Müşteriler Raporu',
  getShipmentTrackingReport: 'Sevkiyat Takip Raporu',
  getSalesRepSummary: 'Temsilci Performans Raporu'
};

const isPrimitive = (value: unknown) => value === null || ['string', 'number', 'boolean'].includes(typeof value);

function inferReportDataType(key: string, rows: Array<Record<string, unknown>>): AiReportDataType {
  const normalizedKey = key.toLowerCase();
  if (/(date|tarih|vade|due)/i.test(normalizedKey)) return 'date';
  if (/(oran|rate|ratio|percentage|yuzde|yüzde|percent)/i.test(normalizedKey)) return 'percentage';
  if (/(amount|balance|debit|credit|sales|collection|revenue|tutar|bakiye|borç|alacak|satış|tahsilat|ciro)/i.test(normalizedKey)) return 'currency';
  if (/(^id$|id$|code|kod|no$|number)/i.test(normalizedKey)) return 'identifier';
  if (rows.some((row) => typeof row[key] === 'number')) return 'number';
  return 'text';
}

function findLargestRowSet(value: unknown, depth = 0): Array<Record<string, unknown>> | null {
  if (depth > 3 || !value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    return value.every((row) => row && typeof row === 'object' && !Array.isArray(row))
      ? value as Array<Record<string, unknown>>
      : null;
  }

  let largest: Array<Record<string, unknown>> | null = null;
  for (const nested of Object.values(value as Record<string, unknown>)) {
    const candidate = findLargestRowSet(nested, depth + 1);
    if (candidate && (!largest || candidate.length > largest.length)) largest = candidate;
  }
  return largest;
}

function buildColumns(rows: Array<Record<string, unknown>>): AiReportColumn[] {
  const keys: string[] = [];
  for (const row of rows.slice(0, 20)) {
    for (const [key, value] of Object.entries(row)) {
      if (isPrimitive(value) && !keys.includes(key)) keys.push(key);
      if (keys.length >= AI_REPORTING_LIMITS.maxColumns) break;
    }
    if (keys.length >= AI_REPORTING_LIMITS.maxColumns) break;
  }
  return keys.map((key) => ({
    key,
    header: key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^./, (char) => char.toUpperCase()),
    dataType: inferReportDataType(key, rows),
    isNumeric: ['currency', 'percentage', 'number'].includes(inferReportDataType(key, rows))
  }));
}

function compactScalars(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, entry]) => {
        if (!isPrimitive(entry)) return false;
        const aggregateMetric = /(count|total|sum|average|avg|rate|ratio|percentage|score|amount|balance|sales|collection|revenue|tutar|bakiye|borç|alacak|satış|tahsilat|ciro|adet)/i.test(key);
        const sensitiveField = /(customer.?name|customer|m[uü]şteri|name|email|mail|phone|telefon|gsm|address|adres|iban|tax|vergi|identity|kimlik|(^|_)id$|code|kod|document|belge)/i.test(key);
        return aggregateMetric || !sensitiveField;
      })
      .slice(0, AI_REPORTING_LIMITS.maxSummaryMetrics)
  );
}

export function createAiReportDescriptor(toolName: string, result: unknown): AiReportDescriptor | null {
  const rows = findLargestRowSet(result);
  const serializedLength = (() => {
    try { return JSON.stringify(result).length; } catch { return 0; }
  })();
  if (!rows || (rows.length < AI_REPORTING_LIMITS.minRows && serializedLength < AI_REPORTING_LIMITS.minSerializedChars)) return null;

  const columns = buildColumns(rows);
  if (columns.length === 0) return null;

  const numericColumns = columns.filter((column) => column.isNumeric).slice(0, AI_REPORTING_LIMITS.maxSummaryMetrics - 1);
  const summaryBoxes = [
    { label: 'KAYIT SAYISI', value: String(rows.length), color: '#2563eb' },
    ...numericColumns.map((column) => ({
      label: `${column.header.toUpperCase()} TOPLAMI`,
      value: String(rows.reduce((total, row) => total + (typeof row[column.key] === 'number' ? Number(row[column.key]) : 0), 0)),
      color: '#059669'
    }))
  ];
  const title = REPORT_TITLES[toolName] || `${toolName} Detay Raporu`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return {
    id: `${toolName}-${timestamp}`,
    title,
    subtitle: `${rows.length} kayıt - Ayrıntılı veri dışa aktarım raporundadır.`,
    fileName: `${title.replace(/[^a-z0-9]+/gi, '_')}_${timestamp}.xlsx`,
    sheetName: 'Detay Rapor', type: 'table', data: rows,
    rowCount: rows.length,
    columns,
    rows: rows.map((row) => Object.fromEntries(columns.map((column) => [column.key, row[column.key] ?? '']))),
    summaryBoxes
  };
}

/** Büyük sonuçlarda sohbetin göstereceği, en fazla beş maddelik sabit yönetici özeti. */
export function buildExecutiveReportChatSummary(reports: AiReportDescriptor[]): string {
  const reportList = reports.filter(Boolean);
  const summaryLines: string[] = [];

  for (const report of reportList) {
    if (summaryLines.length >= AI_REPORTING_LIMITS.maxSummaryMetrics) break;
    summaryLines.push(`**${report.title}:** ${report.rowCount} kayıt ayrıntılı rapora taşındı.`);

    for (const box of report.summaryBoxes) {
      if (summaryLines.length >= AI_REPORTING_LIMITS.maxSummaryMetrics) break;
      if (box.label === 'KAYIT SAYISI') continue;
      summaryLines.push(`**${box.label}:** ${box.value}`);
    }
  }

  if (summaryLines.length === 0) return 'Ayrıntılı rapor hazır.';
  return `### Yönetici Özeti\n\n${summaryLines.map((line) => `- ${line}`).join('\n')}\n\nAyrıntılı satırlar sohbet yerine aşağıdaki **Excel indir** ve **PDF / Yazdır** seçeneklerinde hazırdır.`;
}

/** Modelin bağlamına büyük liste yerine karar vermeye yetecek özet gönderilir. */
export function buildCompactToolResponse(result: unknown, report: AiReportDescriptor | null): unknown {
  if (!report) return result;
  return {
    status: 'LARGE_DATASET_EXPORTED',
    reportAvailable: true,
    reportTitle: report.title,
    rowCount: report.rowCount,
    formats: ['Excel', 'PDF'],
    summary: compactScalars(result),
    instruction: 'Kullanıcıya yalnızca kısa yönetici özeti ver; ayrıntılı listeyi sohbet içinde tekrarlama. Excel ve PDF raporlarının hazır olduğunu belirt.'
  };
}
