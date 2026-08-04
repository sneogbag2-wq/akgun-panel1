# Cari Yönetimi — Aşama 1.3: Hesaplama ve Ekran Etkisi

**Durum:** Taslak; uygulama onayı bekliyor.  
**Ön koşul:** Aşama 1.2 çekirdek model onaylandı.  
**Bu belge:** Hesaplama ve ekran geçiş tasarımıdır; kod veya veri değişikliği değildir.

## 1. Tek hesaplama kaynağı

Cari ekranları, dashboard, fatura kontrol, sevkiyat takibi ve AI aynı türetilmiş
görünümleri kullanmalıdır. Ekranların her biri kendi içinde satış/tahsilat
toplamı veya risk hesabı yapmaz.

| Görünüm | İçerik | Türetildiği kaynak |
|---|---|---|
| `customer_financial_position` | Cari bakiye, açık fatura toplamı, çek/senet riski | Olay tabloları |
| `customer_statement_lines` | Tarih sıralı ekstre hareketleri | Satış, alacak düşüşü, tahsilat ve çek/senet |
| `customer_open_invoices` | FIFO sonrası açık fatura tutarları | Satış faturaları ve bakiye düşürücü olaylar |
| `customer_aging` | Fatura yaşına göre açık bakiye dağılımı | `customer_open_invoices` |
| `customer_instrument_risk` | Açık çek/senetlerin detay ve toplamı | `payment_instruments` |

Bu görünümler sadece `CANCELLED` filtresinden geçmiş, kapsam içi müşteri
anahtarına bağlı kayıtları kullanır.

## 2. Bakiye ve risk kuralları

### 2.1 Cari bakiye

```text
cari_bakiye = aktif satış faturaları
            - HIZMET / IADE alacak düşüşleri
            - tahsilatların balance_effect toplamı
            - kabul edilmiş çek/senet tutarları
```

- Normal nakit/kart/havale tahsilatının `balance_effect` değeri `-tutar`dır.
- Çek veya senet teslim alındığında tutar bakiye düşüşüdür.
- Çek hesabı + müşteri + tutar ile tekil eşleşen bir havale, ilgili enstrümanı
  `PAID` yapar ve havalenin `balance_effect` değeri `0` olur. Böylece aynı
  tutar ikinci kez düşmez.
- HIZMET ve IADE, alacak düşüşüdür. SATIN ALMA tedarikçi/Efes kapsamındadır ve
  hesaplamaya girmez.
- `Cari Kodu 2` / `Cari Kodu2` olmayan zincir mağaza kayıtları hesaplamaya
  girmez.

### 2.2 Çek/senet riski

```text
çek_senet_riski = PAID olmayan aktif çek ve senetlerin toplamı
```

Çek/senetin bakiyeyi azaltması ile riskte görünmesi iki ayrı kavramdır. Havale
ile ödeme eşleştiğinde bakiye değişmez; yalnızca açık risk azalır.

### 2.3 Ters işlem taraması

Her dosya yüklemesinde, mevcut veri ve gelen veri küresel belge numarasıyla
taranır. Bir `Kayıt Tipi = CANCELLED` kaydı bulunduğunda aynı belge numarasının
tüm karşılıkları silinir; bakiye, açık faturalar, yaşlandırma ve risk yeniden
hesaplanır.

## 3. Ekstre, açık fatura ve yaşlandırma

### Ekstre

Ekstre satırı; olay tarihi, belge numarası, olay türü, borç, alacak, net etki
ve hareket sonrası koşan bakiye içerir.

| Olay | Borç | Alacak | Bakiye etkisi |
|---|---:|---:|---:|
| Satış faturası | Tutar | 0 | +Tutar |
| HIZMET / IADE | 0 | Tutar | -Tutar |
| Nakit/kart/havale tahsilatı | 0 | Tutar | -Tutar |
| Çek/senet teslim alımı | 0 | Tutar | -Tutar |
| Çek/senet ödeme havalesi | 0 | 0 | 0 |

Çek/senet ödeme havalesi ekstrede “çek/senet ödeme eşleşmesi” olarak
gösterilebilir; fakat bakiye sütununu değiştirmez.

### Açık faturalar ve yaşlandırma

Fatura vadesi kapsam dışıdır. Bu nedenle açık fatura dağıtımı, satış faturası
tarihi esaslı FIFO ile yapılır:

1. Bakiye düşürücü olaylar en eski satış faturasından başlayarak mahsup edilir.
2. Kalan tutar, o faturanın açık tutarıdır.
3. Yaşlandırma fatura tarihine göre hesaplanır: 0–30, 31–60, 61–90, 91–120 ve
   120+ gün.

Ekran metinleri “vade aşımı” yerine “fatura yaşı” veya “X günden eski açık
bakiye” demelidir; çünkü fatura vade tarihi kullanılmayacaktır.

Fatura yaşındaki gün sayısı, fatura tarihinden referans tarihe kadar geçen gün
sayısıdır. Yaşlandırma dilimleri ve vade/risk eşikleri bu değeri kullanır.

## 4. Ekran geçiş etkisi

