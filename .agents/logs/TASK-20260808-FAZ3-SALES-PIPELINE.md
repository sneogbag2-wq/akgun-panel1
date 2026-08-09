# TASK-20260808-FAZ3-SALES-PIPELINE Log Kaydı

## Plan (İşçi Ajan - Versiyon 1)
- Hedef: SATIS dosya tipi için sales adıyla uçtan uca pipeline kurulması.
- Önerilen Migrasyon: `202608200000_54_sales_pipeline_faz3.sql`

## Denetim Kararı (Denetçi - Versiyon 1)
- **Tarih**: 2026-08-08
- **Karar**: REDDEDİLDİ
- **Gerekçeler**:
  1. Dayanak Belge Uyuşmazlığı: Bağlayıcı kural olarak `VERITABANI_YENIDEN_TASARIM_KARARLARI.md` referans alınmalıdır.
  2. Şema Uyuşmazlığı: `invoice_items` tablosu mevcut değildir; faturalar `public.invoices` tablosuna yazılır.
  3. Modül Adlandırması: Yeni `sales` modülü yerine mevcut `invoice` domain standardı (`backend/src/modules/invoice/`, `panel/src/services/invoiceImportService.ts`) kullanılmalıdır.
- **Düzeltme Talimatları**:
  1. Plana dayanak olarak `VERITABANI_YENIDEN_TASARIM_KARARLARI.md` ve `SISTEM_HESAPLAMA_MATRISI.md` belgelerini alın.
  2. `invoice_items` beklentisini kaldırıp, set-based staging yapısını `public.invoices` tablosuna hedefleyin.
  3. Modül ve servis adlandırmalarını `invoice` domain standardı ile uyumlu hale getirin.
