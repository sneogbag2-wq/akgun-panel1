# Paket 03 — Ürün modeli işletim notu

`PACKAGE_CONVERSION_HISTORY` yalnız ürün varyantı ilişki kanıtıdır; stok, Sellout, FKNS, hedef veya finansal olay yaratmaz. `product_catalog_v2` varsayılan olarak kapalıdır (`PRODUCT_CATALOG_V2_ENABLED !== 'true'`).

## Kaynak sözleşmesi

`paket.xlsx` içindeki zorunlu imza, aynı satırda şu rollerin kesin çözülmesini ister: `İşlem Tarihi`, `Bozulan/Birleştirilen Ürün Kodu`, onu hemen izleyen `Miktar`, `Oluşan Ürün Kodu` ve onu hemen izleyen `Miktar`. İlk malzeme belgesi yalnız provenance'dır. Dosya adı, ürün adı veya paket metni kimlik/aile/katsayı üretmez.

Kaynak kodları ve miktar lexeme'i korunur. Kod biçimsel olarak sayısal görünse bile JavaScript sayısına çevrilmez. Excel tarih seri değeri yalnız tarih rolünde çözümlenir. Negatif/sıfır miktar, self-edge, geçersiz tarih/kod ve aynı doğal anahtarda oran çatışması yayın blokajıdır.

## İşletim akışı

1. Paket 01 import başlatma ve hash doğrulaması yapılır.
2. `POST /api/v2/imports/package-conversions/{batchId}/parse` yalnız doğrulanmış dosyayı okur.
3. `validate`, parser kontrollerine ek olarak exact-rational graph kontrolünü backend'de çalıştırır ve `CONVERSION_RATIO_CONFLICT`, `MULTI_PATH_RATIO_CONFLICT` veya `CONVERSION_CYCLE_INCONSISTENT` sonucunu veritabanı validation run'ına blocking issue olarak iletir. Bu durumdaki batch yayınlanmaz.
4. `publish`, immutable ham gözlemi ve yönlü exact ratio edge'ini yazar. Aynı varyantların mevcut iki ailesini birleştirecek edge otomatik merge yapmaz, `FAMILY_MERGE_REVIEW` açar.
5. Litre anchor yoksa aile yine görünür, fakat litre coverage `PARTIAL_COVERAGE` ve `MISSING_LITRE_ANCHOR` olur. Hiçbir değer sıfırla doldurulmaz.

Manuel çözüm önce preview ister. `resolutionKind` yalnız `FAMILY_MEMBERSHIP`, `FAMILY_POLICY`, `NON_VOLUME` veya `LITRE_OVERRIDE` olabilir; kimlikler UUID, litre/ölçüler kanonik pozitif decimal metindir. `LITRE_OVERRIDE` kanıt dizisi ister. Geçmişe etkili karar `backdatedApproval=true` olmadan commit edilemez. Commit ham kanıtı değiştirmez; yalnız yeni temporal sürüm ve audit kaydı üretir. Revert de silme yapmaz, ileriye dönük yeni temporal sürümle eski karara döner. Bu paket Paket 04/05/06 etkin olmadan ekonomik sonuç hesaplamaz.

API cevaplarında bütün decimal'lar JSON stringidir ve kanoniktir: örneğin `20.000000` değil `"20"`, `5.250000` değil `"5.25"` döner.

## Yerel kabul kanıtı

`paket.xlsx` yalnız yerelde okunur: 331 işlem, 84 benzersiz ürün kodu, 59 yönlü ilişki ve 36 bağlı bileşen. Kaynak satırlar, ürün adları ve belge bilgileri fixture/Git/log/prompt'a alınmaz.

## Doğrulama

```powershell
node --test src/modules/products/__tests__/*.test.js
npm.cmd test
npx.cmd --yes supabase db reset --local
npx.cmd --yes supabase test db --local supabase/tests/package01_ingestion_foundation_test.sql supabase/tests/package02_customer_master_test.sql supabase/tests/package03_product_model_test.sql
```
