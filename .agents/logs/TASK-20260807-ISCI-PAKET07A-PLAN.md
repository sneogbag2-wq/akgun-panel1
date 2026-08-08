# İşçi Ajan Planı: Paket 07A — Sipariş/Teslimat Belge Omurgası

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
BAĞIMSIZLIK NOTU: Aynı oturum içinde farklı rol olarak çalışılıyor — rol ayrımı yalnızca prosedüreldir, bağlam düzeyinde değildir.
KURAL ÇELİŞKİSİ: Yok

## 1. Hedef
Paket 07A (Sipariş/Teslimat Belge Omurgası) entegrasyonunu tekil ve bağımsız bir paket olarak, backend `/dispatch/sales-orders` rotalarına (`/active`, `/publish`) bağlı `panel/src/services/salesOrderService.ts` typed servis fonksiyonları ile `customerState` katmanına bağlamak, birim testlerini (backend + panel) tamamlamak ve sistemi mühürlemektir.

## 2. Kapsam (Tam Dosya Listesi)
1. `panel/src/services/salesOrderService.ts`: `getActiveSalesOrders()` ve `publishSalesOrders()` typed istemci fonksiyonlarını mühürlemek.
2. `panel/src/services/customerService.ts`: `customerState` nesnesine `salesOrderDocuments: SalesOrderDocument[]` getter/setter ve `getSalesOrderStateSync()` yardımcısını eklemek.
3. `backend/src/modules/dispatch/salesOrderRouter.js`: GET `/active` ve POST `/publish` rotalarını DB client ve error handling ile mühürlemek.
4. `backend/src/modules/dispatch/__tests__/salesOrderRouter.test.js` [YENİ]: Backend salesOrderRouter için active sipariş listeleme, publish kaydı ve DB error durumlarını test etmek.
5. `panel/src/services/__tests__/salesOrderService.test.ts` [YENİ]: Panel tarafı salesOrderService için Vitest birim testi eklemek.

## 3. Yaklaşım (Adım Adım)
1. **State Tanımı (`customerService.ts`):** `customerState` nesnesine `mockSalesOrderDocuments = []` değişkeni üzerinden `salesOrderDocuments` getter/setter'ı ve `getSalesOrderStateSync()` fonksiyonu eklenecek.
2. **Backend Birim Testi (`salesOrderRouter.test.js`):** Mock client ile GET `/active` ve POST `/publish` rotalarının doğru listeler ve yayımlama adedi döndürdüğünü doğrulamak.
3. **Panel Birim Testi (`salesOrderService.test.ts`):** `fetchApi` mock edilerek `getActiveSalesOrders` ve `publishSalesOrders` servis çağrılarının doğru çalıştığını doğrulamak.
4. **Test & Doğrulama:** `npm --prefix backend test` ve `npm --prefix panel test` çalıştırılarak regresyonsuz yeşil sonuç elde edilecek.

## 4. Kurallara Dayanak
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Paket 07A (Sipariş/Teslimat Belge Omurgası, Migration 40 `sales_orders` tablosu).

## 5. Açık Varsayımlar
- `VARSAYIM 1`: `server.js` üzerinde `/api/v2/dispatch/sales-orders` altında `createSalesOrderRouter({ clients })` mount edilmiştir.

## 6. Riskler ve Rollback
- **Risk:** DB istemcisi yokluğunda 500 error.
- **Rollback / Koruma:** Router seviyesinde `if (!client)` kontrolü mevcuttur.
