# Tam Kapsamlı Stok, Talep ve Sipariş Metrik Kataloğu

**Durum:** Resmi Sözleşme Uyumlu — `SISTEM_HESAPLAMA_MATRISI.md` ile %100 Hizalanmış  
**Son Güncelleme:** 2026-08-07  
**Bağlı karar kaydı:** `VERITABANI_YENIDEN_TASARIM_KARARLARI.md`  
**Makinece uygulanabilir merkezi matris:** `SISTEM_HESAPLAMA_MATRISI.md`  

---

## 1. Tasarım ilkeleri

- Hesap seviyesi `ürün ailesi × kanal × gün`dür. Paket varyantları fiziksel litreye çevrilerek ürün ailesinde toplanır.
- Geleneksel Sellout ve KA talebi ayrı hesaplanır, ürün ailesi toplamında birleştirilir.
- Geleneksel dönem tarihi `Faturalama Tarihi`, KA dönem tarihi satırdaki `Yükleme Tarihi`dir.
- İadeler işaretli hareket olarak korunur. Sellout negatif satırı fiziksel stok girişi sayılmaz.
- Hesaplamalar bir `as_of_date` kesim tarihiyle çalışır. Sonradan gelen veri eski sonucu sessizce değiştirmez; yeniden hesaplama yeni sürüm/snapshot üretir.
- Her metrik için üç bağımsız ayar tutulur: `calculation_enabled`, `decision_enabled`, `visibility_enabled`.
- Bir metrik kapatıldığında ona bağlı formüller için bağımlılık uyarısı üretilir. Eksik veri sessizce sıfır sayılmaz.
- AI, aktif formülü, kullanılan kaynakları, kesim tarihini, metrik/model sürümünü ve veri kalite uyarılarını açıklayabilir.
- Stok, ihtiyaç, sipariş ve risk raporları ortak `AI Odak Analiz` alanına tipli `focus_context/focus_digest` sağlar. Alan yalnız yayımlanmış stok/talep/coverage sonuçlarını yorumlar; stok hareketi, sipariş miktarı veya neden uydurmaz. Liste açılışında satır başına model çağrısı yapılmaz; tam anlatı kullanıcı açışı veya rapor snapshot'ında Paket 14 tarafından, ortak Paket 12E gösterim sözleşmesiyle üretilir.
- Paket 12E stok raporlarında da tek `report_snapshot/result_manifest` kullanır: HTML, PDF, XLSX, PNG/SVG ve AI aynı stok metric result ids/exact litre-koli-miktar/coverage değerlerini taşır. Chart/widget yeni stok hesabı yapamaz; filter hash scope/as-of/source kind'i pinler, drill-down allowlist ve RLS ile çalışır. `WAREHOUSE_CURRENT` ile `CUSTOMER_COMMERCIAL`, gerçek `0` ile `MISSING/PARTIAL`, gerçekleşen stok ile tahmin/sipariş önerisi bütün formatlarda ayrı etiketlenir.
- Paket 12F aksiyon günlüğü stok/sipariş önerisinin gösterilmesini veya kullanıcı incelemesini kaydedebilse bile stok düşüşünü, sipariş verilmesini, Sellout artışını ya da servis seviyesini otomatik olarak öneriye/AI'ye atfedemez. Stok domain'i için ayrı prospective outcome ve randomize deney politikası onaylanmadan `FAN-024/047..060` finansal tahsilat sonuçları stok başarısı diye yeniden kullanılamaz.
- Onaylı aktif stok politikası tek güncel küme bazlıdır: kullanıcı Malzemeler kullanılabilir stok dosyasını yükler; başarılı yükleme önceki aktif stok satırlarının tamamının yerini alır (`STK-006` `FULL_REPLACE`). Önceki değerlerden günlük stok geçmişi tutulmaz; sistem Sellout/KA'dan gerçek stok düşmez ve alış/depo girişinden gerçek stok artırmaz.
- Ticari Stok ayrı bir müşteride kalan ürün kaynağıdır; bayi depo stoğuna, stok gününe veya sipariş ihtiyacına girmez (`CST-013`). Yalnız `Depoda Kalan Mk.` ve `Depoda Kalan Lt.` ölçüleri kullanılır (`CST-003`, `CST-004`).

---

