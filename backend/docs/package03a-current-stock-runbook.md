# Paket 03A — Anlık Stok Runbook

`CURRENT_STOCK_V2_ENABLED=false` varsayılandır. Açıldığında yalnız bearer-auth v2 rotaları çalışır; service-role veya ham Storage URL tarayıcıya gönderilmez.

Akış: genel import başlatma (`CURRENT_STOCK_AVAILABLE`, `{ "warehouseCode": "DEFAULT_WAREHOUSE" }`) → byte/hash doğrulaması → `/imports/current-stock/{batchId}/parse` → validate → preview → publish. Publish isteği aktif import kimliğini, validation run kimliğini ve idempotency anahtarını taşır.

Yayın atomiktir: yeni set tümüyle hazırlanır; önceki aktif set ancak son adımda supersede edilir. Başarısız parse/validate/publish önceki aktif stok ve freshness zamanını değiştirmez. Superseded satırlar normal endpoint, AI veya export ile okunmaz.

Kaynak sözleşmesi yalnız `Malzeme numarası`, `Malzeme tanımı`, `Tahditsiz kullanılabilir` başlıklarıdır. Stok, sellout/KA/alış/transfer veya Ticari Stokla birleştirilmez. Pozitif missing-LPU satırları kaynak miktarını korur, ancak resmî litre toplamını eksik bırakır.
