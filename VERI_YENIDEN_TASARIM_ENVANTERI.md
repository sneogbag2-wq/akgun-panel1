# Veri Yeniden Tasarım Envanteri

**Kapsam:** `EXCEL/` klasöründeki kaynak dosyalar incelenerek hazırlanmıştır. Bu belge mevcut uygulama, parser, ekran ve hesaplama kurallarından bağımsızdır; yeni veri modelinin başlangıç sözleşmesidir.

**İncelenen kaynak:** 10 Excel dosyası, toplam 26.492 satır.

## 1. Karar özeti

Yeni tasarım, dosya adlarına veya ekranlara göre değil, iş olaylarına göre kurulmalıdır:

1. **Müşteri** ayrı bir ana veri tablosu olmalıdır.
2. **Satış faturası**, **satın alma faturası**, **tahsilat**, **çek/senet**, **sipariş**, **sevkiyat belgesi** ve **sellout satırı** ayrı olay tabloları olmalıdır.
3. Müşteriyi bağlayan ana alan, tüm kaynaklarda normalize edilmiş metinsel `external_customer_id` olmalıdır. Kaynaklarda çoğunlukla dolu olan alan `Cari Kodu 2` / `Müşteri No` / `Müşteri`dir. Sayıya çevrilmemeli, baştaki sıfırlar korunmalıdır.
4. Para, tarih, kimlik ve durum alanları kaynak dosyadaki biçiminden ayrıştırılarak tipli saklanmalıdır. Örneğin `- 30,800.00 TRY` ile `7467` aynı `amount` + `currency` modeline dönüşmelidir.
5. Telefon, vergi/TC kimliği, e-posta ve açık adres analitik modele varsayılan olarak alınmamalıdır. Operasyonel ihtiyaç varsa erişimi sınırlı müşteri iletişim tablosunda tutulmalıdır.

## 2. İşaret efsanesi

| İşaret | Anlamı |
|---|---|
| **Zorunlu** | Kayıt geçerli sayılmak ve başka verilerle bağlanmak için gereklidir. |
| **Önerilen** | Raporlama, denetim veya operasyon için güçlü değer sağlar. |
| **Koşullu** | Sadece ilgili olay türünde veya modülde saklanmalıdır. |
| **Alma** | Hedef temel modele alınmamalıdır; gerekirse ham kaynak arşivinde kalır. |
| **Türetilir** | Kaynaktan doğrudan taşınmaz; dönüşüm katmanında hesaplanır. |

## 3. Kaynak envanteri ve kanıt

| Kaynak dosya | Satır | İş olayı | Yeni hedef tablo |
|---|---:|---|---|
| `export (9).xlsx` | 3.602 | Müşteri ana verisi | `customers`, `customer_assignments`, `customer_locations` |
| `Satış_(Veri_Yazma)_Listesi_03082026_232509.xlsx` | 4.423 | Satış faturası | `sales_invoices` |
| `Satın_Alma_(Veri_Yazma)_Listesi_03082026_232531.xlsx` | 1.325 | Satın alma faturası | `purchase_invoices` |
| `Nakit_Tahsilat_Listesi_03082026_232551.xlsx` | 3.815 | Nakit tahsilat | `collections` |
| `Havale_Tahsilatı_Listesi_03082026_232648.xlsx` | 396 | Havale tahsilatı | `collections` |
| `Çek_Tahsilatı_Listesi_03082026_232611.xlsx` | 25 | Çek tahsilatı | `payment_instruments` |
| `Senet_Tahsilatı_Listesi_03082026_232632.xlsx` | 8 | Senet tahsilatı | `payment_instruments` |
| `Belgeler (9).xlsx` | 106 | Genel tahsilat/belge hareketi | `collections` veya `document_events` |
| `export (10).xlsx` | 126 | Sipariş / teslimat planı | `sales_orders`, `shipments` |
| `Sellout Raporu (5).xlsx` | 12.666 | Ürün bazlı sellout | `sellout_lines` |

### Kritik profil bulguları

