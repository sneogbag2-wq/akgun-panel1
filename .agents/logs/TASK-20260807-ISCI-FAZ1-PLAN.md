# İşçi Ajan Geliştirme Planı: Faz 1 - Router & Servis Entegrasyonları (Paket 00, 04, 07B, 10A, 12)

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
KURAL ÇELİŞKİSİ: Yok

## 1. Hedef
Paket 00 (Teknik Temel), Paket 04 (Sellout V2), Paket 07B (Sevkiyat Takip), Paket 10A (Teslim Edilmiş Fatura Kontrol) ve Paket 12 (Finansal Read Model) modüllerinin frontend (`panel/src/services/apiSyncService.ts`, `todayDispatchService.ts`, `deliveredInvoiceCheckService.ts`) ve backend (`backend/server.js`) servis/router bağlantılarını entegre edip mühürlemek.

## 2. Kapsam
- `panel/src/services/apiSyncService.ts`: Sevkiyat takip, fatura kontrol ve finansal read-model canlı API sync çağrılarını eklemek.
- `panel/src/services/todayDispatchService.ts`: `/api/v2/dispatch/today` backend router çağrısını entegre etmek.
- `panel/src/services/deliveredInvoiceCheckService.ts`: `/api/v2/ledger/delivered-invoice` backend router çağrısını entegre etmek.
- `backend/server.js`: V2 router ve feature flag fallback yapılarını koruyarak endpoint hazır durumunu garantilemek.

## 3. Yaklaşım
1. `todayDispatchService.ts` dosyasına backend `/dispatch/today` rotasını çağıran async handler fonksiyonu eklemek (try/catch fallback ile).
2. `deliveredInvoiceCheckService.ts` dosyasına backend `/ledger/delivered-invoice` rotasını çağıran async handler eklemek.
3. `apiSyncService.ts` fonksiyonuna sevkiyat, teslim edilen fatura ve finansal read-model verilerini backend'den çeken adımları dahil etmek.
4. Backend (200 test) ve Frontend (183 test) paketlerini çalıştırıp regresyon olmadığını kanıtlamak.

## 4. Kurallara Dayanak
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Paket 00, Paket 04, Paket 07B, Paket 10A, Paket 12 maddeleri.

## 5. Açık Varsayımlar
- `VARSAYIM 1`: Backend kapalı olduğu durumlarda (offline/test ortamı) frontend servisleri graceful try/catch ile IndexedDB/mock veriye düşer, çökmez.

## 6. Riskler ve Rollback
- Risk: Birim testlerinde async fetch hataları.
- Rollback: Eklenen API çağrıları `try/catch` blokları içinde izole edilecek; hata durumunda mevcut davranış aynen korunacaktır.