## 2. Temel boyutlar ve kayıt seviyesi

| Boyut | Açıklama |
|---|---|
| `product_family_id` | Fiziksel olarak aynı ürünün ortak kimliği; malzeme kodu değildir. |
| `product_variant_id` | 6'lı, 12'li, koli, tek şişe/kutu gibi paket varyantı. |
| `channel_id` | En az `Geleneksel` ve `KA`; talep geçmişleri ayrı tutulur. |
| `customer_id` | Birebir korunan `500...` müşteri kodu. KA talebinde müşteri mevcutsa ayrıca tutulur ancak FKNS'ye girmez. |
| `sales_rep_id`, `ssm_id` | Geçerlilik tarihli organizasyon bağlantıları. |
| `warehouse_id` | Tek depo olsa dahi stok kaynağını ve ilerideki hareketleri açık tutar. Varsayılan tek kayıt olabilir. |
| `supplier_route_id` | Tedarik süresi ve sipariş politikasının kaynağı; veri sağlanırsa kullanılır. |
| `date_id` | Takvim, iş günü, tatil, kampanya ve dönem karşılaştırma boyutu. |
| `metric_version_id` | Formül, parametre ve etkinlik durumunun sürümü. |

---

## 3. Ortak gösterim ve semboller

- `p`: ürün ailesi
- `v`: paket varyantı
- `c`: kanal
- `d`: gün
- `t`: kesim tarihi
- `H`: planlama ufku
- `L`: tedarik süresi, gün
- `P`: sipariş gözden geçirme periyodu, gün
- `q(v)`: varyant miktarı
- `lpu(v)`: varyant başına fiziksel litre
- `D̂(p,c,d)`: tahmini günlük net talep
- `SS(p)`: aktif güvenlik stoğu
- `IP(p)`: stok pozisyonu

---

## 4. Kaynak ve veri kalitesi metrikleri

| `metric_id` | Metrik | Formül / kural | Karar / Yayın etkisi |
|---|---|---|---|
| `STK-002` | Aktif stok yükleme yaşı | `t - current_stock_loaded_at` | Eski stokla net sipariş önerisi güveni düşer; sürümlü uyarı üretir. |
| `STK-017` | Stok tamlık statüsü | Pozitif stoklu satırların LPU/aile çözümü | `COMPLETE` değilse resmî toplam `NULL/PARTIAL` döner, eksik kısım 0 sayılamaz. |
| `STK-018` | Yayın delta kontrolü | Kod sayısı mutlak `%20+` veya litre `%30+` sapma | Sürümlü yayın uyarısı (`current_stock_publish_delta_check`) üretir. |
| `DQ-STK-001` | Dönüşüm kapsamı | `litre katsayısı doğrulanan stok kodu / toplam stok kodu` | Eksik varyantlar aile stok toplamını eksik gösterebilir. |
| `DQ-STK-002` | Sınıflandırılamayan hareket | Ürün ailesine veya işlem türüne bağlanamayan litre/miktar | Resmi KPI yanında ayrı veri kalite metriği. |
| `DQ-STK-003` | Mükerrer kayıt | Doğal anahtar üzerinde tekrar sayısı | Onaylı mükerrer politikası uygulanmadan hesaba girmez. |
| `DQ-STK-004` | Geç tarih / gelecek tarih | Kesim tarihi dışında kalan işlem sayısı ve litresi | Dönem hatası uyarısı. |
| `DQ-STK-005` | Eksik gün kapsamı | Beklenen günlerden kaynak verisi bulunmayan gün sayısı | `0 satış` ile `veri yok` ayrılır (`MISSING/PARTIAL`). |
| `DQ-STK-006` | Aile eşleme güveni | `doğrulandı / manuel / aday / eşleşmedi` | `aday` eşleşme resmi stok toplamına girmez. |
| `DQ-STK-007` | Tahmin veri yeterliliği | Geçmiş gün/ay, pozitif satış günü ve aktif dönem sayısı | Tahmin yöntemi ve geri düşme seviyesini belirler. |

---

## 5. Paket ve litre dönüşüm metrikleri

