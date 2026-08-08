# İşçi Ajan Planı: Paket 14 — AI Semantik Çözümleme ve Araç Orkestrasyonu

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
BAĞIMSIZLIK NOTU: Aynı oturum içinde farklı rol olarak çalışılıyor — rol ayrımı yalnızca prosedüreldir, bağlam düzeyinde değildir.
KURAL ÇELİŞKİSİ: Yok

## 1. Hedef
Paket 14 (AI Semantik Çözümleme ve Araç Orkestrasyonu, AIENG-001..024) entegrasyonunu tekil ve bağımsız bir paket olarak, backend `/ai/chat` rotasına bağlı `panel/src/services/aiService.ts` typed servis fonksiyonu ile `customerState` katmanına bağlamak, birim testlerini (backend + panel) tamamlamak ve sistemi mühürlemektir.

## 2. Kapsam (Tam Dosya Listesi)
1. `panel/src/services/aiService.ts` [YENİ]: `sendAiChatMessage(payload)` typed istemci fonksiyonunu POST `/ai/chat` endpoint'i üzerinden tanımlamak.
2. `panel/src/services/customerService.ts`: `customerState` nesnesine `aiChatLogs` getter/setter ve `getAiStateSync()` yardımcısını eklemek.
3. `backend/src/modules/ai/aiRouter.js`: POST `/chat` rotasını model fallback ve Gemini streaming desteği ile mühürlemek.
4. `backend/src/modules/ai/__tests__/aiRouter.test.js` [YENİ]: Backend aiRouter için model failover ve 500 error durumlarını test etmek.
5. `panel/src/services/__tests__/aiService.test.ts` [YENİ]: Panel tarafı aiService için Vitest test takımı eklemek.

## 3. Yaklaşım (Adım Adım)
1. **Frontend Servis Dosyası (`aiService.ts`):** `/ai/chat` rotasına POST isteği atan `sendAiChatMessage` fonksiyonu oluşturulur.
2. **State Tanımı (`customerService.ts`):** `customerState.aiChatLogs` ve `getAiStateSync()` fonksiyonu doğrulanır.
3. **Backend Birim Testi (`aiRouter.test.js`):** API anahtarı yokluğunda veya model hatasında 500 error DTO'su döndüğünü doğrulamak.
4. **Panel Birim Testi (`aiService.test.ts`):** `fetchApi` mock edilerek `sendAiChatMessage` servis çağrısının doğru çalıştığını doğrulamak.
5. **Test & Doğrulama:** `npm --prefix backend test` ve `npm --prefix panel test` çalıştırılarak regresyonsuz yeşil sonuç elde edilecek.

## 4. Kurallara Dayanak
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Paket 14 (AI Semantik Çözümleme ve Araç Orkestrasyonu, Migration 27 `aifocus_context` ve `aieng_agent_log` tabloları).

## 5. Açık Varsayımlar
- `VARSAYIM 1`: `server.js` üzerinde `/api/v2/ai` altında `createAiRouter()` mount edilmiştir.

## 6. Riskler ve Rollback
- **Risk:** Gemini API key yokluğunda 500 hatası.
- **Rollback / Koruma:** Model döngüsü sonunda fallback 500 JSON hatası döndürülür.