- Müşteri ana verisinde 3.602 satıra karşılık 1.819 farklı `Müşteri` değeri vardır. Tekilleştirme anahtarı ve geçerlilik tarihi politikası zorunludur.
- Satış kaynaklarında `Cari Kodu` büyük ölçüde boş, `Cari Kodu 2` ise %97 doludur. Tahsilatlarda da aynı desen vardır. Yeni modelde tek müşteri dış anahtarı kullanılmalıdır.
- `export (10)` içindeki siparişler için `İstenilen Tsl. Trh.` %100 doludur; sevkiyat planı için önemlidir. `Fatura No` %89 doludur ve sipariş aşamasında boş olabilir.
- Sellout kaynağında ürün, miktar, litre, net/brüt ve birden çok tarih alanı %100 doludur. Yeni performans modelinin en güçlü kaynağıdır.
- Kaynaklarda tamamen boş veya neredeyse boş alanlar bulunur: satışta `Depo Kodu`, `Vergi Toplamı`, `Toplam İndirim`, `İş Yeri`, `Fabrika`, `Bölüm`, `Ambar`, `Oluşturma Tarihi`; müşteri ana verisinde `Bölge Adı`; selloutta `Muhasebe Belgesi Tarihi` ve `Birim`.
- `Çek/Senet Fotoğrafı`, `Ters Kayıt Belge Numarası` ve `Ödeme Durumu` genel belgeler kaynağında bu örnekte tamamen boştur. Bunlar çekirdek model alanı olmamalıdır.

## 4. Hedef çekirdek model

### 4.1 Ortak teknik alanlar

Her hedef tabloda aşağıdaki alanlar bulunmalıdır.

| Alan | İşaret | Tip | Not |
|---|---|---|---|
| `id` | Zorunlu | UUID | Sistem içi, değişmeyen birincil anahtar. |
| `source_system` | Zorunlu | enum | Örn. `SAPUI5_EXPORT`. |
| `source_file_name` | Önerilen | text | İzlenebilirlik için. |
| `source_row_number` | Önerilen | integer | Kaynak satıra geri dönüş için. |
| `source_record_id` | Zorunlu | text | Kaynaktaki belge/fatura/olay kimliği. |
| `imported_at` | Zorunlu | timestamptz | Yükleme zamanı. |
| `record_status` | Zorunlu | enum | `ACTIVE`, `CANCELLED`, `REVERSED`, `FAILED`, `UNKNOWN`. |
| `raw_payload_hash` | Önerilen | text | Yinelenen yükleme ve denetim kontrolü. |

Ham Excel satırları gerekiyorsa ayrı, erişimi sınırlı `source_raw_records` arşivinde tutulmalıdır. İş tablolarına ham satır JSON'u veya kişisel veri kopyalanmamalıdır.

### 4.2 `customers`

| Hedef alan | İşaret | Kaynak karşılıkları | Tasarım kararı |
|---|---|---|---|
| `external_customer_id` | Zorunlu | `Müşteri`, `Müşteri No`, `Cari Kodu 2`, `Cari Kodu2` | Metin olarak normalize edilir; tüm olay tablolarının bağ anahtarıdır. |
| `legal_name` | Zorunlu | `Müşteri Adı`, `Cari Adı` | En güncel geçerli ana veri kaydından gelir. |
| `display_name` | Önerilen | `Tabela Adı` | Görsel kullanım için; yoksa `legal_name`. |
| `customer_status` | Zorunlu | `Müşteri Durumu` | Kaynak değeri kontrollü enum'a dönüştürülür. |
| `customer_group` | Önerilen | `Müşteri Grubu Tanımı`, `Müşteri Grubu Tnm.` | Tek kanonik sözlük. |
| `volume_segment` | Önerilen | `Müşteri Hacim Segmenti`, `Hacim Segmenti Tnm.` | Segment analizi için. |
| `sales_channel` | Önerilen | `Satış Kanalı Tanımı`, `Müşteri Kanalı Tnm.` | Birden fazla kaynakta tutarlı yönetsel filtre. |
| `opened_on` | Önerilen | `Açılış Tarihi` | ISO tarih. |
| `closed_on` | Koşullu | `Kapanış Tarihi` | Sadece kapanmış müşteri için. |
| `non_invoicing_reason` | Koşullu | `Fatura Kesmeme Nedeni` | Satış engeli / operasyon takibi için. |
| `transfer_reference` | Koşullu | `Devredilen Nokta` | Müşteri devir ilişkisinin serbest metni; ileride anahtar ilişkiye dönüştürülmeli. |

