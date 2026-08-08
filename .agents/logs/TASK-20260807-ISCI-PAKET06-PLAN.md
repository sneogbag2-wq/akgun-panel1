# İşçi Ajan Planı: Paket 06 — KA Talebi, Aktif Stok, Tahmin, Stok Günü ve Sipariş

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
BAĞIMSIZLIK NOTU: Aynı oturum içinde farklı rol olarak çalışılıyor — rol ayrımı yalnızca prosedüreldir, bağlam düzeyinde değildir.
KURAL ÇELİŞKİSİ: Yok

## 1. Hedef
Paket 06 (KA Talebi, Aktif Stok, Tahmin, Stok Günü ve Sipariş) entegrasyonunu tekil ve bağımsız bir paket olarak, backend `/forecast` rotalarına (`/daily-model`, `/safety-stock`, `/stockout-risk`, `/replenishment`) bağlı `panel/src/services/forecastService.ts` typed servis fonksiyonu ile `customerState` katmanına bağlamak, birim testlerini (backend + panel) tamamlamak ve sistemi mühürlemektir.

## 2. Kapsam (Tam Dosya Listesi)
1. `panel/src/services/forecastService.ts` [YENİ]: `getDailyForecastModel()`, `getSafetyStock()`, `getStockoutRisk()`, `getReplenishmentRecommendations()` typed istemci fonksiyonlarını tanımlamak.
2. `panel/src/services/customerService.ts`: `customerState` nesnesine `forecastModels` ve `replenishmentRecommendations` alanlarını ve `getForecastStateSync()` yardımcısını eklemek.
3. `backend/src/modules/forecast/forecastRouter.js`: Rotaları `/daily-model`, `/safety-stock`, `/stockout-risk`, `/replenishment` altında korumak.
4. `backend/src/modules/forecast/__tests__/forecastRouter.test.js` [YENİ]: Backend forecastRouter için rotaları ve repository/error handling senaryolarını test etmek.
5. `panel/src/services/__tests__/forecastService.test.ts` [YENİ]: Panel tarafı forecastService için Vitest test takımı eklemek.

## 3. Yaklaşım (Adım Adım)
1. **Frontend Servis Dosyası (`forecastService.ts`):** `/forecast` alt rotalarına GET istekleri atan typed fonksiyonlar oluşturulur.
2. **State Tanımı (`customerService.ts`):** `customerState` nesnesine `mockForecastModels = []` ve `mockReplenishmentRecommendations = []` backing variable'ları üzerinden getters/setters ve `getForecastStateSync()` fonksiyonu eklenecek.
3. **Backend Birim Testi (`forecastRouter.test.js`):** Mock repository ile GET `/daily-model`, `/safety-stock`, `/stockout-risk`, `/replenishment` rotalarının doğru listeler fırlattığı doğrulanacak.
4. **Panel Birim Testi (`forecastService.test.ts`):** `fetchApi` mock edilerek `forecastService` fonksiyonlarının doğru URL ve parametrelerle çalıştığı doğrulanacak.
5. **Test & Doğrulama:** `npm --prefix backend test` ve `npm --prefix panel test` çalıştırılarak regresyonsuz yeşil sonuç elde edilecek.

## 4. Kurallara Dayanak
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Paket 06 (KA Talebi, Aktif Stok, Tahmin, Stok Günü ve Sipariş, FCST-001, SS-001, RISK-001, ORD-001 metrikleri).

## 5. Açık Varsayımlar
- `VARSAYIM 1`: `server.js` üzerinde `/api/v2/forecast` altında `createForecastRouter()` mount edilmiştir.

## 6. Riskler ve Rollback
- **Risk:** Feature flag kapalıyken 404 FEATURE_DISABLED dönmesi.
- **Rollback / Koruma:** Router seviyesinde `if (!enabled)` kontrolü korunur.
