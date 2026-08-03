// src/utils/fileTypeDetector.ts
import * as XLSX from 'xlsx';
import { FILE_TYPES } from '../config/fileTypes';

function cleanStr(str: any): string {
  return String(str || '')
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

const FILENAME_PATTERNS = [
  { key: 'SEVKIYAT_SIPARISLER', pattern: /export|sevkiyat[\s\-_]?siparis|sapui5/i },
  { key: FILE_TYPES.SEVKIYAT_BELGELER?.key || 'SEVKIYAT_BELGELER', pattern: /belgeler|sevkiyat[\s\-_]?tahsilat/i },
  { key: FILE_TYPES.SELLOUT_VERISI?.key || 'SELLOUT_VERISI', pattern: /sellout|sell[\s\-_]?out|satış[\s\-_]?detay|satis[\s\-_]?detay/i },
  { key: FILE_TYPES.MUSTERI_MASTER.key, pattern: /müşteri|musteri|master|export\s*\(\d+\)|cari[\s\-_]?master|cari[\s\-_]?açılış|cari[\s\-_]?acilis/i },
  { key: FILE_TYPES.SATIN_ALMA.key, pattern: /satın[\s\-_]?alma|satin[\s\-_]?alma|satınalma|satinalma|purchase|alış|alis|alım|alim/i },
  { key: FILE_TYPES.SATIS.key, pattern: /satış|satis|sales/i },
  { key: FILE_TYPES.HAVALE_TAHSILAT.key, pattern: /havale|eft|banka/i },
  { key: FILE_TYPES.NAKIT_TAHSILAT.key, pattern: /nakit|kasa|pos/i },
  { key: FILE_TYPES.CEK.key, pattern: /çek|cek|cheque/i },
  { key: FILE_TYPES.SENET.key, pattern: /senet|promissory|bono/i },
];

export async function readExcelHeaders(file: File): Promise<string[]> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', sheetRows: 10 });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        let headers: string[] = [];
        for (let i = 0; i < Math.min(5, json.length); i++) {
          const rowClean = cleanStr((json[i] || []).join(' '));
          if (
            rowClean.includes('fatura') ||
            rowClean.includes('cari') ||
            rowClean.includes('musteri') ||
            rowClean.includes('belge') ||
            rowClean.includes('tabela') ||
            rowClean.includes('tutar') ||
            rowClean.includes('banka') ||
            rowClean.includes('kasa') ||
            rowClean.includes('cek') ||
            rowClean.includes('senet') ||
            rowClean.includes('satisbelge') ||
            rowClean.includes('redstatusu') ||
            rowClean.includes('satisbelgesi') ||
            rowClean.includes('malzemekodu') ||
            rowClean.includes('musterikanalitnm')
          ) {
            headers = (json[i] || []).map((h: any) => String(h || '').trim());
            break;
          }
        }
        if (headers.length === 0 && json.length > 0) {
          headers = (json[0] || []).map((h: any) => String(h || '').trim());
        }
        resolve(headers);
      } catch (err) {
        console.warn('Excel header okuma hatası:', err);
        resolve([]);
      }
    };
    reader.onerror = () => resolve([]);
    reader.readAsArrayBuffer(file);
  });
}

export async function detectFileType(file: File): Promise<{ key: string | null; confidence: 'high' | 'medium' | 'low'; matchedBy: string }> {
  if (!file) return { key: null, confidence: 'low', matchedBy: 'none' };

  // 1. ÖNCELİK: Excel Sütun Başlıkları Analizi (Dosya isminden tamamen bağımsız, %100 kesin tespit)
  const headers = await readExcelHeaders(file);
  if (headers.length > 0) {
    const norm = cleanStr(headers.join(' '));

    // A. Sevkiyat Siparişleri (export (9))
    if (
      norm.includes('satisbelgeturutnm') ||
      (norm.includes('redstatusutnm') && norm.includes('siparistoplamtutar'))
    ) {
      return { key: 'SEVKIYAT_SIPARISLER', confidence: 'high', matchedBy: 'sütun_başlıkları (Satış Belge Türü Tnm)' };
    }

    // B. Sevkiyat Tahsilat Belgeleri (Belgeler (9))
    if (
      norm.includes('terskayit') ||
      norm.includes('ceksenetfotografi') ||
      (norm.includes('belgenumarasi') && norm.includes('odemetipi') && norm.includes('musteri'))
    ) {
      return { key: 'SEVKIYAT_BELGELER', confidence: 'high', matchedBy: 'sütun_başlıkları (Ters Kayıt/Ödeme Tipi)' };
    }

    // B2. Sellout Verisi (Geriye Dönük Detaylı Satış)
    if (
      (norm.includes('satisbelgesi') && norm.includes('malzemekodu')) || 
      (norm.includes('musterikanalitnm') && norm.includes('litre'))
    ) {
      return { key: 'SELLOUT_VERISI', confidence: 'high', matchedBy: 'sütun_başlıkları (Satış Belgesi / Malzeme Kodu)' };
    }

    // C. Çek Listesi
    if (norm.includes('cekno') || norm.includes('cekhesapno')) {
      return { key: FILE_TYPES.CEK.key, confidence: 'high', matchedBy: 'sütun_başlıkları (Çek No)' };
    }

    // D. Senet Listesi
    if (norm.includes('senetno')) {
      return { key: FILE_TYPES.SENET.key, confidence: 'high', matchedBy: 'sütun_başlıkları (Senet No)' };
    }

    // E. Müşteri Master
    if (norm.includes('tabelaadi') || norm.includes('sevkadresi') || norm.includes('distsatis')) {
      return { key: FILE_TYPES.MUSTERI_MASTER.key, confidence: 'high', matchedBy: 'sütun_başlıkları (Tabela/Sevk Adresi)' };
    }

    // F. Satış Faturaları
    if (norm.includes('satistutari')) {
      return { key: FILE_TYPES.SATIS.key, confidence: 'high', matchedBy: 'sütun_başlıkları (Satış Tutarı)' };
    }

    // G. Satın Alma / Hizmet Faturaları
    if (
      norm.includes('faturatipi') ||
      norm.includes('edocumentno') ||
      (norm.includes('faturano') && norm.includes('faturadurum'))
    ) {
      return { key: FILE_TYPES.SATIN_ALMA.key, confidence: 'high', matchedBy: 'sütun_başlıkları (Fatura Tipi/No)' };
    }

    // H. Havale Tahsilatlar
    if (
      norm.includes('bankakodu') ||
      norm.includes('hesapno') ||
      (norm.includes('bankaadi') && !norm.includes('cek'))
    ) {
      return { key: FILE_TYPES.HAVALE_TAHSILAT.key, confidence: 'high', matchedBy: 'sütun_başlıkları (Banka/Hesap No)' };
    }

    // I. Nakit Tahsilatlar
    if (norm.includes('kasakodu') || (norm.includes('kasa') && !norm.includes('banka'))) {
      return { key: FILE_TYPES.NAKIT_TAHSILAT.key, confidence: 'high', matchedBy: 'sütun_başlıkları (Kasa Kodu)' };
    }
  }

  // 2. İKİNCİL ÖNCELİK: Dosya Adı Deseni (Eğer başlıklar okunamadıysa)
  const filename = file.name || '';
  for (const { key, pattern } of FILENAME_PATTERNS) {
    if (pattern.test(filename)) {
      return { key, confidence: 'high', matchedBy: `dosya_adı (${filename})` };
    }
  }

  return { key: null, confidence: 'low', matchedBy: 'none' };
}