**Alma:** `Vergi No`, `TC Kimlik No`, `Telefon`, `E-posta adresi`, `Sevk Adresi`, `Vergi Dairesi`, `TAPDK No`. Bunlar analitik çekirdekten ayrılmalı; zorunlu operasyonel kullanım kanıtlanırsa `customer_contacts` veya `customer_compliance` altında erişim kontrollü tutulmalıdır.

### 4.3 `customer_assignments`

Müşteri ile saha/satış organizasyonu ilişkisi zaman boyutlu olmalıdır; müşteri tablosuna tek metin olarak gömülmemelidir.

| Hedef alan | İşaret | Kaynak karşılıkları |
|---|---|---|
| `customer_id` | Zorunlu | Normalize müşteri anahtarı |
| `assignment_role` | Zorunlu | `SALES_REP`, `SALES_MANAGER`, `AREA_MANAGER` |
| `employee_external_id` | Önerilen | Temsilci/şef kodu alanları |
| `employee_name` | Önerilen | `Satış Temsilcisi Adı`, `Dist Satış Şefi Adı`, `Satış Müdürü Adı` |
| `sales_region` | Önerilen | `Satış Tems. Bölgesi`, `Saha Satış Müdürü Bölgesi Tnm.` |
| `effective_from`, `effective_to` | Zorunlu | Yeni yükleme döneminden türetilir |

### 4.4 `customer_locations`

| Hedef alan | İşaret | Kaynak karşılıkları |
|---|---|---|
| `customer_id` | Zorunlu | Normalize müşteri anahtarı |
| `province` | Önerilen | `İl` |
| `district` | Önerilen | `İlçe` |
| `neighborhood` | Koşullu | `Mahalle` |
| `delivery_address` | Koşullu / hassas | `Sevk Adresi` |

İl kodu ile il adı karışık kaynaklarda ayrı sözlük tablosu (`geo_locations`) ile normalize edilmelidir.

### 4.5 `sales_invoices`

| Hedef alan | İşaret | Kaynak alanı |
|---|---|---|
| `invoice_number` | Zorunlu | `Fatura No` |
| `invoice_date` | Zorunlu | `Fatura Tarihi` |
| `customer_external_id` | Zorunlu | Öncelik: `Cari Kodu 2`, sonra `Cari Kodu` |
| `customer_name_at_event` | Önerilen | `Cari Adı` |
| `amount_net` | Zorunlu | `Satış Tutarı` |
| `currency_code` | Zorunlu | Kaynakta yoksa doğrulanmış dönüşüm varsayımı ile `TRY`; varsayım loglanır. |
| `due_date` | Önerilen | `Vade Tarihi` |
| `invoice_type` | Önerilen | `Tip`, `Fatura Tipi` |
| `invoice_status` | Zorunlu | `Durum`, `Fatura Durum` |
| `order_number` | Önerilen | `Sipariş Numarası` |
| `delivery_note_number` | Önerilen | `İrsaliye Numarası` |
| `electronic_document_number` | Önerilen | `EDOCUMENTNO` |
| `vehicle_plate` | Koşullu | `Plaka` |
| `driver_name` | Koşullu | `Sürücü` |
| `sales_rep_external_id` | Önerilen | `Satış Per. No` |

**Alma:** `Actions`, boş `Depo Kodu`, boş vergi/iskonto alanları ve kaynak içi teknik sütunlar. Vergi ile indirim gelecek yüklemelerde gerçekten dolacaksa sadece fatura tutar detay tablosuna eklenmelidir.

### 4.6 `purchase_invoices`

