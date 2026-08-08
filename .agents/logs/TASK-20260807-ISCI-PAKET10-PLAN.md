# İşçi Ajan Planı: Paket 10 — Cari Defter, FIFO Fatura Dağıtımı ve Aging

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
BAĞIMSIZLIK NOTU: Aynı oturum içinde farklı rol olarak çalışılıyor — rol ayrımı yalnızca prosedüreldir, bağlam düzeyinde değildir.
KURAL ÇELİŞKİSİ: Yok

## 1. Hedef
Paket 10 (Cari Defter, FIFO Fatura Dağıtımı ve Aging) entegrasyonunu tekil ve bağımsız bir paket olarak, backend `/ledger` rotalarına (`/`, `/aging-migration`, `/stress-scenarios`) bağlı `panel/src/services/ledgerService.ts` typed servis fonksiyonları ile `customerState` katmanına bağlamak, birim testlerini (backend + panel) tamamlamak ve sistemi mühürlemektir.

## 2. Kapsam (Tam Dosya Listesi)
1. `panel/src/services/ledgerService.ts` [YENİ]: `getLedgerEntries()`, `getAgingMigration()`, `getStressScenarios()` typed istemci fonksiyonlarını tanımlamak.
2. `panel/src/services/customerService.ts`: `customerState` nesnesine `ledgerEntries` getter/setter ve `getLedgerStateSync()` yardımcısını eklemek.
3. `backend/src/modules/ledger/ledgerRouter.js`: Rotaları `/status`, `/`, `/aging-migration`, `/stress-scenarios` altında korumak.
4. `backend/src/modules/ledger/__tests__/ledgerRouter.test.js` [YENİ]: Backend ledgerRouter için rotaları ve repository/error handling senaryolarını test etmek.
5. `panel/src/services/__tests__/ledgerService.test.ts` [YENİ]: Panel tarafı ledgerService için Vitest test takımı eklemek.

## 3. Yaklaşım (Adım Adım)
1. **Frontend Servis Dosyası (`ledgerService.ts`):** `/ledger` alt rotalarına GET istekleri atan typed fonksiyonlar oluşturulur.
2. **State Tanımı (`customerService.ts`):** `customerState` nesnesine `mockLedgerEntries = []` backing variable'ı üzerinden getters/setters ve `getLedgerStateSync()` fonksiyonu eklenecek.
3. **Backend Birim Testi (`ledgerRouter.test.js`):** Mock repository ile GET `/`, `/aging-migration`, `/stress-scenarios` rotalarının doğru listeler fırlattığı doğrulanacak.
4. **Panel Birim Testi (`ledgerService.test.ts`):** `fetchApi` mock edilerek `ledgerService` fonksiyonlarının doğru URL ve parametrelerle çalıştığı doğrulanacak.
5. **Test & Doğrulama:** `npm --prefix backend test` ve `npm --prefix panel test` çalıştırılarak regresyonsuz yeşil sonuç elde edilecek.

## 4. Kurallara Dayanak
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Paket 10 (Cari Defter, FIFO Fatura Dağıtımı ve Aging, Migration 26 `ledger_entries`, `fan_aging_migration_matrix`).

## 5. Açık Varsayımlar
- `VARSAYIM 1`: `server.js` üzerinde `/api/v2/ledger` altında `createLedgerRouter()` mount edilmiştir.

## 6. Riskler ve Rollback
- **Risk:** Feature flag kapalıyken 404 FEATURE_DISABLED dönmesi.
- **Rollback / Koruma:** Router seviyesinde `if (!enabled)` kontrolü korunur.
