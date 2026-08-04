# Cari Yönetimi — Aşama 1.2: Çekirdek Model Taslağı

**Durum:** Onaylandı; uygulama henüz yapılmadı.  
**Kapsam:** Cari Yönetimi için onaylanan kaynaklar.  
**Not:** Bu belge şema uygulamaz, veri taşımaz ve mevcut ekranları değiştirmez.

## 1. Modelin sınırı

Cari yönetimi yalnızca müşteri ilişkili finansal hareketleri, çek/senet
portföyünü ve müşteri-satış organizasyonu ilişkisini kapsar.

- `Cari Kodu 2` / `Cari Kodu2` olmayan işlem kayıtları zincir mağaza kabul
  edilir ve modelin dışında bırakılır.
- `Satın Alma` türü tedarikçi/Efes bağlamındadır ve dışarıda bırakılır.
- İşlem dosyalarındaki temsilci, tahsilatçı ve aktarım durumu alanları hedef
  modele alınmaz.
- Vade tarihi cari modelin parçası değildir.
- Çek/senet hem cari bakiyeyi azaltır hem açık portföy riski olarak izlenir.

## 2. Önerilen tablolar

| Tablo | Amaç | Kaynak |
|---|---|---|
| `customers` | Tekil müşteri kimliği ve güncel ticari görünüm | `export (9).xlsx` |
| `customer_assignments` | Müşteri–temsilci ve müşteri–saha satış müdürü ilişkisi | `export (9).xlsx` |
| `sales_invoices` | Cari borç oluşturan satış faturaları | Satış listesi |
| `customer_credit_events` | `HIZMET` ve `IADE` kaynaklı alacak düşüşleri | Satın alma listesi |
| `collections` | Nakit/kart ve banka tahsilatları | Nakit ve havale listeleri |
| `payment_instruments` | Çek ve senet portföyü, tahsil etkisi ve risk | Çek/senet listeleri |
| `source_raw_records` | Erişimi sınırlı ham kaynak arşivi | Tüm aktif kaynaklar |

`customer_balance_snapshot`, açık fatura listesi, yaşlandırma ve risk toplamı
kalıcı kaynak tablo değildir; bu olay tablolarından türetilen sorgu/görünümdür.

## 3. Ortak izlenebilirlik alanları

Her iş olayında aşağıdaki teknik alanlar yer alır.

| Alan | Tip | Kural |
|---|---|---|
| `id` | UUID | Sistem içi değişmez kimlik |
| `source_system` | enum | İlk değer: `SAPUI5_EXPORT` |
| `entry_origin` | enum | `IMPORT` veya `MANUAL`; hesaplama davranışını değiştirmez |
| `source_file_name` | text | Özgün Excel dosya adı |
| `source_row_number` | integer | Excel satırına geri dönüş |
| `source_record_id` | text | Kaynak belge/fatura/enstrüman numarası |
| `raw_payload_hash` | text | Aynı satırın tekrar yüklenmesini önleme |
| `imported_at` | timestamptz | Yükleme zamanı |

Manuel kayıtlarda `source_system = MANUAL_ENTRY` kullanılır; `imported_at`
yerine aynı alan oluşturulma zamanını temsil eder.

Dosya satırının tamamı yalnızca `source_raw_records` içinde saklanır. Bu arşiv
iş tablolarına telefon, vergi/kimlik veya açık adres kopyalamak için kullanılmaz.

## 4. Tablo sözleşmeleri

### 4.1 `customers`

| Alan | Tip | Kaynak / kural |
|---|---|---|
| `id` | UUID | Sistem içi anahtar |
| `external_customer_id` | text, unique | `Müşteri`; metin olarak saklanır |
| `legal_name` | text | `Müşteri Adı` |
| `display_name` | text, nullable | `Tabela Adı`; yoksa `legal_name` |
| `customer_status` | text | `Müşteri Durumu` |
| `sales_channel` | text, nullable | `Satış Kanalı Tanımı` |
| `customer_group` | text, nullable | `Müşteri Grubu Tanımı` |
| `volume_segment` | text, nullable | `Müşteri Hacim Segmenti` |
| `province`, `district` | text, nullable | İl/ilçe |
| `opened_on`, `closed_on` | date, nullable | Kaynaktan gerçek tarih olarak okunur |

Telefon, e-posta, vergi/TC numarası, vergi dairesi ve sevk adresi bu tabloya
alınmaz.

### 4.2 `customer_assignments`

| Alan | Tip | Kural |
|---|---|---|
| `customer_id` | UUID | `customers.id` |
| `assignment_role` | enum | `SALES_REP` veya `AREA_SALES_MANAGER` |
| `employee_name` | text | Yalnızca `export (9).xlsx` alanından |
| `effective_from`, `effective_to` | date | Ana veri geçerlilik dönemi; ilk yüklemede yükleme dönemi |

Kaynak alanları: `Satış Temsilcisi Adı` ve `Dist Satış Şefi Adı`. İşlem
Excel’lerindeki temsilci/tahsilatçı alanları kullanılmaz.

### 4.3 `sales_invoices`