| Hedef alan | İşaret | Kaynak alanı |
|---|---|---|
| `invoice_number` | Zorunlu | `Fatura No` |
| `invoice_date` | Zorunlu | `Fatura Tarihi` |
| `supplier_external_id` | Zorunlu | Öncelik: `Cari Kodu2`, sonra `Cari Kodu` |
| `supplier_name_at_event` | Önerilen | `Cari Adı` |
| `amount_net` | Zorunlu | `Tutar` |
| `invoice_type` | Önerilen | `Tip`, `Fatura Tipi` |
| `invoice_status` | Zorunlu | `Durum`, `Fatura Durum` |
| `order_number` | Koşullu | `Sipariş No` |
| `delivery_note_number` | Koşullu | `İrsaliye No` |
| `electronic_document_number` | Önerilen | `EDOCUMENTNO` |

`Ux_New_DEALERId` ve bayi adına ait sabit değerler işlem tablosunda tekrarlanmamalı; bayilik/şirket bağlamı olarak ayrı tanımlanmalıdır.

### 4.7 `collections`

Nakit, havale ve genel belge kaynakları tek olay modelinde birleşmelidir.

| Hedef alan | İşaret | Kaynak alanları |
|---|---|---|
| `collection_document_number` | Zorunlu | `Belge Numarası` |
| `collection_date` | Zorunlu | `Fatura Tarihi` veya genel belgelerde `Tarih` |
| `customer_external_id` | Zorunlu | Öncelik: `Cari Kodu 2`, sonra `Cari Kodu`, genel belgelerde `Müşteri` |
| `amount` | Zorunlu | `Tutar` |
| `currency_code` | Zorunlu | `İşlem Para Birimi`, `Belge Para Birimi`; genel belge tutarındaki para kodu ayrıştırılır. |
| `payment_method` | Zorunlu | Dosya türü + genel belgelerde `Ödeme Tipi` |
| `bank_code` | Koşullu | `Banka Kodu` |
| `bank_name` | Koşullu | `Banka Adı`, `Banka` |
| `cash_register_code` | Koşullu | `Kasa Kodu` |
| `receipt_number` | Koşullu | `Makbuz No` |
| `collector_external_id` | Koşullu | `Tahsilatçı Kodu` |
| `collector_name` | Koşullu | `Tahsilatçı Adı Soyadı`, `Tahsilat Alan` |
| `sales_rep_external_id` | Önerilen | `Satış Temsilci No` |
| `description` | Koşullu | `Açıklama` |
| `collection_status` | Zorunlu | `Durum`, `Durum_`, `Kayıt Tipi`, `Belge Tipi` |

`Cari Kodu` tahsilat dosyalarında boş olduğundan asla zorunlu alan olarak tanımlanmamalıdır.

### 4.8 `payment_instruments` (çek ve senet)

Çek ve senet tahsilattan ayrı yaşar; tahsil edilme, iade, karşılıksız ve vade takibi için kendi yaşam döngüsüne sahip olmalıdır.

| Hedef alan | İşaret | Kaynak alanı |
|---|---|---|
| `instrument_type` | Zorunlu | Dosya türü: `CHEQUE` veya `PROMISSORY_NOTE` |
| `instrument_number` | Zorunlu | `Çek No`, `Senet No`, genel belgelerde `Çek Senet Numarası` |
| `source_document_number` | Zorunlu | `Belge Numarası` |
| `customer_external_id` | Zorunlu | `Cari Kodu 2` / `Müşteri` |
| `received_on` | Zorunlu | `Fatura Tarihi` / `Tarih` |
| `due_on` | Zorunlu | `Vade Tarihi` |
| `amount` | Zorunlu | `Tutar` |
| `currency_code` | Zorunlu | `İşlem Para Birimi` / `Belge Para Birimi` |
| `instrument_status` | Zorunlu | `Durum`, `Çek/Senet Statüsü`, `Kayıt Tipi` |
| `bank_name` | Koşullu | `Banka Adı`, `Banka` |
| `bank_account_reference` | Koşullu | `Çek Hesap No` |
| `note` | Koşullu | `Açıklama` |

**Alma:** Çek/senet fotoğrafını işlem tablosuna gömmek. Dosya bağlantısı gerekirse ayrı bir güvenli belge deposunda `document_attachments` ilişkisi kurulur.

### 4.9 `sales_orders` ve `shipments`