| `metric_id` | Metrik | Formül / kural |
|---|---|---|
| `PRD-001` | Varyant litre katsayısı | Öncelikle aynı kodun geçerli pozitif Sellout satırlarından `Σ Litre / Σ Miktar`; tarihçeli `litres_per_stock_unit` |
| `PRD-002` | Stok miktar birimi | `quantity_uom`; yüklenen miktarın şişe/adet/koli gibi fiziksel anlamı |
| `PRD-003` | Koli içi adet | `units_per_case` |
| `PRD-004` | Birim hacmi | `unit_volume_ml` |
| `PRD-005` | Hacim izleme işareti | `volume_tracked`; CO2/depozito gibi hacim dışı kalemleri ayırır |
| `PRD-006` | Dönüşüm kaynağı ve durumu | `sellout_verified`, `ka_verified`, `cross_source_verified`, `unit_inconsistent`, `derived_pending`, `manual_approved`, `non_volume`, `missing` |
| `STK-003` | Varyant kullanılabilir litresi | `q(v) × lpu(v)` (Tahditsiz kullanılabilir miktar × katsayı) |
| `STK-004` | Aile kullanılabilir litresi | `Σ varyant stok litresi` (Doğrulanmış varyantların toplamı) |
| `PRD-007` | Dönüşüm / Yuvarlama farkı | `gözlenen litre/miktar - master lpu(v)` ve kaynak-kanonik litre farkı |
| `PRD-008` | İkmal varyantı | Siparişte kullanılacak varsayılan varyant; tarihçeli ve kullanıcı değiştirilebilir. |
| `PRD-009` | Paket eşdeğeri | `aile litresi / lpu(seçilen varyant)` |
| `PRD-010` | Gösterim koli katsayısı | Onaylı ikmal/gösterim varyantının bir kolisinin fiziksel litresi |
| `PRD-011` | Kesin eşdeğer stok kolisi | `aile kullanılabilir stok litresi / gösterim varyantı litre-koli katsayısı` |
| `PRD-012` | Varyant stok kırılımı | Her gerçek varyant için kaynak miktarı/koli, litre katsayısı ve litre katkısı |
| `PRD-013` | Ana stok kodu | Ürün ailesinde açıkça tanımlanan tarihçeli `canonical_stock_variant_id` |
| `PRD-014` | Ana kod koli eşdeğeri | `toplam aile stok litresi / ana stok kodu litre-koli katsayısı` |
| `PRD-015` | Stok-gün gösterim kolisi | `round(ana kod kesin koli eşdeğeri)`; yalnızca UI gösterimi içindir |

---

## 6. Gerçekleşen talep metrikleri

Her kanal ayrı hesaplanır; ürün ailesi toplamı kanal sonuçlarının toplamıdır.

| `metric_id` | Metrik | Formül / kural |
|---|---|---|
| `ACT-001` | Brüt satış litresi | Geçerli pozitif ürün satış litreleri toplamı |
| `ACT-002` | İade litresi | Geçerli ürün iadelerinin mutlak litre toplamı (`Σ abs(litre)`) |
| `ACT-003` | İptal / Ters kayıt etkisi | `EVT-004` onaylı belge çiftleri üzerinden satışa net etkisi |
| `ACT-004` | Net satış litresi | `brüt satış - iade - geçerli ters kayıt etkisi` |
| `ACT-005` | İade oranı | `iade litresi / brüt satış litresi` |
| `ACT-006` | Benzersiz belge | `count(distinct document_event_id)` geçerli satış belgeleri |
| `ACT-007` | Benzersiz müşteri | Gelenekselde ürünü alan benzersiz aktif müşteri (`count(distinct customer_id)`) |
| `ACT-008` | Fatura başına litre | `net satış litresi / benzersiz geçerli belge` |
| `ACT-009` | Müşteri başına litre | `Geleneksel net satış litresi / benzersiz alan müşteri` |
| `ACT-010` | Kanal katkısı | `kanal net litresi / aile toplam net litresi` |
| `ACT-011` | Segment katkısı | `seçili müşteri segmenti net litresi / uygun toplam net litre` |
| `ACT-012` | Sınıflandırılamayan negatif | Sınıflandırılamayan negatif/iade hareket litresi toplamı |

---

## 7. Hedef ve cari dönem metrikleri

