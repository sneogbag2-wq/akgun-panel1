# İşçi Ajan Görev Teslimatı: STOK_METRIK_KATALOGU Hizalaması

**Görev Kimliği:** `TASK-20260807-STOK-KATALOG-HIZALAMA`  
**Tarih:** 2026-08-07  
**İşçi Ajan Planı ve Teslimat Raporu**  

## 1. Tamamlanan Değişiklikler Özeti

[STOK_METRIK_KATALOGU.md](file:///c:/Users/monds/Desktop/DED/test%20-%20Kopya/STOK_METRIK_KATALOGU.md) dosyasındaki tüm tespit edilen 6 eksiklik giderilmiş ve [SISTEM_HESAPLAMA_MATRISI.md](file:///c:/Users/monds/Desktop/DED/test%20-%20Kopya/SISTEM_HESAPLAMA_MATRISI.md) ile %100 birebir uyumlu hale getirilmiştir:

1. **`metric_id` ve `metric_version_id` Kod Hizalaması:**
   - Kataloğun tüm tablolarına (Bölüm 4–16) `metric_id` kolonu eklenmiş; `STK-001`..`STK-018`, `SS-001`..`SS-014`, `REQ-001`..`REQ-003`, `ORD-001`..`ORD-006`, `RISK-001`..`RISK-008`, `ACT-001`..`ACT-012`, `FCST-001`..`FCST-025`, `PRD-001`..`PRD-015` kodları tam izlenebilir kılınmıştır.

2. **Ticari Stok Metrik Kataloğu (`CUSTOMER_COMMERCIAL`) Eklenmesi:**
   - Kataloğa **Bölüm 10.1** altında `CST-001` ile `CST-013` arasındaki 13 Ticari Stok metriğini içeren bağımsız tablo eklenmiştir (`active_commercial_stock_import`, `natural_key`, `remaining_quantity`, `remaining_litres`, `ignored_source_measures`, `customer_commercial_stock`, `product_commercial_stock`, `responsibility_commercial_stock`, `concentration`, `inactive_customer_stock`, `coverage`, `regression_totals`, `warehouse_stock_exclusion`).

3. **Veri Yükleme ve Yayınlama Değişim Eşikleri:**
   - `STK-018` uyarınca stok yüklemesinde kod sayısında mutlak `%20+` veya bilinen litrede `%30+` sapma durumunda `current_stock_publish_delta_check` sürümlü uyarı kuralı ve `STK-006` `FULL_REPLACE` atomik ikame transaction kuralı metrik tablolarına işlenmiştir.

4. **Stok Tamlık Statüleri (`STK-016`, `STK-017`):**
   - Pozitif stoklu satırların tümü LPU/aile çözülmüşse `COMPLETE`, aksi halde `PARTIAL` olduğu ve eksik varyant varken resmî aile litresi `NULL/PARTIAL` döneceği kuralı metrik tablosuna eklenmiştir.

5. **Pasif ve Engellenmiş Metrik Grupları:**
   - Bölüm 11'e `INB-*`, `RES-*`, `LOT-*`, `SUP-*` gruplarının kod bazlı statü tablosu ve açılma koşulları işlenmiştir.

6. **Paket 12E-15 Sözleşme ve Tipli Sonuç Zarfları:**
   - Bölüm 19'a `STK`, `CST`, `FCST`, `SS`, `REQ`, `ORD`, `RISK` tipli 7 sonuç zarfı (result envelope) ve lifecycle kuralları açıkça eklenmiştir.

## 2. Kanıt

- Güncellenen dosya: [STOK_METRIK_KATALOGU.md](file:///c:/Users/monds/Desktop/DED/test%20-%20Kopya/STOK_METRIK_KATALOGU.md)
- Tüm metrik kodları, formülleri ve bağımlılıkları `SISTEM_HESAPLAMA_MATRISI.md` ile birebir eşleşmektedir.
