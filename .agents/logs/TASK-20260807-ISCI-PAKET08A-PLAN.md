# İşçi Ajan Planı: Paket 08A — Resmî Tahsilatın Belgeler Katmanını Devralması

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
BAĞIMSIZLIK NOTU: Aynı oturum içinde farklı rol olarak çalışılıyor — rol ayrımı yalnızca prosedüreldir, bağlam düzeyinde değildir.
KURAL ÇELİŞKİSİ: Yok

## 1. Hedef
Paket 08A (Resmî Tahsilatın Belgeler Katmanını Devralması) entegrasyonunu tekil ve bağımsız bir paket olarak, mevcut `officialTakeoverService.ts` servis fonksiyonuna (`reconcileOfficialTakeover`) ve backend `officialTakeoverRouter.js` (`/payment/official-takeover/reconcile-takeover`) rotasına sadık kalarak `customerState` katmanına bağlamak, birim testlerini (backend router + panel service) eklemek ve sistemi mühürlemek.

## 2. Kapsam (Tam Dosya Listesi)
1. `panel/src/services/customerService.ts`: `customerState` nesnesine `officialTakeoverRecords: any[]` alanını ve `getOfficialTakeoverStateSync()` yardımcısını eklemek.
2. `panel/src/services/officialTakeoverService.ts`: Servis tiplerini ve `/payment/official-takeover/reconcile-takeover` API istemcisini eksiksiz doğrulamak.
3. `backend/src/modules/payment/officialTakeoverRouter.js`: POST `/reconcile-takeover` rotasını backend tarafında izole edip %80 eşleşme mantığı ve transient evrak pasifleştirmesini mühürlemek.
4. `backend/src/modules/payment/__tests__/officialTakeoverRouter.test.js` [YENİ]: Backend official takeover router için %80 eşik testi, transient doc deaktivasyonu ve hata durumlarını kapsayan birim test yazmak.
5. `panel/src/services/__tests__/officialTakeoverService.test.ts` [YENİ]: Panel tarafı officialTakeoverService için API istemci çağrısını ve payload serileştirmesini doğrulayan birim test yazmak.

## 3. Yaklaşım (Adım Adım)
1. **State Tanımı (`customerService.ts`):** `customerState` nesnesine `mockOfficialTakeoverRecords = []` değişkeni üzerinden `officialTakeoverRecords` getter/setter'ı ve `getOfficialTakeoverStateSync()` fonksiyonu eklenir.
2. **Backend Birim Testi (`officialTakeoverRouter.test.js`):** `express` ve mock Supabase client kullanılarak POST `/reconcile-takeover` rotasının %80 eşleşme oranında `RECONCILED_WITH_EXCEPTIONS`, altındaki oranlarda `LOW_MATCH_REVIEW` döndürdüğü ve `ops_doc_transient` kaydını `is_active: false` yaptığı doğrulanır.
3. **Panel Birim Testi (`officialTakeoverService.test.ts`):** `fetchApi` mock edilerek `reconcileOfficialTakeover` servis çağrısının doğru URL ve body ile istek yaptığı doğrulanır.
4. **Test & Doğrulama:** `npm --prefix backend test` ve `npm --prefix panel test` çalıştırılarak regresyonsuz tam başarı elde edilir.

## 4. Kurallara Dayanak
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Paket 08A (Resmî Tahsilatın Belgeler Katmanını Devralması, Migration 42 `official_collection_takeover` tablosu, transient evrak deaktivasyonu ve %80 mutabakat barajı).

## 5. Açık Varsayımlar
- `VARSAYIM 1`: `server.js` üzerinde `/api/v2/payment/official-takeover` altında `createOfficialTakeoverRouter({ clients })` mount edilmiştir.
- `VARSAYIM 2`: Eşleşen geçici evraklar (`ops_doc_transient`) resmî tahsilat devralması gerçekleştiğinde `is_active: false` yapılır ve resmî kayıt `official_collection_takeover` tablosuna aktarılır.

## 6. Riskler ve Rollback
- **Risk:** Veritabanı istemcisi erişilemez veya hatalı veri geldiğinde 500 hatası üretilebilir.
- **Rollback / Koruma:** Router `try { ... } catch (err)` bloğu ile korumalıdır; hata durumunda `{ error: err.message }` dönerek sunucunun çökmesi engellenir.