| Alan | Yeni veri kaynağı | Değişiklik |
|---|---|---|
| Cari listesi ve müşteri detayı | `customer_financial_position`, `customers`, `customer_assignments` | Müşteri temsilcisi yalnızca ana veriden gelir; bakiye/risk tek görünümden okunur. |
| Cari ekstresi | `customer_statement_lines` | İşlem türleri ayrışır; çek/senet ödeme havalesinin çift düşmesi engellenir. |
| Açık faturalar | `customer_open_invoices` | Fatura vadesi kaldırılır; fatura yaşı kullanılır. |
| Çek/senet paneli | `customer_instrument_risk` | `PAID` enstrümanlar risk toplamından çıkar ve varsayılan listede gizlenir; geçmiş filtresiyle gösterilir. |
| Dashboard | `customer_financial_position`, `customer_aging` | Toplam alacak, risk, yaş dağılımı ve temsilci kırılımı tek kaynaktan gelir. |
| Fatura Kontrol | Satış faturaları + `collections.balance_effect` | Çek/senet ödeme havalesi tahsilat gibi ikinci kez görünmez. |
| Sevkiyat Takip | `customer_financial_position` + `customer_instrument_risk` | Sevkiyat kararı için cari borç ve açık risk net ayrılır. |
| AI risk/temsilci/lojistik | Aynı türetilmiş görünümler | AI araçları ekranlardan bağımsız, aynı finansal gerçekliği sorgular. |

## 5. Mevcut uygulamadan kaldırılacak hesaplama davranışları

- Fatura vade tarihine bağlı yaşlandırma/etiketleme.
- İşlem Excel’lerindeki temsilci veya tahsilatçı bilgisinden müşteri ataması.
- Aktarım durumu (`Aktarıldı`, `Aktarılamadı`, `Durum_`) ile finansal dahil
  etme/dışlama.
- Sadece tek dosya içindeki `CANCELLED` satırlarını kontrol etme.
- Çek/senet ödeme havalesini normal tahsilat gibi ikinci kez bakiyeden düşme.

## 6. Manuel işlem yönetimi

Manuel girilen işlemler aktarılmış işlemlerden **finansal olarak farklı
değildir**: aynı bakiye, ekstre, açık fatura, fatura yaşı ve risk hesaplarına
aynı anda girer. Ayırım yalnızca denetim içindir.

| Manuel işlem | Hedef olay | Cari etkisi |
|---|---|---:|
| Manuel satış faturası | `sales_invoices` | +Tutar |
| Manuel satın alma faturası | `customer_credit_events` | -Tutar |
| Manuel tahsilat | `collections` | -Tutar |
| Manuel çek/senet | `payment_instruments` | -Tutar ve açık risk |
| Virman | Birbiriyle bağlı iki ekstre satırı | Kaynak cari `-Tutar`, hedef cari `+Tutar` |

Manuel olaylarda `source_system = MANUAL_ENTRY` ve `entry_origin = MANUAL`
işareti tutulur. Bu işaretler hesaplama filtresi değildir; yalnızca işlemi
oluşturan, düzenleyen veya silen kullanıcı ile zaman bilgisinin denetlenmesi
içindir. Manuel belge numaraları da küresel belge tekilliği kuralına uyar.

Manuel düzenleme ve silme yalnızca manuel oluşturulmuş kayıtlarda yapılır.
Bir değişiklik veya silme sonrasında ilgili iki müşteri (virmanda her ikisi),
bakiyeler, ekstre, açık fatura, fatura yaşı ve risk özetleri yeniden hesaplanır.

## 7. Kabul senaryoları

| Senaryo | Beklenen sonuç |
|---|---|
| 10.000 satış, 2.000 nakit tahsilat | Bakiye 8.000 |
| 10.000 satış, 1.000 HIZMET, 500 IADE | Bakiye 8.500 |
| 10.000 satış, 3.000 çek | Bakiye 7.000; çek/senet riski 3.000 |
| Önceki çeke tekil eşleşen 3.000 havale | Bakiye 7.000 kalır; çek/senet riski 0 |
| Çek hesap no eşleşmesi birden fazla aday üretir | Hiçbir çek `PAID` olmaz; inceleme kuyruğu oluşur |
| Sonradan aynı belge numarasıyla `CANCELLED` gelir | Önceden yüklenmiş belge silinir; tüm özetler yeniden hesaplanır |
| `Cari Kodu 2` boş satış kaydı | Cari modeli ve özetleri etkilemez |
| SATIN ALMA türünde satın alma kaydı | Cari modeli ve özetleri etkilemez |
| Manuel satış faturası | Aktarılan satış faturasıyla aynı şekilde bakiyeyi artırır |
| Manuel satın alma faturası | Aktarılan HIZMET/IADE ile aynı şekilde bakiyeyi azaltır |
| Manuel tahsilat | Aktarılan tahsilatla aynı şekilde bakiyeyi azaltır |
| 2 cari arasında 1.000 virman | Kaynak cari -1.000, hedef cari +1.000; iki satır aynı virman kimliğiyle bağlıdır |

## 8. Onay durumu

- Fatura yaşı etiketi ve fatura tarihi bazlı yaşlandırma: **onaylandı**.
- `PAID` çek/senetlerin varsayılan listede gizlenmesi: **onaylandı**.
- Manuel satış, satın alma, tahsilat, çek/senet ve virman işlemlerinin; ekleme,
  düzenleme ve silme ile yönetilmesi: **onaylandı**.