Sipariş ve teslimat tek tabloya sıkıştırılmamalıdır. Bir siparişin fatura ve sevkiyat durumları ayrı değişebilir.

| Hedef alan | Tablo | İşaret | Kaynak alanı |
|---|---|---|---|
| `order_number` | `sales_orders` | Zorunlu | `Satış Belge No` |
| `order_type` | `sales_orders` | Önerilen | `Satış Belge Türü Tnm.` |
| `order_date` | `sales_orders` | Zorunlu | `Satış Belgesi Tarihi` |
| `requested_delivery_date` | `sales_orders` | Zorunlu | `İstenilen Tsl. Trh.` |
| `customer_external_id` | `sales_orders` | Zorunlu | `Müşteri No` / `Fatura Alıcısı` |
| `order_amount` | `sales_orders` | Zorunlu | `Sipariş Toplam Tutar` |
| `order_status` | `sales_orders` | Zorunlu | `Red Statüsü Tnm.` |
| `load_number` | `shipments` | Koşullu | `Yükleme numarası` |
| `delivery_status` | `shipments` | Zorunlu | `Teslimat Durumu` |
| `invoice_number` | `shipments` | Koşullu | `Fatura No` |
| `sales_rep_name_at_event` | `sales_orders` | Önerilen | `Satış Temslicisi Adı` |

### 4.10 `sellout_lines`

Bu kaynak ürün hareketi seviyesindedir. Günlük/aylık performans ve ürün–kanal analizleri için satır seviyesi korunmalıdır.

| Hedef alan | İşaret | Kaynak alanı |
|---|---|---|
| `sellout_document_number` | Zorunlu | `Satış Belgesi` veya `Faturalama Belgesi` |
| `customer_external_id` | Zorunlu | `Müşteri No` |
| `product_external_id` | Zorunlu | `Malzeme Kodu` |
| `product_name_at_event` | Önerilen | `Malzeme Tnm.` |
| `sales_rep_name_at_event` | Önerilen | `Satış Temsilcisi Adı` |
| `sales_manager_name_at_event` | Önerilen | `Satış Müdürü Adı` |
| `invoice_date` | Zorunlu | `Faturalama Tarihi` |
| `delivery_date` | Önerilen | `Teslim Tarihi` |
| `order_date` | Önerilen | `Sipariş Tarihi` |
| `quantity` | Zorunlu | `Miktar` |
| `liters` | Zorunlu | `Litre` |
| `gross_amount` | Önerilen | `Brüt` |
| `discount_below_invoice` | Önerilen | `Fatura Altı` |
| `central_campaign_discount` | Önerilen | `Merkezi Kampanya` |
| `regional_campaign_discount` | Önerilen | `Bölgesel Kampanya` |
| `total_discount` | Önerilen | `Toplam İskonto` |
| `net_amount` | Zorunlu | `Net` |
| `customer_channel` | Önerilen | `Müşteri Kanalı Tnm.` |
| `customer_group` | Önerilen | `Müşteri Grubu Tnm.` |
| `volume_segment` | Önerilen | `Hacim Segmenti Tnm.` |
| `product_group` | Önerilen | `Mal Grubu Tnm.` |
| `accounting_status` | Önerilen | `Muhasebeleşme Durumu Tanımı` |

**Alma:** Boş `Birim`, boş `Muhasebe Belgesi Tarihi` ve değişmeyen bayi bilgileri. Satış organizasyonu/yönetim hiyerarşisi gerekiyorsa ayrı boyut/atama modeliyle saklanmalıdır.

## 5. Kanonik sözlükler ve normalize kuralları

