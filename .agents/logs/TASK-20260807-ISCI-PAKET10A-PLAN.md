# İşçi Ajan Planı: Paket 10A — Teslim Edilmiş Fatura Kontrol Entegrasyonu

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
KURAL ÇELİŞKİSİ: Yok

## 1. Hedef
Paket 10A (Teslim Edilmiş Fatura Kontrol) modülünü tekil ve bağımsız bir paket olarak, mevcut `deliveredInvoiceCheckService.ts` içindeki typed servis fonksiyonuna (`getDeliveredInvoiceOpenStack`) ve backend `/ledger/delivered-invoice/open-stack` rotasına sadık kalarak `customerState` nesnesine bağlamak.

## 2. Kapsam (Tam Dosya Listesi)
1. `panel/src/services/customerService.ts`: `customerState` nesnesine `deliveredInvoiceOpenStack: DeliveredInvoiceOpenStackItem[]` alanını eklemek.
2. `panel/src/services/apiSyncService.ts`: `deliveredInvoiceCheckService.ts` içindeki `getDeliveredInvoiceOpenStack()` fonksiyonunu çağırarak `customerState` nesnesine aktarmak.

## 3. Yaklaşım (Adım Adım)
1. **State Tanımı (`customerService.ts`):** `customerState` nesnesine `mockDeliveredInvoiceOpenStack = []` backing variable ile `deliveredInvoiceOpenStack` getter/setter ve `getDeliveredInvoiceOpenStackStateSync()` yardımcısı eklenir.
2. **Sync Entegrasyonu (`apiSyncService.ts`):** `deliveredInvoiceCheckService.ts` modülünden `getDeliveredInvoiceOpenStack` içe aktarılır. `syncDataFromApi()` fonksiyonunda try/catch bloğu ile çağrılarak `customerState.deliveredInvoiceOpenStack` alanına yazılır.
3. **Mevcut Tiplere Tam Uyum:** `DeliveredInvoiceOpenStackItem` (`id`, `customer_id`, `open_amount`, `stack_type`) tip imzası birebir korunur.
4. **Test & Doğrulama:** `npm --prefix backend test` (200 test) ve `npm --prefix panel test` (183 test) çalıştırılarak sıfır regresyon sağlandığı doğrulanır.

## 4. Kurallara Dayanak
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Paket 10A (Satır 104: Teslim Edilmiş Fatura Kontrol veritabanı, `/ledger/delivered-invoice` REST API ve servis entegrasyonu).

## 5. Açık Varsayımlar
- `VARSAYIM 1`: Backend çevrimdışı durumdayken (offline test) `getDeliveredInvoiceOpenStack()` try/catch bloğuna düşer, `customerState.deliveredInvoiceOpenStack` boş dizi `[]` olarak kalır ve uygulama çökmez.
- `VARSAYIM 2`: Backend tarafında `createDeliveredInvoiceRouter` (`backend/src/modules/ledger/deliveredInvoiceRouter.js`) `/open-stack` ve `/check` alt rotalarını sunar.

## 6. Riskler ve Rollback
- **Risk:** Offline ortamda backend fetch exception fırlatabilir.
- **Rollback / Koruma:** İlgili kod bloğu `try { ... } catch (e) { console.warn('Delivered invoice open stack sync skipped:', e); }` yapısıyla izole edilecek; hata durumunda mevcut durum bozulmayacaktır.
