/** Turkish-aware, deterministic intent classification for AI tool routing. */
export type AiQueryIntent =
  | 'COMPANY_OVERVIEW' | 'REP_PERFORMANCE' | 'SELLOUT' | 'SHIPMENT'
  | 'CUSTOMER' | 'COLLECTION' | 'RISK' | 'GLOBAL_RECORD' | 'EXCEL_ANALYSIS'
  | 'MUTATION' | 'FINANCIAL_REPORTING' | 'FORECASTING' | 'SCENARIO' | 'REPORT_ORCHESTRATION' 
  | 'WAREHOUSE_INVENTORY' | 'COMMERCIAL_INVENTORY' 
  | 'DISPATCH_OPERATION' | 'INVOICE_CONTROL' | 'FOCUS_ANALYSIS' | 'GENERAL';

const TURKISH_FOLD_MAP: Record<string, string> = {
  'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'İ': 'i',
  'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u'
};

export function normalizeTurkishText(value = ''): string {
  return String(value)
    .toLocaleLowerCase('tr-TR')
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (character) => TURKISH_FOLD_MAP[character] || character)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function includesAny(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text.includes(term));
}

/** Covers suffixes and frequently used Turkish spelling variants without an LLM round-trip. */
export function classifyAiQueryIntent(userMessage = '', hasAttachments = false): AiQueryIntent {
  const query = normalizeTurkishText(userMessage);
  const tokens = query.split(' ').filter(Boolean);
  if (hasAttachments || includesAny(query, ['excel', 'xlsx', 'xls ', 'dosya analiz', 'dosya aktar', 'tablo yukle'])) return 'EXCEL_ANALYSIS';
  if (includesAny(query, ['en yuksek', 'en buyuk', 'rekor', 'milyonluk', 'zirve', 'tum veritabani'])) return 'GLOBAL_RECORD';
  const hasMutationVerb = tokens.some((token) => /^(sil|ekle|kayd|olustur|yarat|duzelt|guncelle|kaldir|tanimla|aktar|ithal|temizle|sifirla|virman|transfer|onayla|iptal|zorla|override|coz)/.test(token))
    || includesAny(query, ['fatura kes', 'tahsilat al', 'catisma coz', 'islem onayla']);
  if (hasMutationVerb) return 'MUTATION';
  if (includesAny(query, ['sellout', 'penetrasyon', 'urun dagilim', 'sellout karsilastir', 'sellout trend', 'satis analizi'])) return 'SELLOUT';
  if (includesAny(query, ['temsilci', 'plasiyer', 'satisci', 'performans', 'portfoy performans', 'ssm', 'karne', 'temsilci skor', 'hedef', 'prim'])) return 'REP_PERFORMANCE';
  if (includesAny(query, ['fatura kontrol', 'teslim edilmis fatura', 'fatura sorunu', 'eslesme', 'kapanmayan fatura', 'fifo'])) return 'INVOICE_CONTROL';
  if (includesAny(query, ['dagitim', 'yola cikacak', 'bugun sevkiyat', 'araca yuklenecek', 'siparis durumu'])) return 'DISPATCH_OPERATION';
  if (includesAny(query, ['sevkiyat', 'sevk ', 'siparis'])) return 'SHIPMENT';
  if (includesAny(query, ['depo', 'merkez', 'stokta', 'elimizde', 'kac adet mal', 'ne kadar malzeme', 'hazirda', 'kullanilabilir stok'])) return 'WAREHOUSE_INVENTORY';
  if (includesAny(query, ['musterideki', 'emanet', 'konsinye', 'satilmayan', 'ticari stok', 'kalan mal'])) return 'COMMERCIAL_INVENTORY';
  if (includesAny(query, ['risk', 'yaslandirma', 'vadesi gecmis', 'cek senet', 'finansal saglik', 'gecikmis borc'])) return 'RISK';
  if (includesAny(query, ['senaryo', 'stres test', 'beklenen zarar', 'karsi taraf testi'])) return 'SCENARIO';
  if (includesAny(query, ['tahmin', 'gelecek nakit', 'nakit gorunumu', 'ileriye donuk'])) return 'FORECASTING';
  if (includesAny(query, ['rapor hazirla', 'kiyasla', 'karsilastir', 'excel ciktisi', 'pdf ver', 'pdf hazirla', 'excel hazirla', 'rapor olustur'])) return 'REPORT_ORCHESTRATION';
  if (includesAny(query, ['tahsilat', 'odeme', 'cei', 'koleksiyon'])) return 'COLLECTION';
  if (includesAny(query, ['genel', 'durum', 'ozet', 'ciro', 'trend', 'satis', 'finansal', 'gelir'])) return 'COMPANY_OVERVIEW';
  if (includesAny(query, ['ileri rapor', 'kohort', 'vintage', 'gecis matrisi', 'yogunlasma', 'pareto', 'tahsilat oncelik', 'dso', 'cei', 'odeme hizi', 'mutabakat', 'acik hesap', 'ortalama tahsilat', 'finansal durum', 'toplam risk', 'survival', 'hayatta kalma', 'benchmark', 'hhi', 'konsantrasyon', 'peer', 'yuklu alacak'])) return 'FINANCIAL_REPORTING';
  if (includesAny(query, ['market', 'bakkal', 'bufe', 'tekel', 'sarkuteri', 'lokanta', 'pub', 'bar', 'ltd', 'as ', 'kafe', 'gida', 'ticaret', 'shop', 'cari', 'ekstre', 'musteri', 'saglik skoru', 'ic limit', 'kredi onerisi', 'skor', 'limit'])) return 'CUSTOMER';
  if (includesAny(query, ['odak analizi', 'kritik noktalar', 'bana ozetle', 'musteri ozeti', 'onemli olan ne', 'odaklan'])) return 'FOCUS_ANALYSIS';
  return 'GENERAL';
}

export type ResponseDensity = 'SHORT' | 'MEDIUM' | 'LONG';

export function determineResponseDensity(userMessage: string, intent: AiQueryIntent): ResponseDensity {
  const query = normalizeTurkishText(userMessage);
  
  // Explicit hints for SHORT
  if (includesAny(query, ['kisaca', 'ozetle', 'hizlica', 'tek kelime', 'sadece sonuc'])) {
    return 'SHORT';
  }
  
  // Explicit hints for LONG
  if (includesAny(query, ['detayli', 'uzun uzun', 'kapsamli', 'analiz et', 'derinlemesine'])) {
    return 'LONG';
  }
  
  // Implicit based on intent
  if (['COMPANY_OVERVIEW', 'FINANCIAL_REPORTING', 'SCENARIO', 'INVOICE_CONTROL', 'SELLOUT'].includes(intent)) {
    return 'LONG';
  }
  if (['CUSTOMER', 'COLLECTION', 'WAREHOUSE_INVENTORY', 'COMMERCIAL_INVENTORY', 'DISPATCH_OPERATION'].includes(intent)) {
    return 'SHORT';
  }
  
  return 'MEDIUM';
}
