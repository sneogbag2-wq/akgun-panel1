# İşçi Ajan Planı: Paket 05 — FKNS ve Ürün Penetrasyonu Motoru

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
BAĞIMSIZLIK NOTU: Aynı oturum içinde farklı rol olarak çalışılıyor — rol ayrımı yalnızca prosedüreldir, bağlam düzeyinde değildir.
KURAL ÇELİŞKİSİ: Yok

## 1. Hedef
Paket 05 (FKNS ve Ürün Penetrasyonu Motoru) entegrasyonunu tekil ve bağımsız bir paket olarak, backend `/fkns/analyze` rotası ve motoruna (`fknsService.js`) bağlı `panel/src/services/fknsService.ts` typed servis fonksiyonu ile `customerState` katmanına bağlamak, birim testlerini (backend + panel) tamamlamak ve sistemi mühürlemektir.

## 2. Kapsam (Tam Dosya Listesi)
1. `panel/src/services/fknsService.ts` [YENİ]: `runFknsAnalysis(regionId, runId, rawFknsData)` typed servis fonksiyonunu `/fkns/analyze` endpoint'i üzerinden tanımlamak.
2. `panel/src/services/customerService.ts`: `customerState` nesnesine `fknsAnalysisResults: any[]` alanını ve `getFknsStateSync()` yardımcısını eklemek.
3. `backend/src/modules/fkns/fknsRouter.js`: POST `/analyze` rotasını `regionId`, `runId`, `rawFknsData` parametreleri ve DB/MetricEngine bağlantısıyla mühürlemek.
4. `backend/src/modules/fkns/__tests__/fknsRouter.test.js` [YENİ]: Backend fknsRouter için analiz çağrısı, eksik parametre 400 ve 500 hata durumlarını test etmek.
5. `panel/src/services/__tests__/fknsService.test.ts` [YENİ]: Panel tarafı fknsService için Vitest birim testi eklemek.

## 3. Yaklaşım (Adım Adım)
1. **Frontend Servis Dosyası (`fknsService.ts`):** `/fkns/analyze` rotasına POST isteği atan `runFknsAnalysis` fonksiyonu oluşturulur.
2. **State Tanımı (`customerService.ts`):** `customerState` nesnesine `mockFknsAnalysisResults = []` değişkeni üzerinden `fknsAnalysisResults` getter/setter'ı ve `getFknsStateSync()` fonksiyonu eklenecek.
3. **Backend Birim Testi (`fknsRouter.test.js`):** Mock metric engine servisi ile POST `/analyze` rotasının metrik kaydı yaptığını ve validation 400 hatası döndüğünü doğrulamak.
4. **Panel Birim Testi (`fknsService.test.ts`):** `fetchApi` mock edilerek `runFknsAnalysis` servis çağrısının doğru URL ve body ile istek yaptığı doğrulanacak.
5. **Test & Doğrulama:** `npm --prefix backend test` ve `npm --prefix panel test` çalıştırılarak regresyonsuz yeşil sonuç elde edilecek.

## 4. Kurallara Dayanak
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Paket 05 (FKNS ve Ürün Penetrasyonu Motoru, Kapsam/Nokta/Sıklık metrikleri FKNS-001, FKNS-002, FKNS-003).

## 5. Açık Varsayımlar
- `VARSAYIM 1`: `server.js` üzerinde `/api/v2/fkns` altında `createFknsRouter({ metricEngineService })` mount edilmiştir.

## 6. Riskler ve Rollback
- **Risk:** Eksik rawFknsData parametresinde 400 fırlatılır.
- **Rollback / Koruma:** Router seviyesinde `if (!regionId || !runId || !rawFknsData)` validation koruması mevcuttur.
