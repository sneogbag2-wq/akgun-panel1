# İşçi Ajan Planı: Paket 12 — Finansal Performans, Risk ve İleri Analiz (12A..12F)

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
BAĞIMSIZLIK NOTU: Aynı oturum içinde farklı rol olarak çalışılıyor — rol ayrımı yalnızca prosedüreldir, bağlam düzeyinde değildir.
KURAL ÇELİŞKİSİ: Yok

## 1. Hedef
Paket 12 (Finansal Performans, Risk ve İleri Analiz, FIN-001..020) entegrasyonunu tekil ve bağımsız bir paket olarak, backend `/financial` rotalarına bağlı `panel/src/services/financialService.ts` typed servis fonksiyonları ile `customerState` katmanına bağlamak, birim testlerini (backend + panel) tamamlamak ve sistemi mühürlemektir.

## 2. Kapsam (Tam Dosya Listesi)
1. `backend/src/modules/financial/financialRouter.js` [YENİ]: GET `/analysis`, `/cei`, `/health-score`, `/credit-limit` rotalarını `createFinancialReadService` üzerinden oluşturmak.
2. `panel/src/services/financialService.ts` [YENİ]: `getFinancialAnalysis()`, `getCEI()`, `getHealthScore()`, `getCreditLimit()` typed istemci fonksiyonlarını tanımlamak.
3. `panel/src/services/customerService.ts`: `customerState` nesnesine `financialAnalysisResults` getter/setter ve `getFinancialStateSync()` yardımcısını eklemek.
4. `backend/src/modules/financial/__tests__/financialRouter.test.js` [YENİ]: Backend financialRouter için rotaları ve service/error handling senaryolarını test etmek.
5. `panel/src/services/__tests__/financialService.test.ts` [YENİ]: Panel tarafı financialService için Vitest test takımı eklemek.

## 3. Yaklaşım (Adım Adım)
1. **Backend Router Dosyası (`financialRouter.js`):** `/financial` rotalarını Express Router olarak tanımlayıp `server.js` üzerinde `/api/v2/financial` altında mount etmek.
2. **Frontend Servis Dosyası (`financialService.ts`):** `/financial` rotalarına GET istekleri atan typed fonksiyonlar oluşturulur.
3. **State Tanımı (`customerService.ts`):** `customerState` nesnesine `mockFinancialAnalysisResults = []` backing variable'ı üzerinden getters/setters ve `getFinancialStateSync()` fonksiyonu eklenecek.
4. **Backend Birim Testi (`financialRouter.test.js`):** GET `/analysis`, `/cei`, `/health-score`, `/credit-limit` rotalarının doğru sonuçlar ürettiği doğrulanacak.
5. **Panel Birim Testi (`financialService.test.ts`):** `fetchApi` mock edilerek `financialService` fonksiyonlarının doğru çalıştığı doğrulanacak.
6. **Test & Doğrulama:** `npm --prefix backend test` ve `npm --prefix panel test` çalıştırılarak regresyonsuz yeşil sonuç elde edilecek.

## 4. Kurallara Dayanak
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Paket 12 (Finansal Performans, Risk ve İleri Analiz 12A..12F, FIN-001..020, DSO, CEI, Sağlık Skoru, Limit Motoru).

## 5. Açık Varsayımlar
- `VARSAYIM 1`: `server.js` üzerinde `/api/v2/financial` altında `createFinancialRouter()` mount edilmiştir.

## 6. Riskler ve Rollback
- **Risk:** Repository eksikliğinde 500 error.
- **Rollback / Koruma:** Service katmanında `if (!repository)` throw kontrolü korunur.