| Alan | Tip | Kural |
|---|---|---|
| `invoice_number` | text | `Fatura No` |
| `invoice_date` | date | Kaynak tarih; arayüzde `DD/MM/YYYY` gösterilir |
| `customer_id` | UUID | `Cari Kodu 2` → `customers.external_customer_id` |
| `customer_name_at_event` | text, nullable | `Cari Adı` |
| `amount` | decimal(18,2) | `Satış Tutarı`; cari borç yönü `+` |
| `currency_code` | char(3) | Onaylı varsayım yoksa yükleme reddedilir; bu örnekte hedef `TRY` |
| `invoice_status` | text | `Fatura Durum`; `CANCELLED` bakiye hesabına girmez |
| `electronic_document_number` | text, nullable | `EDOCUMENTNO` |
| `order_number`, `delivery_note_number` | text, nullable | İzlenebilirlik için; cari hesaplamasında kullanılmaz |

`Vade Tarihi`, işlem temsilcisi, aktarım durumu ve kişisel veriler alınmaz.

### 4.4 `customer_credit_events`

| Alan | Tip | Kural |
|---|---|---|
| `document_number` | text | `Fatura No` |
| `event_date` | date | `Fatura Tarihi` |
| `customer_id` | UUID | `Cari Kodu2` ile bağlanır |
| `event_type` | enum | `SERVICE` (`HIZMET`) veya `RETURN` (`IADE`) |
| `amount` | decimal(18,2) | Cari alacak düşüş yönü `-` |
| `currency_code` | char(3) | Kaynakta doğrulanır; aksi durumda kayıt karantina kuyruğuna gider |
| `document_status` | text | `Fatura Durum` |

`Tip = SATIN ALMA` satırları bu tabloya yazılmaz; tedarikçi/Efes kapsamı
dışındadır.

### 4.5 `collections`

| Alan | Tip | Kural |
|---|---|---|
| `collection_document_number` | text | `Belge Numarası` |
| `collection_date` | date | Kaynakta `Fatura Tarihi` |
| `customer_id` | UUID | `Cari Kodu 2` ile bağlanır |
| `amount` | decimal(18,2) | Cari alacak düşüş yönü `-` |
| `currency_code` | char(3) | Belge ve işlem para birimi kontrol edilerek |
| `payment_method` | enum | `CASH_CARD` veya `BANK_TRANSFER` |
| `bank_code`, `bank_name` | text, nullable | Yalnızca havale |
| `cash_register_code` | text, nullable | Yalnızca nakit/kart |
| `description` | text, nullable | Kaynak açıklama |
| `balance_effect` | decimal(18,2) | Normal tahsilatta `-amount`; çek/senet ödeme havalesinde `0` |

`Aktarıldı`, `Aktarılamadı`, `Durum_`, temsilci ve tahsilatçı hedef modele
alınmaz.

### 4.6 `payment_instruments`

| Alan | Tip | Kural |
|---|---|---|
| `instrument_type` | enum | `CHEQUE` veya `PROMISSORY_NOTE` |
| `instrument_number` | text | `Çek No` veya `Senet No` |
| `source_document_number` | text | `Belge Numarası` |
| `received_on` | date | Kaynakta `Fatura Tarihi` |
| `customer_id` | UUID | `Cari Kodu 2` ile bağlanır |
| `amount` | decimal(18,2) | Cari alacak düşüş yönü `-` |
| `currency_code` | char(3) | Kaynak para birimi |
| `instrument_status` | text | Kaynak `Durum`; portföy/risk için kullanılır |
| `due_on` | date | Vade tarihi yalnızca enstrümanın kendi yaşam döngüsü içindir |
| `bank_name`, `bank_account_reference` | text, nullable | Kaynakta varsa |
| `note` | text, nullable | Açıklama |
| `settled_at` | timestamptz, nullable | Eşleşen havale ile ödendiği zaman |
| `settlement_collection_id` | UUID, nullable | Ödeme havalesi kaydı |

Çek/senet vadesi, fatura vadesi değildir; bu nedenle yalnızca burada tutulur.

### 4.7 Havale ile çek/senet ödeme eşleştirmesi

1. Bu eşleştirme havale dosyasından değil, kullanıcı tarafından sağlanacak ayrı
   eşleştirme Excel'inden yapılır. Havale açıklaması ve belge içeriği kaynak
   olarak kullanılmaz.
2. Yeni kaynakta gelen çek/senet numarası normalize edilerek
   `payment_instruments.instrument_number` ile eşleştirilir.
3. Tek ve aynı müşteriye ait enstrüman bulunursa ilgili havale
   `INSTRUMENT_SETTLEMENT` olarak işaretlenir; `collections.balance_effect = 0`
   olur, enstrüman `PAID` durumuna geçer, riskten çıkar ve havale kaydına bağlanır.
4. Ayrı eşleştirme kaynağında karşılığı olmayan havale normal banka tahsilatıdır;
   `balance_effect = -amount` ile cari bakiyeyi düşürür.
5. Birden fazla olası eşleşme, müşteri uyuşmazlığı veya tutar uyuşmazlığı varsa
   otomatik durum değişikliği yapılmaz; kayıt inceleme kuyruğuna alınır.

