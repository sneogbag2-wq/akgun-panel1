// src/parsers/shipmentBelgelerParser.ts
// Sevkiyat Takip — Tahsilat Belgeleri Excel Parser (Belgeler (9).xlsx)

export interface ShipmentBelgeRecord {
  documentNo: string;
  documentType: string;
  customerId: string;
  amount: number;
  paymentType: string;
  date?: string;
}

export interface ShipmentBelgeParseResult {
  records: ShipmentBelgeRecord[];
  stats: {
    total: number;
    accepted: number;
    skippedDuplicates: number;
    skippedReversals: number;
    skippedUnsupportedPayment: number;
  };
}

export function cleanKey(str: any): string {
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

export function isSupportedPaymentType(payTypeStr: any): boolean {
  if (!payTypeStr) return false;
  const s = cleanKey(payTypeStr);
  return (
    s.includes('nakit') ||
    s.includes('kredikart') ||
    s.includes('bankahavale') ||
    s.includes('eft') ||
    s.includes('havale')
  );
}

export function parseShipmentBelgeler(rows: any[]): ShipmentBelgeParseResult {
  if (!rows || rows.length === 0) {
    return {
      records: [],
      stats: {
        total: 0,
        accepted: 0,
        skippedDuplicates: 0,
        skippedReversals: 0,
        skippedUnsupportedPayment: 0,
      },
    };
  }

  const records: ShipmentBelgeRecord[] = [];
  const seenDocNos = new Set<string>();

  let skippedDuplicates = 0;
  let skippedReversals = 0;
  let skippedUnsupportedPayment = 0;

  rows.forEach((row) => {
    // 1. Column extraction with Turkish character normalized cleanKey
    let docNoRaw: any = null;
    let docTypeRaw: any = null;
    let customerIdRaw: any = null;
    let amountRaw: any = null;
    let payTypeRaw: any = null;
    let reversalNoRaw: any = null;
    let dateRaw: any = null;

    Object.keys(row).forEach((col) => {
      const k = cleanKey(col);

      if (k === 'belgenumarasi' || k === 'belgeno') {
        docNoRaw = row[col];
      } else if (k === 'belgeturu' || k === 'belgetipi') {
        docTypeRaw = docTypeRaw || row[col];
      } else if (k === 'musteri' || k === 'musterino' || k === 'carikod') {
        customerIdRaw = row[col];
      } else if (k === 'tutar' || k === 'tutar(try)') {
        amountRaw = row[col];
      } else if (k === 'odemetipi' || k === 'odemesekli') {
        payTypeRaw = row[col];
      } else if (k.includes('terskayit') || k.includes('iptalbelge')) {
        reversalNoRaw = row[col];
      } else if (k === 'tarih' || k === 'belgetarihi') {
        dateRaw = row[col];
      }
    });

    const docNo = String(docNoRaw || '').trim();
    if (!docNo) return;

    // Rule 1: Duplicate Belge Numarası check
    if (seenDocNos.has(docNo)) {
      skippedDuplicates++;
      return;
    }
    seenDocNos.add(docNo);

    // Rule 2: Ters kayıt belge numarası var mı? (Varsa atla)
    const reversalNo = String(reversalNoRaw || '').trim();
    if (reversalNo && reversalNo !== '0' && reversalNo !== 'null' && reversalNo !== 'undefined') {
      skippedReversals++;
      return;
    }

    // Rule 3: Ödeme Tipi nakit, kredi kartı, banka havalesi kontrolü
    const payTypeStr = String(payTypeRaw || '').trim();
    if (!isSupportedPaymentType(payTypeStr)) {
      skippedUnsupportedPayment++;
      return;
    }

    // Rule 4: Tutar ve Müşteri ayrıştırması
    const rawNum = typeof amountRaw === 'number'
      ? amountRaw
      : parseFloat(String(amountRaw || '0').replace(/\./g, '').replace(',', '.')) || 0;
    const amount = Math.abs(rawNum);

    const customerId = String(customerIdRaw || '').trim();

    records.push({
      documentNo: docNo,
      documentType: String(docTypeRaw || 'Müşteri Tahsilat').trim(),
      customerId,
      amount,
      paymentType: payTypeStr,
      date: dateRaw ? String(dateRaw).trim() : undefined,
    });
  });

  return {
    records,
    stats: {
      total: rows.length,
      accepted: records.length,
      skippedDuplicates,
      skippedReversals,
      skippedUnsupportedPayment,
    },
  };
}