| `metric_id` | Metrik | Formül / kural |
|---|---|---|
| `FCST-001` | Kanal litre hedefi | Gelenekselde temsilci Açık+Kapalı hedeflerinin toplamı; KA kendi hedefi |
| `FCST-002` | Cari gerçekleşme | Kesim tarihine kadar kanal net satış litresi (`ACT-004`) |
| `FCST-003` | Hedef gerçekleşme | `cari gerçekleşme / kanal hedefi` |
| `FCST-004` | Kanal kalan hedefi | `max(0, kanal hedefi - cari gerçekleşme)` |
| `FCST-005` | Tarihsel aile payı | Ailenin kanal içindeki robust/ağırlıklı talebi ÷ kanal toplamı |
| `FCST-006` | Hedef bazlı aile kalan talebi | `kanal kalan hedefi × tarihsel aile payı` |
| `FCST-007` | Dinamik aile kalan talebi | `dinamik ay sonu aile tahmini - cari aile gerçekleşmesi`, alt sınır `0` |
| `FCST-008` | Etkin aile kalan talebi | `max(hedef bazlı kalan, dinamik kalan)` |
| `FCST-009` | Hedef üstü ek talep | `max(0, dinamik kalan - hedef bazlı kalan)` |
| `FCST-010` | Birleşik etkin kalan talep | `Σ kanal etkin aile kalan talebi` |
| `REQ-002` | Hedef için brüt stok gereksinimi | `birleşik etkin kalan talep + aktif güvenlik stoğu + onaylı ek koruma` |

---

## 8. Tarihsel taban ve talep tahmini metrikleri

| `metric_id` | Metrik | Formül / kural |
|---|---|---|
| `FCST-011` | Tarihsel günlük taban | Tamamlanmış dönemlerin sıfır günleri dahil robust günlük talebi |
| `FCST-012` | Ay içi kümülatif eğri | Kanalın geçmişte ayın her gününe kadar gerçekleştirdiği oran |
| `FCST-013` | Haftanın günü / Takvim etkisi | Aynı hafta günü ve olay tablosundan gelen çarpanlar |
| `FCST-014` | Son dönem hızı | Son `n` gün net talebinin üstel ağırlıklı ortalaması |
| `FCST-015` | Dinamik ay sonu tahmini | `tarihsel taban tahmini + güven ağırlıklı ani talep etkisi` |
| `FCST-016` | Tahmin alt/üst aralığı | Seçilen güven düzeyinde olası talep aralığı |
| `FCST-017` | Tahmin güven seviyesi | Veri yeterliliği ve model hatasından türetilen açıklanabilir skor |
| `FCST-018` | Aralıklı talep göstergesi | ADI ve CV² aralıklı talep tanı metrikleri |

---

## 9. Tahmin doğruluk ve geri test metrikleri

| `metric_id` | Metrik | Formül / kullanım |
|---|---|---|
| `FCST-019` | MAE | `ortalama(|gerçek - tahmin|)` |
| `FCST-020` | WAPE | `Σ|gerçek - tahmin| / Σ|gerçek|`; hacimler arası kıyas ana metriği |
| `FCST-021` | Bias | `Σ(tahmin - gerçek) / Σgerçek`; sürekli fazla/eksik tahmini gösterir |
| `FCST-022` | RMSE | Büyük hataları cezalandıran tanı metriği |
| `FCST-023` | Aralık kapsaması | Gerçeğin tahmin alt-üst aralığında kaldığı dönem oranı |
| `FCST-024` | Naif modele göre kazanım | Model hatasının naif modele göre iyileşme oranı |
| `FCST-025` | Model sürüm performansı | Ürün ailesi/kanal bazında sürümler arası karşılaştırma |

---

## 10. Stok durum ve kullanılabilirlik metrikleri

