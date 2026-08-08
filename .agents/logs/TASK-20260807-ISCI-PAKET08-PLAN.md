# İşçi Ajan Planı: Paket 08 — Tahsilat ve Kıymetli Evrak Motoru

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
BAĞIMSIZLIK NOTU: Aynı oturum içinde farklı rol olarak çalışılıyor — rol ayrımı yalnızca prosedüreldir, bağlam düzeyinde değildir.
KURAL ÇELİŞKİSİ: Yok

## 1. Hedef
Paket 08 (Tahsilat ve Kıymetli Evrak Motoru) entegrasyonunu tekil ve bağımsız bir paket olarak, backend `/instruments/accept-note` rotasına bağlı `panel/src/services/instrumentService.ts` typed servis fonksiyonu ile `customerState` katmanına bağlamak, birim testlerini (backend + panel) tamamlamak ve sistemi mühürlemektir.

## 2. Kapsam (Tam Dosya Listesi)
1. `panel/src/services/instrumentService.ts` [YENİ]: `acceptNote(params)` typed istemci fonksiyonunu `/instruments/accept-note` endpoint'i üzerinden tanımlamak.
2. `panel/src/services/customerService.ts`: `customerState` nesnesindeki `cheques` getter/setter ve `getChequesStateSync()` yardımcısını mühürlemek.
3. `backend/src/modules/instruments/instrumentRouter.js`: POST `/accept-note` rotasını validation, idempotency ve error handling ile mühürlemek.
4. `backend/src/modules/instruments/__tests__/instrumentRouter.test.js` [YENİ]: Backend instrumentRouter için 404 FEATURE_DISABLED, 400 validation ve 409 duplicate idempotency durumlarını test etmek.
5. `panel/src/services/__tests__/instrumentService.test.ts` [YENİ]: Panel tarafı instrumentService için Vitest birim testi eklemek.

## 3. Yaklaşım (Adım Adım)
1. **Frontend Servis Dosyası (`instrumentService.ts`):** `/instruments/accept-note` rotasına POST isteği atan `acceptNote` fonksiyonu oluşturulur.
2. **State Tanımı (`customerService.ts`):** `customerState.cheques` ve `getChequesStateSync()` fonksiyonu doğrulanır.
3. **Backend Birim Testi (`instrumentRouter.test.js`):** POST `/accept-note` rotasının feature flag kapalıyken 404, eksik parametrede 400 ve mükerrer istekte 409 döndürdüğünü doğrulamak.
4. **Panel Birim Testi (`instrumentService.test.ts`):** `fetchApi` mock edilerek `acceptNote` servis çağrısının doğru çalıştığını doğrulamak.
5. **Test & Doğrulama:** `npm --prefix backend test` ve `npm --prefix panel test` çalıştırılarak regresyonsuz yeşil sonuç elde edilecek.

## 4. Kurallara Dayanak
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Paket 08 (Tahsilat ve Kıymetli Evrak Motoru, Migration 24 `cheques` ve `promissory_notes` tabloları).

## 5. Açık Varsayımlar
- `VARSAYIM 1`: `server.js` üzerinde `/api/v2/instruments` altında `createInstrumentRouter()` mount edilmiştir.

## 6. Riskler ve Rollback
- **Risk:** Idempotency key uyuşmazlığı veya missing token durumunda 400/409.
- **Rollback / Koruma:** Router seviyesinde `DUPLICATE_IDEMPOTENCY` yakalaması mevcuttur.
