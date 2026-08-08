# Paket 00 — Legacy bağımlılık haritası

**Durum:** Karakterizasyon envanteri; resmî hedef mimari veya yeni iş kuralı değildir.
**İnceleme tarihi:** 2026-08-05
**Kural:** Aşağıdaki akışlar yalnız regresyon ve geçiş kapsamını görünür kılar. Paket 00 bunları değiştirmez; yanlış formül veya kalıcılık davranışı yeni yapıya taşınmaz.

## Mevcut veri akışı

```text
Excel dosyası
  -> uploadService.readExcelFile / validateColumns / parseByType
  -> parser
  -> customerService.saveUploadedData
  -> archiveService (IndexedDB: dap_v1_idb)
  -> customerState belleği + customerService init/cache
  -> customerQueries / customerAnalytics / calculations
  -> sayfa, modal, AI araç sonucu veya export
```

`rawExcelCache` yalnız istemci belleğindeki geçici dosya satırlarını tutar. `archiveService` ise mevcut uygulamada IndexedDB `dap_v1_idb`, sürüm `7` ve `customers`, `satis`, `collections`, `purchase`, `credit_notes`, `cheques`, `upload_log`, `shipment_belgeler`, `shipment_siparisler`, `sellout_data` store'larını kullanır. Bu yapı Paket 00'da değiştirilmez ve hedefte resmî sistem kaydı kabul edilmez.

## Parser → kalıcılık → tüketici zinciri

| Mevcut kaynak türü | Parser / giriş | Mevcut kalıcılık ve durum | Mevcut tüketiciler | Hedef paket | Karakterizasyon notu |
|---|---|---|---|---|---|
| Müşteri master | `customerMasterParser.ts` → `uploadService.ts` | `archiveCustomers` → `customers`, `customerState.mockCustomers` | Dashboard, Cari, müşteri modalları, AI müşteri araması | 01, 02 | Tek müşteri/temporal organizasyon çözümü yoktur; yeni modele doğrudan taşınmaz. |
| Satış listesi | `salesParser.ts` → `uploadService.ts` | `archiveSalesInvoices` → `satis`, bellek satış listesi | Cari, Fatura Kontrol, dashboard, müşteri ekstreleri, AI | 01, 07, 10 | Mevcut `number`/iptal davranışı karakterizasyondur; aktif iptal kuralı Paket 07'dir. |
| Satın alma / iade / hizmet | `purchaseParser.ts` → `uploadService.ts` | `archivePurchaseInvoices` / `archiveCreditNotes` → `purchase` / `credit_notes` | Cari, finansal özet, AI | 01, 09, 10 | SATIN ALMA ile IADE/HIZMET ayrımı hedefte Paket 09'da yeniden kurulur. |
| Nakit / havale tahsilatı | `collectionParser.ts` → `uploadService.ts` | `archiveCollections` → `collections` | Cari, Fatura Kontrol, ödeme dağılımı, AI | 01, 08, 10 | Resmî olay, iptal ve idempotency hedefte Paket 08'dir. |
| Çek / senet | `chequeSenetParser.ts` → `uploadService.ts` | `archiveCheques` → `cheques` | Çek/Senet modalı, risk/AI | 01, 08 | Kabul, risk ve settlement ayrımı mevcut davranıştan alınmaz. |
| Belgeler | `shipmentBelgelerParser.ts` → `uploadService.ts` | `archiveShipmentBelgeler` önce store'u temizleyip yazar | Sevkiyat/Tahsilat bağlamı | 01A, 08A | Geçici snapshot ve resmî devralma Paket 01A/08A'da; mevcut clear+write resmî davranış değildir. |
| Sipariş / teslimat | `shipmentSiparisParser.ts` → `uploadService.ts` | `archiveShipmentSiparisler` önce store'u temizleyip yazar | `SevkiyatTakipPage`, Fatura Kontrol | 07A, 07B, 10A | Günlük snapshot, belge seviyesi ve handoff hedef kuralları ayrı paketlerdedir. |
| Sellout | `selloutParser.ts` → `uploadService.ts` | `archiveSelloutData` önce store'u temizleyip yazar | Sellout hedef ekranı, FKNS, AI | 04, 04B, 05, 06 | Ay bazlı tarihsel rapor ve net litre hedefte Paket 04/04B'dedir. |