| `metric_id` | Metrik | Formül / kural |
|---|---|---|
| `STK-001` | Aktif stok yüklemesi | Son başarıyla yayımlanan tek aktif Malzemeler stok kümesi (`FULL_REPLACE`) |
| `STK-002` | Güncel stok yaşı | `as_of - loaded_at` (Son başarılı yükleme zamanı yaşı) |
| `STK-003` | Varyant kullanılabilir litresi | `Tahditsiz kullanılabilir miktar × active_lpu` |
| `STK-004` | Aile kullanılabilir litresi | `Σ varyant stok litresi` (Doğrulanmış varyantların litre toplamı) |
| `STK-005` | Stok pozisyonu | Aktif Malzemeler yüklemesinin kullanılabilir aile stok litresi |
| `STK-006` | Stok ikame işlemi | Eski kümenin tamamını kapatıp yeni kümeyi açan tek transaction |
| `STK-015` | Varyant stok miktarı | Kaynak kesin decimal miktarı, kendi `quantity_uom`uyla korunur |
| `STK-016` | Bilinen aile litresi | Yalnız doğrulanmış LPU'lu varyantların kesin litre toplamı |
| `STK-017` | Resmî stok tamlığı | Tümü çözüldüyse `COMPLETE` ve resmî litre geçerli; aksi halde `PARTIAL` |
| `STK-018` | Stok yayın delta kontrolü | Mutlak `%20+` kod veya `%30+` litre değişim uyarısı |
| `STK-013` | Stok var talep yok | Gelecek talep tahmini olmayan fakat stoğu bulunan ürün durumu |

---

## 10.1. Ticari Stok Metrik Kataloğu (`CUSTOMER_COMMERCIAL`)

Ticari Stok, müşteride bulunan kalan ürünlerin takibini yapar. **Bayi depo stoğuna, stok gününe veya sipariş ihtiyacına kesinlikle dahil edilmez (`CST-013`).**

| `metric_id` | Metrik | Formül / kural | Açıklama / Kısıt |
|---|---|---|---|
| `CST-001` | Aktif Ticari Stok yüklemesi | `active_commercial_stock_import` | Son geçerli Ticari Stok Excel yüklemesi; yeni dosya eskisini tam ikame eder. |
| `CST-002` | Doğal anahtar | `bayi + belge + müşteri + malzeme` | Mükerrer satır kontrolü; çakışma durumunda karantina/manuel inceleme. |
| `CST-003` | Depoda kalan miktar | `Depoda Kalan Mk.` | Kaynak miktar aynen korunur; yalnız aynı varyant içinde toplanabilir. |
| `CST-004` | Depoda kalan litre | `Depoda Kalan Lt.` | Kaynak litre aynen korunur; Ticari Stok ana toplama ölçüsüdür. |
| `CST-005` | Yoksayılan kaynak alanları | `Sevk Edilmiş Mik/Lt`, `Toplam Mik/Lt` | Kesinlikle yoksayılır; hiçbir hesaplama veya AI aracına alınmaz. |
| `CST-006` | Müşteri ticari stoğu | `customer_commercial_stock` | `Σ kalan litre` (Müşteri pasif/iptal olsa da kalan stok raporlanır). |
| `CST-007` | Ürün ticari stoğu | `product_commercial_stock` | `Σ kalan litre` (Malzeme/ürün ailesi bazında kalan stok toplamı). |
| `CST-008` | Sorumluluk ticari stoğu | `responsibility_commercial_stock` | Temsilci ve SSM bazında kalan litre toplamı; Master hiyerarşisi kullanılır. |
| `CST-009` | Stok yoğunlaşması | `commercial_stock_concentration` | En yüksek müşteri/ürün katkıları ve toplam litre içindeki payı. |
| `CST-010` | Hareketsiz müşteri stoğu | `inactive_customer_stock` | Pasif/iptal müşterilerde bulunan pozitif kalan litre; operasyonel sinyaldir. |
| `CST-011` | Kaynak kapsama oranı | `commercial_stock_source_coverage` | Eşleşen satır, müşteri, ürün ve temsilci coverage'ı. |
| `CST-012` | Regresyon kontrol toplamı | `commercial_stock_regression_totals` | Örnek `Ürünler.xlsx` (5.869 satır, 426 pozitif satır, 151.185,59 L) doğrulaması. |
| `CST-013` | Depo stok dışlama | `warehouse_stock_exclusion` | Ticari Stok hiçbir `STK-*`, SS, stok günü veya sipariş kararına giremez. |

---

## 11. Yoldaki stok ve pasif metrik grupları

Bu bölümdeki metrikler mevcut onaylı politikada `PASSIVE_BY_POLICY` veya `BLOCKED_SOURCE` statüsündedir.