| Konu | Kural |
|---|---|
| Müşteri anahtarı | `trim`, metin, baştaki sıfırları koru; kaynak alan önceliği tablo bazında tanımlı olmalı. |
| Para | `decimal(18,2)` + ISO `currency_code`; negatif işaret kaynak metninden doğru ayrıştırılır. |
| Tarih | Kaynak `m/d/yy` örnekleri belirsizlik yaratır; yükleme sırasında kaynak bölge ayarı açıkça tanımlanır ve `date` olarak saklanır. |
| Durum | Kaynak metni korunur (`source_status`); bunun yanında iş kuralları için kanonik enum üretilir. |
| Temsilci | Ad ve kod ayrı alanlardır; mümkünse kodla bağlanır, ad yalnızca olay anı görünümü olarak tutulur. |
| Bayi/şirket | Sabit bayi değerleri işlem satırlarında tekrarlanmamalı; `organizations` boyutuna taşınmalıdır. |
| Ürün | `Malzeme Kodu` metin anahtar, ürün adı olay anı açıklamasıdır. |
| Yinelenen kayıt | `source_system + source_file + source_record_id` ve `raw_payload_hash` ile idempotent yükleme yapılır. |

## 6. Veri kalitesi ve geçiş öncelikleri

### P0 — veri modeline geçmeden çözülmeli

1. **Tarih yorumu:** Kaynaklarda `8/3/26` biçimi kullanılmıştır. Gün/ay yorumunun hangi yerel ayara göre yapılacağı iş sahibi tarafından onaylanmalıdır.
2. **Müşteri eşleştirme:** `Cari Kodu`, `Cari Kodu 2`, `Cari Kodu2`, `Müşteri` ve `Müşteri No` için tek bir alan sözleşmesi ile çapraz eşleşme testi hazırlanmalıdır.
3. **Para işareti ve birimi:** Genel belgelerdeki negatif/biçimlendirilmiş tutarlar ile diğer dosyalardaki sayısal tutarlar ortak parse kuralından geçirilmelidir.

### P1 — ilk ürün sürümünde ele alınmalı

1. Müşteri ana verisindeki tekrarlar için `external_customer_id` + geçerlilik dönemi ile SCD/versiyonlama kararı.
2. Çek/senet yaşam döngüsü: alınma, vade, tahsil, iade, karşılıksız, iptal durumlarının resmi sözlüğü.
3. Satış faturası–sipariş–irsaliye–sellout belge bağlarının eşleştirme önceliği.
4. Tahsilatlarda belge numarası tekrarına karşı kaynak türü ile bileşik anahtar.

### P2 — ilk raporlama sonrası

1. Müşteri iletişim ve uyum verileri için ayrı erişim modeli.
2. Teslimat/araç/sürücü verisiyle lojistik performans modeli.
3. Kampanya ve iskonto bileşenleri için ürün satırlarıyla ayrıntılı kârlılık analizi.

## 7. Önerilen ilk yükleme sırası

1. `customers` ve müşteri–temsilci atamaları
2. Satış ve satın alma faturaları
3. Nakit/havale tahsilatları
4. Çek ve senetler
5. Siparişler ve sevkiyatlar
6. Sellout satırları
7. Mutabakat: müşteri anahtar kapsaması, belge tekilliği, tarih/para parse raporu

## 8. Yeniden tasarımda korunacak ilkeler

- Ekran için türetilmiş alanlar kaynak gerçekleriyle aynı tabloda tutulmaz.
- Her finansal olay kendi belge numarası, olay tarihi, tutarı, para birimi ve müşteri anahtarına sahip olur.
- Boş veya düşük doluluklu kaynak sütunu sırf gelecekte lazım olabilir diye çekirdek şemaya eklenmez.
- Kaynak sütun adı değişse bile kanonik alan adı değişmez; yalnızca yükleme eşlemesi güncellenir.
- Kişisel ve vergi verisi en az ayrıcalık ilkesiyle, analitik veri setinden ayrılır.

## 9. Sonraki tasarım kararı için bekleyen sorular

1. Tarih formatı kesin olarak ay/gün/yıl mı, gün/ay/yıl mı?
2. `Cari Kodu 2` / `Cari Kodu2` her kaynak için kurumsal müşteri anahtarı olarak onaylanıyor mu?
3. `Satış Tutarı`, `Tutar` ve sellout `Net` alanlarının KDV/iskonto kapsamı nasıl tanımlanacak?
4. Çek/senet kayıtları tahsilat hareketi mi, yoksa teminat/portföy varlığı mı olarak raporlanacak?
5. Müşteri ana verisindeki birden çok satır aynı müşterinin tarihsel versiyonu mu, yoksa birden fazla satış organizasyonu/ataması mı?

