# İşçi Ajan Revize Planı (v2): Paket 07B — Bugünkü Sevkiyat Takip Entegrasyonu

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
KURAL ÇELİŞKİSİ: Yok

## 1. Hedef
Denetçi ret kararı doğrultusunda, Paket 07B (Bugünkü Sevkiyat Takip) modülünü mevcut `todayDispatchService.ts` içindeki tiplere ve rotalara (`/dispatch/today/summary` ve `/dispatch/today/orders`) tam sadık kalarak, `customerState` nesnesine mühürlemek.

## 2. Kapsam (Tam Dosya Listesi)
1. `panel/src/services/customerService.ts`: `customerState` nesnesine `todayDispatchSummary: TodayDispatchSummary | null` ve `todayDispatchOrders: DispatchOrderCard[]` alanlarını eklemek.
2. `panel/src/services/apiSyncService.ts`: `todayDispatchService.ts` modülündeki mevcut `getTodayDispatchSummary()` ve `getTodayDispatchOrders()` fonksiyonlarını çağırarak `customerState` nesnesine bağlamak.

## 3. Yaklaşım (Adım Adım)
1. **State Tanımı (`customerService.ts`):** `customerState` nesnesine `todayDispatchSummary: null` ve `todayDispatchOrders: []` varsayılan alanları eklenir. `getTodayDispatchStateSync()` yardımcısı ile dışarıya sunulur.
2. **Sync Entegrasyonu (`apiSyncService.ts`):** `todayDispatchService.ts` içindeki `getTodayDispatchSummary()` ve `getTodayDispatchOrders()` fonksiyonları içe aktarılır. `syncDataFromApi()` metodunda `try/catch` bloğu ile çağrılarak `customerState` nesnesine aktarılır.
3. **Mevcut Tiplere Tam Uyum:** Hiçbir uydurma rotaya veya metoda başvurulmaz. `TodayDispatchSummary` (`as_of_date`, `total_orders`, `total_litres`, `total_amount`) ve `DispatchOrderCard` (`id`, `sales_document_no`, `customer_id`, `view_class`, `operational_state`, `document_amount`, `document_litres`) tipleri korunur.
4. **Test & Doğrulama:** `npm --prefix backend test` (200 test) ve `npm --prefix panel test` (183 test) çalıştırılarak sıfır regresyon sağlandığı doğrulanır.

## 4. Kurallara Dayanak
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Paket 07B (Satır 98: Bugünkü sevkiyat veritabanı, `/dispatch/today` REST API ve sevkiyat servisi entegrasyonu).

## 5. Açık Varsayımlar
- `VARSAYIM 1`: Backend servisine ulaşılamadığında `getTodayDispatchSummary()` / `getTodayDispatchOrders()` offline catch bloğuna düşer, `customerState.todayDispatchSummary` null, `todayDispatchOrders` boş dizi kalır ve uygulama çökmez.
- `VARSAYIM 2`: Backend tarafında `createTodayDispatchRouter` (`backend/src/modules/dispatch/todayDispatchRouter.js`) `/summary` ve `/orders` alt rotalarını sunar.

## 6. Riskler ve Rollback
- **Risk:** Offline ortamda backend fetch exception fırlatabilir.
- **Rollback / Koruma:** İlgili adımlar `try { ... } catch (e) { console.warn('Today dispatch sync skipped:', e); }` bloğu ile izole edilmiştir.