| `metric_id` | Metrik | Grubu | Statü | Açılma Koşulu |
|---|---|---|---|---|
| `INB-001` | Açık sipariş litresi | Inbound | `PASSIVE_BY_POLICY` | Kullanıcı alış/yoldaki stok takibini açarsa |
| `INB-002` | Kesinleşmiş inbound | Inbound | `PASSIVE_BY_POLICY` | Durumu onaylı tedarik siparişi sağlandığında |
| `INB-003` | Geciken inbound | Inbound | `PASSIVE_BY_POLICY` | `t > ETA` takibi etkinleştirildiğinde |
| `RES-001` | Ayrılmış stok | Rezervasyon | `BLOCKED_SOURCE` | Müşteri sipariş rezervasyonu kaynağı sağlandığında |
| `RES-002` | Backorder | Rezervasyon | `BLOCKED_SOURCE` | Karşılanamayan talep defteri tutulduğunda |
| `LOT-001` | Yaşlanan stok | Parti / SKT | `BLOCKED_SOURCE` | Parti numarası ve giriş tarihi sağlandığında |
| `LOT-002` | SKT riski | Parti / SKT | `BLOCKED_SOURCE` | Son kullanma tarihi verisi eklendiğinde |
| `SUP-001` | Gerçek tedarik süresi | Tedarikçi | `PASSIVE_BY_POLICY` | Alış ve depo giriş hareket geçmişi tutulduğunda |

---

## 12. Güvenlik stoğu yöntemleri ve metrikleri

| `metric_id` | Metrik | Formül / kural | Statü / Durum |
|---|---|---|---|
| `SS-001` | Koruma süresi (gün) | `H` (Kullanıcı tanımlı koruma süresi) | `APPROVED_ACTIVE` |
| `SS-002` | Koruma süresi talebi | `Σ effective_daily_demand(t+1..t+H)` | `APPROVED_ACTIVE` |
| `SS-003` | Kümülatif tahmin hatası | `E_H = gerçek H-günlük talep - tahmin edilen H-günlük talep` | `APPROVED_ACTIVE` |
| `SS-004` | Quantile güvenlik stoğu | `max(0, Q_service(E_H))` | Ana istatistiksel aday |
| `SS-005` | Tampon gün güvenlik stoğu | Tampon gün içindeki talep toplamı | Geri düşme seçeneği |
| `SS-006` | Normal dağılım SS | `z × sigma_daily × sqrt(H)` | `OPTIONAL_DRAFT` |
| `SS-007` | Aktif güvenlik stoğu | Seçilen aktif yöntemin ürettiği litre | `APPROVED_ACTIVE` |
| `SS-008` | Kritik eşik | `koruma süresi talebi + aktif SS` | `APPROVED_ACTIVE` |
| `SS-009` | Güvenlik stoğuna iniş tarihi | Projeksiyon stoğun ilk `≤ SS` olduğu tarih | `APPROVED_ACTIVE` |
| `SS-010` | Kritik eşiğe iniş tarihi | Projeksiyon stoğun ilk `≤ kritik eşik` olduğu tarih | `APPROVED_ACTIVE` |
| `SS-011` | Güvenlikli stok günü | Bugünden SS eşiğine inişe kadar geçen gün | `APPROVED_ACTIVE` |
| `SS-012` | Kritik stok günü | Bugünden kritik eşiğe inişe kadar geçen gün | `APPROVED_ACTIVE` |
| `SS-013` | Servis yetersizlik oranı | Koruma süresinde talebi karşılayamayan çevrim oranı | Model tanı metriği |
| `SS-014` | Fazla stok litre-gün | Seçili üst seviyenin üzerindeki günlük litre toplamı | Model tanı metriği |

---

## 13. Yeniden sipariş ve zaman bazlı stok projeksiyonu

| `metric_id` | Metrik | Formül / kural |
|---|---|---|
| `STK-007` | Günlük projekte stok | `projected(d) = projected(d-1) - effective_demand(d)` |
| `STK-008` | Tahmini tükenme tarihi | Projeksiyon stoğun ilk `≤ 0` olduğu tarih |
| `STK-009` | Stok günü (kesin decimal) | Tam günler + `(önceki gün kalan litre / tükenme günü talebi)` |
| `STK-010` | Stok günü (gösterim) | Kullanıcı arayüzü gösterim yuvarlaması |
| `STK-011` | Ufukta tükenmiyor | Seçili tahmin ufku boyunca stok pozitif (`>365 gün / tükenmiyor`) |
| `STK-012` | Kesim saati etkisi | Gün ortası yüklemelerde kalan gün parçasından projeksiyon başlatma |