## Hesap ve ekran bağımlılıkları

| Mevcut katman | Başlıca dosyalar | Doğrudan tüketici | Hedef ayrıştırma | Paket 00 kararı |
|---|---|---|---|---|
| Durum / başlatma | `customerState.ts`, `customerService.ts` | Bütün sayfalar ve AI | Yükleme-ham olay-resmî read model ayrımı | 01, 02, 10, 12A | Değiştirilmez. |
| Müşteri ve ekstre sorguları | `customerQueries.ts`, `customerService.ts` | Cari, müşteri modalları, AI registry | Customer 360, ledger ve invoice read model | 02, 10, 12A | Mevcut sonuçlar yalnız regresyon referansıdır. |
| Finansal / risk analitiği | `customerAnalytics.ts`, `calculations/cariCalculations.ts` | Dashboard, risk/temsilci sayfaları, AI | Sürümlü metrik/result envelope | 10, 12A–12D, 13 | Eski DSO/CEI/sağlık/risk formülleri yeni resmî formül değildir. |
| Sellout / FKNS | `calculations/selloutCalculations.ts`, `calculations/fknsCalculations.ts` | Sellout ekranı, temsilci ekranı, AI | Net litre, hedef ve FKNS motorları | 04, 05 | Mevcut sayıların eşitliği tek başına doğru kural kanıtı değildir. |
| İstemci dışa aktarımı | `utils/exportUtils.ts`, `utils/aiReportUtils.ts` | Modal, sohbet, rapor kartları | Tek snapshot/manifest artifact katmanı | 12E | Ekran/Excel/PDF için yeniden hesap yapılmayacak. |
| UI tüketicileri | `DashboardPage`, `CariPage`, `FaturaKontrolPage`, `SevkiyatTakipPage`, `SelloutHedefPage`, AI sayfaları/modalları | Kullanıcı ekranı | Paket bazlı v2 read API + 12E sunumu | İlgili domain paketi, 12E | Paket 00 UI davranışını değiştirmez. |

## Tespit edilen legacy sınırlar

| Davranış / kanıt | Etiket | Hedef paket | Neden yeni sisteme doğrudan taşınmaz |
|---|---|---|---|
| IndexedDB store sürümü ve istemci kalıcılığı | REVISE | 01, 15 | Ham kaynak, sürüm, RLS, audit ve atomik yayın için yetersizdir. |
| Doğal anahtarda upsert, `CANCELLED` ile fiziksel silme | REJECT | 01, 07, 08, 11 | Ham kaynak kaybı, aktif iptal zinciri ve tombstone/geri alma gereksinimiyle çelişir. |
| Belgeler/Sipariş/Sellout store'unu clear edip yazma | REVISE | 01A, 03A, 04, 06A, 07A | Hedefte kapsam çözümü, tam/kısmi snapshot, audit ve atomik aktif pointer gerekir. |
| Mevcut parser başlık tanıma ve kullanıcıya dönük hata akışı | KEEP | 00 karakterizasyon, ilgili domain paketi | Kullanıcı deneyimi/format güvenlik ağı olarak ölçülür; normalize sonuç kuralı değildir. |
| `number` tabanlı TL toplamları | REJECT | 00, 01+ | Yeni domain çekirdeğinde TRY minor-unit `bigint` ve API decimal-string sözleşmesi kullanılır. |
| `customerService` içindeki merkezi olmayan hesaplar | REVISE | 10, 12A–12D, 13 | Resmî hesap UI/AI/export arasında aynı sürümlü sonuçtan gelmelidir. |
| Doğrudan istemci export'unda hesap/sunum karışması | REJECT | 12E | Artifact yalnız yayımlanmış snapshot/manifest tüketmelidir. |

## Paket 00 kabul etkisi

Paket 00 yalnız `domain/shared`, merkezi kapalı `domain_v2_foundation` feature flag'i, anonim fixture politikası ve test/dokümantasyon katmanını ekler. `archiveService.ts`, parserlar, hesaplar, servisler, backend ve UI'da üretim importu eklenmez. Bu nedenle mevcut sonuçlar ve IndexedDB şeması aynı kalır.
