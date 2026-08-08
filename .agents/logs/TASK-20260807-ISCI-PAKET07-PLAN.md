# İşçi Ajan Planı: Paket 07 — Satış Faturası ve Aktif İptal Motoru

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
BAĞIMSIZLIK NOTU: Aynı oturum içinde farklı rol olarak çalışılıyor — rol ayrımı yalnızca prosedüreldir, bağlam düzeyinde değildir.
KURAL ÇELİŞKİSİ: Yok

## 1. Hedef
Paket 07 (Satış Faturası ve Aktif İptal Motoru) entegrasyonunu tekil ve bağımsız bir paket olarak, backend `/invoice` rotasına bağlı `panel/src/services/invoiceService.ts` typed servis fonksiyonu ile `customerState` katmanına bağlamak, birim testlerini (backend + panel) tamamlamak ve sistemi mühürlemektir.

## 2. Kapsam (Tam Dosya Listesi)
1. `panel/src/services/invoiceService.ts` [YENİ]: `getSalesInvoicesList()` typed istemci fonksiyonunu `/invoice` endpoint'i üzerinden tanımlamak.
2. `panel/src/services/customerService.ts`: `customerState` nesnesindeki `salesInvoices` getter/setter'ı ve `getSalesInvoicesStateSync()` yardımcısını mühürlemek.
3. `backend/src/modules/invoice/invoiceRouter.js`: GET `/` rotasını `invoiceService.list` ve error handling ile mühürlemek.
4. `backend/src/modules/invoice/__tests__/invoiceRouter.test.js` [YENİ]: Backend invoiceRouter için listeleme, 404 FEATURE_DISABLED ve 500 error durumlarını test etmek.
5. `panel/src/services/__tests__/invoiceService.test.ts` [YENİ]: Panel tarafı invoiceService için Vitest birim testi eklemek.

## 3. Yaklaşım (Adım Adım)
1. **Frontend Servis Dosyası (`invoiceService.ts`):** `/invoice` rotasına GET isteği atan `getSalesInvoicesList` fonksiyonu oluşturulur.
2. **State Tanımı (`customerService.ts`):** `customerState.salesInvoices` ve `getSalesInvoicesStateSync()` fonksiyonu doğrulanır.
3. **Backend Birim Testi (`invoiceRouter.test.js`):** GET `/` rotasının doğru veri fırlattığını ve feature flag kapalıyken 404 döndüğünü doğrulamak.
4. **Panel Birim Testi (`invoiceService.test.ts`):** `fetchApi` mock edilerek `getSalesInvoicesList` servis çağrısının doğru çalıştığı doğrulanacak.
5. **Test & Doğrulama:** `npm --prefix backend test` ve `npm --prefix panel test` çalıştırılarak regresyonsuz yeşil sonuç elde edilecek.

## 4. Kurallara Dayanak
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Paket 07 (Satış Faturası ve Aktif İptal Motoru, Migration 23 `invoices` tablosu ve e-fatura listesi).

## 5. Açık Varsayımlar
- `VARSAYIM 1`: `server.js` üzerinde `/api/v2/invoice` altında `createInvoiceRouter()` mount edilmiştir.

## 6. Riskler ve Rollback
- **Risk:** Feature flag kapalıyken 404 FEATURE_DISABLED dönmesi.
- **Rollback / Koruma:** Router seviyesinde `if (!enabled)` kontrolü mevcuttur.
