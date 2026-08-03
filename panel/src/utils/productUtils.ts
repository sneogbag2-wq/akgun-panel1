// src/utils/productUtils.ts
// Anadolu Efes / FMCG Ürün Birleştirme ve Multipack (*6, *12, *24, *5) Ayrıştırma Motoru
// Müşterinin Sellout Raporu ve Referans Uygulamasındaki (08-kanal-raporlari.js) GERÇEK
// ürün eşleştirme mantığına göre düzenlenmiştir. (Örn: 154505 -> 150487 (EFES XTRA 50 CL KTU *6 -> Base))

const PARCALI_ANA_URUN_ESLEME: Record<string, { ana: string, parcaliOranAna: number }> = {
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
  '154558': { ana:'150003', parcaliOranAna: 2 }, // Added from inference: 154558 = EFES PİLSEN KL 30 CL STEINIE NRB *12
  '154559': { ana:'150003', parcaliOranAna: 4 }, // Added from inference: 154559 = EFES PİLSEN KL 30 CL STEINIE NRB *6
};

/**
 * Ürün Kodunu (parçalıysa) ana Bira koduna çevirir.
 * Satış hedefi kontrollerinde penetrasyon sayarken, varyant ürünler (*6, *12 vb) ana ürünle BİRLEŞTİRİLİR.
 */
export function getBaseMaterialCode(materialCode: string | null | undefined): string {
  if (!materialCode) return '';
  const code = String(materialCode).trim();
  const mapping = PARCALI_ANA_URUN_ESLEME[code];
  return mapping ? mapping.ana : code;
}

/**
 * Malzeme adından ambalaj/multipack eklerini temizleyerek kök ürün adını çıkarır.
 */
export function getCanonicalMaterialName(matName: string | null | undefined): string {
  if (!matName) return '';
  return String(matName)
    .replace(/[*_\-/]\d+/g, '') // *6, *12 vb.
    .replace(/\b\d+['’]L[İIÜU]\b/gi, '') // 6'lı, 12'li, 24'lü vb.
    .replace(/\b(SHRINK|TRAY|KARTON|KOLİ|KOLI|PAKET)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verilen Sellout Excel ürün kodu/adı, kullanıcının seçtiği/aradığı hedef sorgusuyla eşleşiyor mu?
 * Multipack parçalı ürünleri (Örn. 154505 -> 150487) OTOMATİK BİRLEŞTİRİR!
 */
export function matchesProductQuery(
  selloutMaterialCode: string | null | undefined, 
  selloutMaterialName: string | null | undefined,
  searchQuery: string | null | undefined
): boolean {
  if (!searchQuery || !searchQuery.trim()) return true;
  
  const query = searchQuery.trim().toLowerCase();
  const rawMatCode = String(selloutMaterialCode || '').trim();
  const rawMatName = String(selloutMaterialName || '').toLowerCase();
  
  // 1. Kök kod üzerinden kontrol (Arama sorgusu tam bir koda benziyorsa)
  const queryBaseCode = getBaseMaterialCode(query);
  const itemBaseCode = getBaseMaterialCode(rawMatCode);
  
  if (queryBaseCode && itemBaseCode === queryBaseCode) {
    return true;
  }
  
  // 2. Doğrudan string eşleşmesi (kod veya isim)
  if (rawMatCode.toLowerCase().includes(query) || rawMatName.includes(query)) {
    return true;
  }
  
  // 3. Temizlenmiş (canonical) isim üzerinden eşleşme
  const canonicalMatName = getCanonicalMaterialName(rawMatName).toLowerCase();
  if (canonicalMatName.includes(query)) {
    return true;
  }

  return false;
}

/**
 * Penetrasyon hedeflerine dahil edilmemesi gereken Alakasız Ürünleri/Kanalları filtreler.
 * Örn: Açık kanal Fıçı ürünü (152101) Kapalı Kanala hedeflenmez veya sayılmaz.
 */
export function isValidProductForChannel(materialCode: string | null | undefined, materialName: string | null | undefined, targetChannel: 'AÇIK' | 'KAPALI' | 'Açık Kanal' | 'Kapalı Kanal' | string): boolean {
  const code = getBaseMaterialCode(materialCode);
  const name = (materialName || '').toUpperCase();
  const isKapali = targetChannel === 'Kapalı Kanal' || targetChannel === 'KAPALI';
  const isAcik = targetChannel === 'Açık Kanal' || targetChannel === 'AÇIK';
  
  // KAPALI KANAL için Fıçı (Keg) ürünleri anlamsızdır, FKNS sayılmaz, hedeflenmez.
  if (isKapali) {
    if (name.includes('FIÇI') || name.includes('FICI') || name.includes('FIC') || code === '152101') {
      return false;
    }
  }

  // AÇIK KANAL için Kutu ürünleri anlamsızdır (genellikle).
  if (isAcik) {
    if (name.includes('KUTU') || name.includes('KTU')) {
      return false;
    }
  }

  return true;
}
