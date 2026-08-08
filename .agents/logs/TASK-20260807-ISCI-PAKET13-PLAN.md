# İşçi Ajan Planı: Paket 13 — Merkezi Metrik Registry ve Engine

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
BAĞIMSIZLIK NOTU: Aynı oturum içinde farklı rol olarak çalışılıyor — rol ayrımı yalnızca prosedüreldir, bağlam düzeyinde değildir.
KURAL ÇELİŞKİSİ: Yok

## 1. Hedef
Paket 13 (Merkezi Metrik Registry ve Engine, MET-001..020) entegrasyonunu tekil ve bağımsız bir paket olarak, backend `/engine` rotalarına (`/ops-documents`, `/stl-matched-signals`, `/advanced/metric-registry`) bağlı `panel/src/services/engineService.ts` typed servis fonksiyonları ile `customerState` katmanına bağlamak, birim testlerini (backend + panel) tamamlamak ve sistemi mühürlemektir.

## 2. Kapsam (Tam Dosya Listesi)
1. `panel/src/services/engineService.ts` [YENİ]: `getMetricRegistry()`, `getOpsDocuments()`, `getStlMatchedSignals()` typed istemci fonksiyonlarını tanımlamak.
2. `panel/src/services/customerService.ts`: `customerState` nesnesine `metricRegistry` getter/setter ve `getEngineStateSync()` yardımcısını eklemek.
3. `backend/src/modules/engine/engineRouter.js`: Rotaları `/status`, `/ops-documents`, `/stl-matched-signals`, `/advanced/metric-registry` altında korumak.
4. `backend/src/modules/engine/__tests__/engineRouter.test.js` [YENİ]: Backend engineRouter için rotaları ve repository/error handling senaryolarını test etmek.
5. `panel/src/services/__tests__/engineService.test.ts` [YENİ]: Panel tarafı engineService için Vitest test takımı eklemek.

## 3. Yaklaşım (Adım Adım)
1. **Frontend Servis Dosyası (`engineService.ts`):** `/engine` alt rotalarına GET istekleri atan typed fonksiyonlar oluşturulur.
2. **State Tanımı (`customerService.ts`):** `customerState` nesnesine `mockMetricRegistry = []` backing variable'ı üzerinden getters/setters ve `getEngineStateSync()` fonksiyonu eklenecek.
3. **Backend Birim Testi (`engineRouter.test.js`):** Mock repository ile GET `/status`, `/ops-documents`, `/advanced/metric-registry` rotalarının doğru listeler fırlattığı doğrulanacak.
4. **Panel Birim Testi (`engineService.test.ts`):** `fetchApi` mock edilerek `engineService` fonksiyonlarının doğru URL ve parametrelerle çalıştığı doğrulanacak.
5. **Test & Doğrulama:** `npm --prefix backend test` ve `npm --prefix panel test` çalıştırılarak regresyonsuz yeşil sonuç elde edilecek.

## 4. Kurallara Dayanak
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Paket 13 (Merkezi Metrik Registry ve Engine, MET-001..020, `met_metric_registry` tablosu).

## 5. Açık Varsayımlar
- `VARSAYIM 1`: `server.js` üzerinde `/api/v2/engine` altında `createEngineRouter()` mount edilmiştir.

## 6. Riskler ve Rollback
- **Risk:** Feature flag kapalıyken 404 FEATURE_DISABLED dönmesi.
- **Rollback / Koruma:** Router seviyesinde `if (!enabled)` kontrolü korunur.
