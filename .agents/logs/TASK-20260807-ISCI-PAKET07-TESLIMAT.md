# İşçi Ajan Kod Teslimatı: Paket 07 — Satış Faturası ve Aktif İptal Motoru

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
BAĞIMSIZLIK NOTU: Aynı oturum içinde farklı rol olarak çalışılıyor — rol ayrımı yalnızca prosedüreldir, bağlam düzeyinde değildir.
KURAL ÇELİŞKİSİ: Yok

## 1. Tamamlanan İlerleme
- **Frontend Servisi (`invoiceService.ts`):** `getSalesInvoicesList` typed API istemcisi (`/invoice`) oluşturuldu.
- **State Entegrasyonu (`customerService.ts`):** `customerState` nesnesindeki `salesInvoices` getter/setter ve `getSalesInvoicesStateSync()` mühürlendi.
- **Backend Rotası & Birim Testi (`invoiceRouter.test.js`):** `/invoice` rotasını test eden unit testler yazıldı; status 200 listeleme ve 404 FEATURE_DISABLED doğrulandı.
- **Panel Servis Birim Testi (`invoiceService.test.ts`):** `getSalesInvoicesList` servis çağrısının Vitest birim testi mühürlendi.

## 2. Çalıştırılan Komutlar ve Somut Kanıtlar
- **Backend Birim Testleri:** `npm --prefix backend test` -> **217/217 PASSED (%100 Başarı)**
- **Panel Birim Testleri:** `npm --prefix panel test` -> **186/186 PASSED (%100 Başarı)**

## 3. Onaylı Plan Uyum Beyanı
Teslimat, Denetçi tarafından onaylanan `TASK-20260807-ISCI-PAKET07-PLAN.md` planına birebir uyumludur.