---

## 14. Sipariş ihtiyacı ve yuvarlama metrikleri

| `metric_id` | Metrik | Formül / kural | Statü |
|---|---|---|---|
| `REQ-001` | Birleşik etkin kalan talep | `Σ kanal etkin aile kalan talebi` | `APPROVED_ACTIVE` |
| `REQ-002` | Brüt hedef stok gereksinimi | `etkin kalan talep + aktif SS + onaylı ek koruma` | `APPROVED_ACTIVE` |
| `REQ-003` | Eksik / Fazla stok litresi | `need - stock_position` | `APPROVED_ACTIVE` |
| `ORD-001` | Net sipariş litresi | `max(0, gross_need - stock_position)` | `APPROVED_ACTIVE` |
| `ORD-002` | Ham paket miktarı | `net_order_litres / lpu(ikmal varyantı)` | `APPROVED_ACTIVE` |
| `ORD-003` | Yuvarlanmış paket miktarı | `ceil(raw_package_quantity)` | `APPROVED_ACTIVE` |
| `ORD-004` | MOQ sonrası miktar | `max(rounded_qty, MOQ)` ve katlarına yukarı yuvarlama | `BLOCKED_SOURCE` |
| `ORD-005` | Nihai sipariş litresi | `final_quantity × lpu(ikmal varyantı)` | `APPROVED_ACTIVE` |
| `ORD-006` | Yuvarlama fazlası litresi | `final_order_litres - net_order_litres` | `APPROVED_ACTIVE` |

---

## 15. Risk ve durum sınıfları

| `metric_id` | Risk / Durum Sınıfı | Tanım / Eşik | Statü |
|---|---|---|---|
| `RISK-001` | Stok tükendi (Stockout) | Mevcut veya projekte stok `≤ 0` | `APPROVED_ACTIVE` |
| `RISK-002` | Güvenlik stoğunun altında | `stock_position ≤ SS` | `APPROVED_ACTIVE` |
| `RISK-003` | Kritik eşiğin altında | `stock_position ≤ critical_threshold` | `APPROVED_ACTIVE` |
| `RISK-004` | Sipariş gerekli | `net_order_litres > 0` | `APPROVED_ACTIVE` |
| `RISK-005` | Fazla stok | Stok seçili maksimum üst seviyeyi aşıyor | `OPTIONAL_DRAFT` |
| `RISK-006` | Yavaş stok | Düşük talep hızı ve yüksek stok günü birlikte | `OPTIONAL_DRAFT` |
| `RISK-007` | Ölü stok | Onaylı süre boyunca talep yok ve stok pozitif | `OPTIONAL_DRAFT` |
| `RISK-008` | Stok verisi bayat | Son başarılı yükleme yaşı aktif eşiği aşar | `APPROVED_ACTIVE` |

---

## 16. Stok ve sipariş performans metrikleri

| `metric_id` | Metrik | Formül / Kullanım |
|---|---|---|
| `PRF-001` | Stockout günü | Stok `≤ 0` geçen gün sayısı |
| `PRF-002` | Cycle service level | Stockout yaşanmayan ikmal çevrimi oranı |
| `PRF-003` | Fill rate | Karşılanan talep / toplam doğrulanmış talep |
| `PRF-004` | Fazla stok litresi/günü | Üst sınırın üzerindeki litre ve gün toplamı |
| `PRF-005` | Ortalama stok | Dönem içi günlük stok ortalaması |
| `PRF-006` | Stok devir hızı | Dönem net tüketim / ortalama stok |
| `PRF-007` | Ortalama stok günü | Dönem içi günlük kapsama ortalaması |
| `PRF-008` | Öneri kabul oranı | Kullanıcı tarafından kabul edilen sipariş önerisi / toplam öneri |
| `PRF-009` | Öneri sapması | Verilen gerçek sipariş ile önerilen sipariş farkı |

---

## 17. Senaryo metrikleri

