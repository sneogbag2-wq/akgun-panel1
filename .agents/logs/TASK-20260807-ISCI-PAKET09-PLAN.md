# İşçi Ajan Planı: Paket 09 — İADE/HİZMET Tahsilatı

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
BAĞIMSIZLIK NOTU: Aynı oturum içinde farklı rol olarak çalışılıyor — rol ayrımı yalnızca prosedüreldir, bağlam düzeyinde değildir.
KURAL ÇELİŞKİSİ: Yok

## 1. Hedef
Paket 09 (İADE/HİZMET Tahsilatı) entegrasyonunu tekil ve bağımsız bir paket olarak, mevcut `returnServiceCreditService.ts` servis fonksiyonuna (`registerReturnServiceCredit`) ve backend `returnServiceRouter.js` (`/ledger/return-service-credit/register`) rotasına sadık kalarak `customerState` katmanına bağlamak, birim testlerini (backend + panel) tamamlamak ve sistemi mühürlemektir.

## 2. Kapsam (Tam Dosya Listesi)
1. `panel/src/services/customerService.ts`: `customerState` nesnesine `returnServiceCredits: any[]` alanını ve `getReturnServiceCreditStateSync()` yardımcısını eklemek.
2. `panel/src/services/returnServiceCreditService.ts`: Servis tiplerini ve `/ledger/return-service-credit/register` API istemcisini mühürlemek.
3. `backend/src/modules/ledger/returnServiceRouter.js`: POST `/register` rotasını `return_service_credit_event` tablosu kaydı ve validation ile mühürlemek.
4. `backend/src/modules/ledger/__tests__/returnServiceRouter.test.js` [YENİ]: Backend returnServiceRouter için `IADE` / `HIZMET` kredi kaydı, eksik parametre 400 ve DB mock testleri yazmak.
5. `panel/src/services/__tests__/returnServiceCreditService.test.ts` [YENİ]: Panel tarafı returnServiceCreditService için API istemci çağrısını doğrulayan birim test yazmak.

## 3. Yaklaşım (Adım Adım)
1. **State Tanımı (`customerService.ts`):** `customerState` nesnesine `mockReturnServiceCredits = []` değişkeni üzerinden `returnServiceCredits` getter/setter'ı ve `getReturnServiceCreditStateSync()` fonksiyonu eklenecek.
2. **Backend Birim Testi (`returnServiceRouter.test.js`):** Mock client ile POST `/register` rotasının `IADE` ve `HIZMET` tiplerinde kayıt fırlattığı, eksik parametrede 400 döndürdüğü doğrulanacak.
3. **Panel Birim Testi (`returnServiceCreditService.test.ts`):** `fetchApi` mock edilerek `registerReturnServiceCredit` servis çağrısının doğru URL ve body ile istek yaptığı doğrulanacak.
4. **Test & Doğrulama:** `npm --prefix backend test` ve `npm --prefix panel test` çalıştırılarak regresyonsuz yeşil sonuç elde edilecek.

## 4. Kurallara Dayanak
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Paket 09 (İADE/HİZMET Tahsilatı, Migration 44 `return_service_credit_event` tablosu).

## 5. Açık Varsayımlar
- `VARSAYIM 1`: `server.js` üzerinde `/api/v2/ledger/return-service-credit` altında `createReturnServiceRouter({ clients })` mount edilmiştir.

## 6. Riskler ve Rollback
- **Risk:** Eksik evrak/tutar parametresinde 400 hatası.
- **Rollback / Koruma:** Validation ve try/catch koruması mevcuttur.
