# İşçi Ajan Planı: Paket 06A — Ticari Stok Yükleme ve Rapor Modülü Entegrasyonu

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
KURAL ÇELİŞKİSİ: Yok

## 1. Hedef
Paket 06A (Ticari Stok Yükleme ve Rapor Modülü) entegrasyonunu tekil ve bağımsız bir paket olarak, mevcut `commercialStockService.ts` içindeki typed servis fonksiyonuna (`getCommercialStockSummary`) ve backend `/stock/commercial/summary` rotasına sadık kalarak `customerState` nesnesine mühürlemek.

## 2. Kapsam (Tam Dosya Listesi)
1. `panel/src/services/customerService.ts`: `customerState` nesnesine `commercialStockItems: CommercialStockItem[]` alanını eklemek.
2. `panel/src/services/apiSyncService.ts`: `commercialStockService.ts` içindeki `getCommercialStockSummary()` fonksiyonunu çağırarak `customerState` nesnesine aktarmak.

## 3. Yaklaşım (Adım Adım)
1. **State Tanımı (`customerService.ts`):** `customerState` nesnesine `mockCommercialStockItems = []` backing variable ile `commercialStockItems` getter/setter ve `getCommercialStockStateSync()` yardımcısı eklenir.
2. **Sync Entegrasyonu (`apiSyncService.ts`):** `commercialStockService.ts` modülünden `getCommercialStockSummary` içe aktarılır. `syncDataFromApi()` fonksiyonunda try/catch bloğu ile çağrılarak `customerState.commercialStockItems` alanına yazılır.
3. **Mevcut Tiplere Tam Uyum:** `CommercialStockItem` (`id`, `document_no`, `customer_id`, `product_id`, `remaining_quantity`, `remaining_litres`, `is_active`) tip imzası birebir korunur.
4. **Test & Doğrulama:** `npm --prefix backend test` (200 test) ve `npm --prefix panel test` (183 test) çalıştırılarak sıfır regresyon sağlandığı doğrulanır.

## 4. Kurallara Dayanak
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Paket 06A (Satır 95: Ticari Stok veritabanı, `/stock/commercial` REST API ve servis entegrasyonu).

## 5. Açık Varsayımlar
- `VARSAYIM 1`: Backend çevrimdışı durumdayken (offline test) `getCommercialStockSummary()` try/catch bloğuna düşer, `customerState.commercialStockItems` boş dizi `[]` olarak kalır ve uygulama çökmez.
- `VARSAYIM 2`: Backend tarafında `createCommercialStockRouter` (`backend/src/modules/stock/commercialStockRouter.js`) `/summary` ve `/publish` alt rotalarını sunar.

## 6. Riskler ve Rollback
- **Risk:** Offline ortamda backend fetch exception fırlatabilir.
- **Rollback / Koruma:** İlgili kod bloğu `try { ... } catch (e) { console.warn('Commercial stock sync skipped:', e); }` yapısıyla izole edilecek; hata durumunda mevcut durum bozulmayacaktır.