- Hedef `%x` artarsa gerekli stok ve sipariş
- Geleneksel/KA kanal payı değişirse ürün ailesi ihtiyacı
- Kampanya/lansman ek talebi
- Tedarik `n` gün gecikirse stockout tarihi
- Servis seviyesi değişirse güvenlik stoğu
- Belirli inbound iptal edilirse risk
- Paket varyantı değişirse sipariş miktarı ve yuvarlama fazlası

Senaryo sonuçları gerçekleşen veya resmi tahminle karıştırılmaz; `scenario_id` ve varsayımlarıyla saklanır.

---

## 18. AI cevaplama zorunlulukları

AI stok sorularında mümkün olduğu ölçüde şu sırayı izler:

1. Ürün ailesi, kanal, depo ve tarih kapsamını belirtir.
2. Son başarılı Malzemeler yükleme zamanını ve veri güncelliğini (`STK-002`) belirtir.
3. Kullanılan talep tahminini; Geleneksel ve KA katkılarını ayırır.
4. Aktif güvenlik stoğu yöntemini (`SS-007`) ve parametre sürümünü belirtir.
5. Brüt ihtiyaçtan mevcut stok düşüşünü adım adım gösterir.
6. Paket dönüşümü, MOQ ve yuvarlama etkisini (`ORD-001..006`) gösterir.
7. Tahmin güveni, eksik veri ve alternatif senaryoyu belirtir.
8. Ticari Stok sorularında ayrı `CST-*` metriklerini kullanır (`CST-001..013`); müşteri/ürün/temsilci bazında yalnız kalan miktar ve litreyi açıklayarak bayi depo stoğuyla kesinlikle birleştirmez.

---

## 19. Konfigürasyon, Paket Sözleşmeleri ve Zarf Kodları

Her metrik kaydında en az şu alanlar bulunur:
- `metric_key`, `metric_name`, `description`, `unit`, `grain`
- `formula_expression` veya hesaplayıcı sürümü
- `source_dependencies`, `metric_dependencies`
- `calculation_enabled`, `decision_enabled`, `visibility_enabled`
- `valid_from`, `valid_to`, `version`
- `missing_data_policy`, `fallback_policy`
- `owner`, `changed_by`, `change_reason`, `approved_at`

### Tipli Sonuç Zarfları (Result Envelopes):
- `STK`: Bayi anlık depo stok sonuçları (`STK-001`..`STK-018`)
- `CST`: Müşteri Ticari Stok sonuçları (`CST-001`..`CST-013`)
- `FCST`: Talep tahmini sonuçları (`FCST-001`..`FCST-025`)
- `SS`: Güvenlik stoğu sonuçları (`SS-001`..`SS-014`)
- `REQ`: İhtiyaç hesap sonuçları (`REQ-001`..`REQ-003`)
- `ORD`: Sipariş öneri ve yuvarlama sonuçları (`ORD-001`..`ORD-006`)
- `RISK`: Risk ve durum sınıfı sonuçları (`RISK-001`..`RISK-008`)

---

## 20. İlk uygulama için kaynak durumu

| Alan | Mevcut durum |
|---|---|
| Kullanılabilir stok | `Malzemeler (1).xlsx` içindeki `Tahditsiz kullanılabilir` miktarı var (`STK-001`). |
| Ticari stok | `Ürünler.xlsx` (5.869 satır) içindeki `Depoda Kalan Mk/Lt` verisi var (`CST-001..013`). |
| Paket/litre dönüşümü | Sellout, KA ve `paket.xlsx` ile doğrulanabilir katsayılar (`PRD-001`). |
| Geleneksel talep | Sellout mevcut; dönem `Faturalama Tarihi` (`EVT-001`). |
| KA talebi | İrsaliye mevcut; dönem `Yükleme Tarihi` (`EVT-002`). |
| Yoldaki stok | Kullanıcı kararıyla takip edilmeyecek; katalog metriği pasif (`INB-*`). |
| Ayrılmış/bloke/karantina | Mevcut stok dosyasında ayrı alan olarak yok (`RES-*`). |
| Tedarik süresi geçmişi | Alış/giriş hareketi tutulmadığı için otomatik türetilemez (`SUP-*`). |
| Parti/SKT | Şu an kaynak yok (`LOT-*`). |

Kaynağı olmayan metrikler katalogdan silinmez; `BLOCKED_SOURCE` durumunda tutulur ve AI sayı uydurmaz.
