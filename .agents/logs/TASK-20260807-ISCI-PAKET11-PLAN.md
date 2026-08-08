# İşçi Ajan Planı: Paket 11 — Manuel İşlem, Override ve Kaynak Çatışması

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
BAĞIMSIZLIK NOTU: Aynı oturum içinde farklı rol olarak çalışılıyor — rol ayrımı yalnızca prosedüreldir, bağlam düzeyinde değildir.
KURAL ÇELİŞKİSİ: Yok

## 1. Hedef
Paket 11 (Manuel İşlem, Override ve Kaynak Çatışması) entegrasyonunu tekil ve bağımsız bir paket olarak, `backend/src/modules/ledger/overrideService.js` iş mantığına bağlı `panel/src/services/overrideService.ts` typed servis fonksiyonları ile `customerState` katmanına bağlamak, birim testlerini (backend + panel) tamamlamak ve sistemi mühürlemektir.

## 2. Kapsam (Tam Dosya Listesi)
1. `panel/src/services/overrideService.ts` [YENİ]: `softDeleteEntry(entryId)` ve `overrideEntry(oldEntryId, newAmount)` typed istemci fonksiyonlarını tanımlamak.
2. `panel/src/services/customerService.ts`: `customerState` nesnesine `overrideAudits` getter/setter ve `getOverrideStateSync()` yardımcısını eklemek.
3. `backend/src/modules/ledger/overrideRouter.js` [YENİ]: POST `/soft-delete` ve POST `/override` rotalarını `createOverrideService` ile bağlamak.
4. `backend/src/modules/ledger/__tests__/overrideRouter.test.js` [YENİ]: Backend overrideRouter için softDelete, override ve 400 validation durumlarını test etmek.
5. `panel/src/services/__tests__/overrideService.test.ts` [YENİ]: Panel tarafı overrideService için Vitest test takımı eklemek.

## 3. Yaklaşım (Adım Adım)
1. **Frontend Servis Dosyası (`overrideService.ts`):** `/ledger/override` rotalarına POST istekleri atan typed fonksiyonlar oluşturulur.
2. **State Tanımı (`customerService.ts`):** `customerState` nesnesine `mockOverrideAudits = []` backing variable'ı üzerinden getters/setters ve `getOverrideStateSync()` fonksiyonu eklenecek.
3. **Backend Birim Testi (`overrideRouter.test.js`):** Mock repository ile POST `/soft-delete` ve `/override` rotalarının doğru çalıştığı doğrulanacak.
4. **Panel Birim Testi (`overrideService.test.ts`):** `fetchApi` mock edilerek `overrideService` fonksiyonlarının doğru URL ve parametrelerle çalıştığı doğrulanacak.
5. **Test & Doğrulama:** `npm --prefix backend test` ve `npm --prefix panel test` çalıştırılarak regresyonsuz yeşil sonuç elde edilecek.

## 4. Kurallara Dayanak
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Paket 11 (Manuel İşlem, Override ve Kaynak Çatışması, MAN-001..010, Soft-Delete Kalkanı ve Override Flag İzolasyonu).

## 5. Açık Varsayımlar
- `VARSAYIM 1`: `server.js` veya `ledgerRouter.js` üzerinde `/api/v2/ledger/override` rotası mount edilir.

## 6. Riskler ve Rollback
- **Risk:** Fiziksel silme girişiminde 400/500 hatası.
- **Rollback / Koruma:** `overrideService.js` `deleted_at` soft-delete mantığı aynen korunur.
