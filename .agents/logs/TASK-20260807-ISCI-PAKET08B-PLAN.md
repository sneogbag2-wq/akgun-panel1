# İşçi Ajan Planı: Paket 08B — Senet/Bono Hazırlama ve Yazdırma

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
BAĞIMSIZLIK NOTU: Aynı oturum içinde farklı rol olarak çalışılıyor — rol ayrımı yalnızca prosedüreldir, bağlam düzeyinde değildir.
KURAL ÇELİŞKİSİ: Yok

## 1. Hedef
Paket 08B (Senet/Bono Hazırlama ve Yazdırma) entegrasyonunu tekil ve bağımsız bir paket olarak, mevcut `promissoryNoteService.ts` servis fonksiyonuna (`createPromissoryNoteDraft`) ve backend `promissoryNoteRouter.js` (`/instruments/promissory-note/create-draft`) rotasına sadık kalarak `customerState` katmanına bağlamak, birim testlerini (backend + panel) tamamlamak ve sistemi mühürlemektir.

## 2. Kapsam (Tam Dosya Listesi)
1. `panel/src/services/customerService.ts`: `customerState` nesnesine `promissoryNoteDrafts: any[]` alanını ve `getPromissoryNoteStateSync()` yardımcısını eklemek.
2. `panel/src/services/promissoryNoteService.ts`: Servis tiplerini ve `/instruments/promissory-note/create-draft` API istemcisini mühürlemek.
3. `backend/src/modules/instruments/promissoryNoteRouter.js`: POST `/create-draft` rotasını taksit bölüştürme, kuruş artığı (remainder) yönetimi ve DB error handling ile korumak.
4. `backend/src/modules/instruments/__tests__/promissoryNoteRouter.test.js` [YENİ]: Backend promissory note router için taksit tutarı yuvarlama, eksik parametre 400 kontrolü ve DB mock testleri yazmak.
5. `panel/src/services/__tests__/promissoryNoteService.test.ts` [YENİ]: Panel tarafı promissoryNoteService için API istemci çağrısını doğrulayan birim test yazmak.

## 3. Yaklaşım (Adım Adım)
1. **State Tanımı (`customerService.ts`):** `customerState` nesnesine `mockPromissoryNoteDrafts = []` değişkeni üzerinden `promissoryNoteDrafts` getter/setter'ı ve `getPromissoryNoteStateSync()` fonksiyonu eklenecek.
2. **Backend Birim Testi (`promissoryNoteRouter.test.js`):** Mock client ile POST `/create-draft` rotasının doğru taksit böldüğü, son takside kuruş artığını eklediği ve eksik `customerId`/`totalAmount` durumunda 400 döndürdüğü doğrulanacak.
3. **Panel Birim Testi (`promissoryNoteService.test.ts`):** `fetchApi` mock edilerek `createPromissoryNoteDraft` servis çağrısının doğru URL ve body ile istek yaptığı doğrulanacak.
4. **Test & Doğrulama:** `npm --prefix backend test` ve `npm --prefix panel test` çalıştırılarak regresyonsuz yeşil sonuç elde edilecek.

## 4. Kurallara Dayanak
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Paket 08B (Senet/Bono Hazırlama ve Yazdırma, Migration 43 `promissory_note_draft` & `promissory_note_installment` tabloları, taksit bölüştürme ve A5 yazdırma şablonu).

## 5. Açık Varsayımlar
- `VARSAYIM 1`: `server.js` üzerinde `/api/v2/instruments/promissory-note` altında `createPromissoryNoteRouter({ clients })` mount edilmiştir.
- `VARSAYIM 2`: Taksit hesaplamalarında eşit küsurat bölüştürmesinden kalan kuruş artığı son takside eklenir.

## 6. Riskler ve Rollback
- **Risk:** Geçersiz parametreler veya DB hatalarında 400/500 fırlatılabilir.
- **Rollback / Koruma:** Router seviyesinde validation ve try/catch koruması mevcuttur.