## 5. Hesaplama kuralları

Bir müşterinin cari bakiyesi aşağıdaki olayların toplamıdır:

```text
bakiye = aktif satış faturaları
        - HIZMET / IADE alacak düşüşleri
        - tahsilatların balance_effect toplamı
        - kabul edilmiş çek ve senet tutarları
```

Risk, bakiyeden bağımsız izlenir:

```text
çek_senet_riski = PAID olmayan aktif portföydeki çek ve senet tutarları toplamı
```

Bu iki değer çek/senet tutarının teslim alındığında bakiyeyi azaltmasını,
ödenene kadar da riskte kalmasını sağlar. Çek/senet numarası taşıyan havale,
yeni bir bakiye düşüşü yaratmadan yalnızca enstrümanın risk durumunu kapatır.

## 6. Tekillik ve yükleme kuralları

### 6.1 Ters işlem / mükerrer belge filtresi

Hedef tablolara dönüşümden **önce**, her işlem kaynağında aşağıdaki filtre
uygulanır:

1. Belge grubu yalnızca belge numarası ile oluşturulur; belge numarası tüm
   kaynaklar arasında küresel olarak tekildir. Satış ve alacak düşüşlerinde
   belge numarası `Fatura No`; nakit, havale, çek, senet ve kredi kartında
   `Belge Numarası`dır.
2. Grup içinde `Kayıt Tipi = CANCELLED` olan en az bir satır varsa, aynı belge
   numarasındaki bütün satırlar ters işlem kabul edilir.
3. Grubun tamamı `sales_invoices`, `customer_credit_events`, `collections`
   veya `payment_instruments` tablolarına yazılmaz; bakiye, risk ve raporlama
   hesaplarına girmez.
4. Bu satırlar ve ters kayıt karşılıkları arşivlenmez.

Farklı kaynaklarda aynı belge numarası yalnızca ters kayıt ilişkisinin bir
parçası olabilir; bağımsız iki finansal olay olarak yorumlanmaz.

### 6.2 Her yüklemede sürekli ters işlem taraması

Bu denetim yalnızca tek Excel dosyasının içindeki satırlara uygulanmaz. Her
yeni dosya yüklendiğinde işlem sırası şöyledir:

1. Yeni dosyanın belge numaraları mevcut tüm cari olay kayıtlarıyla karşılaştırılır.
2. Yeni dosyada `Kayıt Tipi = CANCELLED` olan belge numarası bulunursa, daha önce
   yüklenmiş olsa bile aynı numaralı hedef olay, arşiv kaydı ve varsa ters kayıt
   karşılığı silinir.
3. Aynı yüklemedeki eş kayıtlar da yazılmadan atılır.
4. Silme sonrasında bakiye, çek/senet riski, ekstre ve raporlama görünümleri
   tekrar hesaplanır.

Bu işlem idempotent olmalıdır: aynı `CANCELLED` satırının yeniden yüklenmesi
silinmiş belgeyi geri getirmez veya ek bir etki oluşturmaz.

| Olay | Önerilen iş anahtarı |
|---|---|
| Müşteri | `external_customer_id` + ana veri geçerlilik dönemi |
| Satış faturası | kaynak sistem + fatura no + müşteri anahtarı |
| Alacak düşüşü | kaynak sistem + fatura no + tür + müşteri anahtarı |
| Tahsilat | kaynak sistem + kaynak dosya türü + belge no + müşteri anahtarı |
| Çek/senet | enstrüman türü + enstrüman no + müşteri anahtarı |

Her kayıtta ayrıca `raw_payload_hash` tutulur. Aynı dosyanın tekrar yüklenmesi
yeni bir finansal olay yaratmaz.

## 7. Temsili örnek

Bu örnek gerçek müşteri veya tutar içermez.

```text
customers
  external_customer_id: "5000999999"
  legal_name: "ÖRNEK TİCARET A.Ş."

customer_assignments
  customer_id: "..."
  assignment_role: SALES_REP
  employee_name: "ÖRNEK TEMSİLCİ"

sales_invoices
  invoice_number: "SF-1001"
  invoice_date: 2026-08-03       # arayüz: 03/08/2026
  amount: 10_000.00 TRY          # bakiye etkisi: +10_000.00

customer_credit_events
  document_number: "IADE-20"
  event_type: RETURN
  amount: 1_000.00 TRY           # bakiye etkisi: -1_000.00

collections
  collection_document_number: "TH-500"
  payment_method: BANK_TRANSFER
  amount: 2_000.00 TRY           # bakiye etkisi: -2_000.00

payment_instruments
  instrument_type: CHEQUE
  instrument_number: "CK-77"
  amount: 3_000.00 TRY           # bakiye etkisi: -3_000.00
  due_on: 2026-08-12             # arayüz: 12/08/2026
  instrument_status: "Aktif"     # riskte: 3_000.00 TRY

Sonuç
  cari bakiye: 10_000 - 1_000 - 2_000 - 3_000 = 4_000.00 TRY
  çek/senet riski: 3_000.00 TRY
```
