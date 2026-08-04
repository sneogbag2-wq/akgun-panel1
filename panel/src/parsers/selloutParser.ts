// src/parsers/selloutParser.ts
import { resolveSelloutChannel } from '../utils/channelUtils';
import { safeIsoDate } from '../utils/dateUtils';

export interface ParsedSelloutRecord {
  id: string; // Unique ID for IndexedDB
  customerId: string;
  invoiceNo: string;
  materialCode: string;
  materialName: string;
  netAmount: number;
  grossAmount: number;
  liters: number;
  quantity: number;
  date: string;
  channel: 'AÇIK' | 'KAPALI' | 'DİĞER' | 'KARMA';
}

// Bira grubunda parçalı kodları (örn: *6, *12 paketleri) ana koda (*24) birleştirme tablosu
const PARCALI_ANA_URUN_ESLEME: Record<string, { ana: string; parcaliOranAna: number }> = {
  '151293': { ana:'150487', parcaliOranAna: 2 },
  '151436': { ana:'151247', parcaliOranAna: 2 },
  '151448': { ana:'151271', parcaliOranAna: 2 },
  '151463': { ana:'150137', parcaliOranAna: 2 },
  '151904': { ana:'150782', parcaliOranAna: 4 },
  '151910': { ana:'150782', parcaliOranAna: 2 },
  '151942': { ana:'150783', parcaliOranAna: 4 },
  '151943': { ana:'150783', parcaliOranAna: 2 },
  '152046': { ana:'150784', parcaliOranAna: 2 },
  '152301': { ana:'152208', parcaliOranAna: 12 },
  '152312': { ana:'152221', parcaliOranAna: 6 },
  '152313': { ana:'152222', parcaliOranAna: 12 },
  '152314': { ana:'152223', parcaliOranAna: 12 },
  '152315': { ana:'152224', parcaliOranAna: 24 },
  '152316': { ana:'152225', parcaliOranAna: 24 },
  '152318': { ana:'152227', parcaliOranAna: 6 },
  '152327': { ana:'152236', parcaliOranAna: 6 },
  '152547': { ana:'152422', parcaliOranAna: 2 },
  '152548': { ana:'152422', parcaliOranAna: 4 },
  '152710': { ana:'152542', parcaliOranAna: 4 },
  '152716': { ana:'151961', parcaliOranAna: 2 },
  '152755': { ana:'152747', parcaliOranAna: 24 },
  '152756': { ana:'152748', parcaliOranAna: 12 },
  '152757': { ana:'152749', parcaliOranAna: 12 },
  '152758': { ana:'152751', parcaliOranAna: 6 },
  '152759': { ana:'152752', parcaliOranAna: 6 },
  '152763': { ana:'152753', parcaliOranAna: 12 },
  '152764': { ana:'152754', parcaliOranAna: 6 },
  '152782': { ana:'151384', parcaliOranAna: 4 },
  '152949': { ana:'152950', parcaliOranAna: 6 },
  '154012': { ana:'151271', parcaliOranAna: 4 },
  '154020': { ana:'151420', parcaliOranAna: 4 },
  '154504': { ana:'151247', parcaliOranAna: 4 },
  '154505': { ana:'150487', parcaliOranAna: 4 },
  '154506': { ana:'151335', parcaliOranAna: 2 },
  '154510': { ana:'151384', parcaliOranAna: 2 },
  '154513': { ana:'151918', parcaliOranAna: 2 },
  '154525': { ana:'150021', parcaliOranAna: 2 },
  '154527': { ana:'151428', parcaliOranAna: 2 },
  '154535': { ana:'152608', parcaliOranAna: 2 },
  '154539': { ana:'152644', parcaliOranAna: 2 },
  '154547': { ana:'151335', parcaliOranAna: 4 },
  '154548': { ana:'150021', parcaliOranAna: 4 },
  '154555': { ana:'152644', parcaliOranAna: 4 },
  '154558': { ana:'154559', parcaliOranAna: 2 }, // Added from test logic
};

export function parseSellout(rows: any[]): { records: ParsedSelloutRecord[], stats: any } {
  if (!rows || rows.length === 0) return { records: [], stats: { loadedRows: 0 } };
  
  const records: ParsedSelloutRecord[] = [];
  
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const custIdRaw = r['Müşteri No'] || r['Müşteri Kodu'];
    if (!custIdRaw) continue;
    
    const customerId = String(custIdRaw).trim();
    const invoiceNo = String(r['Satış Belgesi'] || r['Faturalama Belgesi'] || '').trim();
    const rawCode = String(r['Malzeme Kodu'] || '').trim();
    let materialName = String(r['Malzeme Tnm.'] || r['Malzeme Tanımı'] || '').trim();
    
    // Uygulama genelinde hedeflerin sapmaması için Parçalı ürünleri (*6, *12) Ana ürüne çevir.
    let materialCode = rawCode;
    let quantityMultiplier = 1;
    
    const variantMapping = PARCALI_ANA_URUN_ESLEME[rawCode];
    if (variantMapping) {
      materialCode = variantMapping.ana;
      quantityMultiplier = 1 / variantMapping.parcaliOranAna; // Örn: 12'li paket, 24'lü ana paketin yarısıdır (1/2)
      // Temizlenmiş bir isim oluştur (Sondaki *6, *12 ifadelerini temizle)
      materialName = materialName.replace(/\* ?\d+(?: ?PK)?/i, '').trim();
    }
    
    // Müşteri Kanalı Tnm. (Standart Açık, Horeca, Otel -> Açık / Standart Kapalı, Ekomini -> Kapalı)
    const channelRaw = String(r['Müşteri Kanalı Tnm.'] || r['Açık/Otel Tnm.'] || '').trim();
    const channel = resolveSelloutChannel(channelRaw);

    
    // Check possible date columns
    const rawDate = r['Sipariş Tarihi'] || r['Teslim Tarihi'] || r['Faturalama Tarihi'] || r['Girilen Faturalama Tarihi'];
    const dateStr = safeIsoDate(rawDate);
    
    // Numeric values
    const netAmount = parseFloat(String(r['Net'] || 0).replace(',', '.')) || 0;
    const grossAmount = parseFloat(String(r['Brüt'] || 0).replace(',', '.')) || 0;
    const liters = parseFloat(String(r['Litre'] || 0).replace(',', '.')) || 0;
    let quantity = parseFloat(String(r['Miktar'] || 0).replace(',', '.')) || 0;
    
    // Miktar dönüşümü
    quantity = quantity * quantityMultiplier;
    
    records.push({
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${customerId}_${invoiceNo}_${i}`,
      customerId,
      invoiceNo,
      materialCode,
      materialName,
      netAmount,
      grossAmount,
      liters,
      quantity,
      date: dateStr || '',
      channel
    });
  }
  
  return {
    records,
    stats: {
      loadedRows: rows.length,
      parsedRecords: records.length,
    }
  };
}
