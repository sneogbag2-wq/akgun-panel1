// src/parsers/shipmentSiparisParser.ts
// Sevkiyat Takip — Sipariş ve Emanet Excel Parser (export (9).xlsx)

export interface ShipmentSiparisRecord {
  id: string;
  invoiceNo: string;
  documentType: string;
  customerId: string;
  amount: number;
  redStatus: string;
  isSiparis: boolean;
  isEmanet: boolean;
}

export interface ShipmentSiparisParseResult {
  records: ShipmentSiparisRecord[];
  stats: {
    total: number;
    accepted: number;
    skippedRedStatus: number;
    skippedDuplicateInvoices: number;
    siparisCount: number;
    emanetCount: number;
  };
}

export function cleanStr(str: any): string {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, '');
}

export function parseShipmentSiparisler(rows: any[]): ShipmentSiparisParseResult {
  if (!rows || rows.length === 0) {
    return {
      records: [],
      stats: {
        total: 0,
        accepted: 0,
        skippedRedStatus: 0,
        skippedDuplicateInvoices: 0,
        siparisCount: 0,
        emanetCount: 0,
      },
    };
  }

  const records: ShipmentSiparisRecord[] = [];
  const seenInvoices = new Set<string>();

  let skippedRedStatus = 0;
  let skippedDuplicateInvoices = 0;
  let siparisCount = 0;
  let emanetCount = 0;

  rows.forEach((row, idx) => {
    let docTypeRaw: any = null;
    let customerNoRaw: any = null;
    let invoiceNoRaw: any = null;
    let redStatusRaw: any = null;
    let amountRaw: any = null;

    Object.keys(row).forEach((col) => {
      const k = cleanStr(col);
      if (k.includes('satisbelgeturu') || k.includes('belgeturu')) {
        docTypeRaw = row[col];
      } else if (k.includes('musterino') || k === 'musteri' || k === 'musterikodu') {
        customerNoRaw = row[col];
      } else if (k.includes('faturano') || k === 'faturanumarasi') {
        invoiceNoRaw = row[col];
      } else if (k.includes('redstatusu')) {
        redStatusRaw = row[col];
      } else if (k.includes('siparistoplamtutar') || k === 'tutar') {
        amountRaw = row[col];
      }
    });

    // Rule 1: Red Statüsü Tnm. 'Aktif' olmayan satırlar atlanır
    const redStatus = String(redStatusRaw || '').trim();
    if (redStatus.toLowerCase() !== 'aktif') {
      skippedRedStatus++;
      return;
    }

    // Rule 2: Fatura No mükerrer satırlar atlanır
    const invoiceNo = String(invoiceNoRaw || '').trim();
    if (invoiceNo && invoiceNo !== '0' && invoiceNo !== 'null' && invoiceNo !== 'undefined') {
      if (seenInvoices.has(invoiceNo)) {
        skippedDuplicateInvoices++;
        return;
      }
      seenInvoices.add(invoiceNo);
    }

    const docTypeStr = String(docTypeRaw || '').trim();
    const docTypeNorm = cleanStr(docTypeStr);

    // Rule 3: Soğuk Satış & Depo Satışı -> Sipariş; Sevk Ertelenecek -> Emanet Sp
    const isSiparis = docTypeNorm.includes('soguk') || docTypeNorm.includes('deposatisi');
    const isEmanet = docTypeNorm.includes('ertelenecek') || docTypeNorm.includes('emanet');

    if (!isSiparis && !isEmanet) {
      // Diğer promosyon/reklam siparişleri elenir
      return;
    }

    const amount = typeof amountRaw === 'number'
      ? amountRaw
      : parseFloat(String(amountRaw || '0').replace(/\./g, '').replace(',', '.')) || 0;

    const customerId = String(customerNoRaw || '').trim();
    const recordId = invoiceNo && invoiceNo !== '0' ? invoiceNo : `sip-${idx}-${Date.now()}`;

    if (isSiparis) siparisCount++;
    if (isEmanet) emanetCount++;

    records.push({
      id: recordId,
      invoiceNo: invoiceNo || recordId,
      documentType: docTypeStr,
      customerId,
      amount: Math.abs(amount),
      redStatus,
      isSiparis,
      isEmanet,
    });
  });

  return {
    records,
    stats: {
      total: rows.length,
      accepted: records.length,
      skippedRedStatus,
      skippedDuplicateInvoices,
      siparisCount,
      emanetCount,
    },
  };
}
