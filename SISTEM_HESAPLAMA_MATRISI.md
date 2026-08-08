# Sistem Hesaplama Matrisi

**Tarih:** 2026-08-05  
**Amaç:** Dashboard, rapor, dışa aktarım ve AI tarafından kullanılacak bütün hesapları tek, sürümlü ve makinece uygulanabilir sözleşmede toplamak.  
**Bağlı kayıtlar:** `VERITABANI_YENIDEN_TASARIM_KARARLARI.md`, `STOK_METRIK_KATALOGU.md`

## 1. Çalıştırma sözleşmesi

Her matris satırı merkezi `metric_registry` içinde bir hesap tanımıdır. Aynı metrik UI veya AI için yeniden yazılmaz.

| Alan | Zorunlu davranış |
|---|---|
| `metric_id` | Değişmeyen kalıcı kimlik. Formül değişince kimlik değil sürüm değişir. |
| `rule_state` | `APPROVED_ACTIVE`, `PENDING_APPROVAL`, `OPTIONAL_DRAFT`, `PASSIVE_BY_POLICY`, `BLOCKED_RULE` veya `BLOCKED_SOURCE`. |
| `grain` | Sonucun benzersiz kayıt seviyesi. Boyut anahtarları bu seviyede zorunludur. |
| `period_field` | Dönemi belirleyen kaynak alan. Yükleme tarihi bunun yerine kullanılamaz. |
| `dependencies` | Önce başarıyla hesaplanması gereken metrik veya normalize veri kümeleri. |
| `formula` | SQL/hesaplayıcı tarafından uygulanacak kesin iş kuralı. Serbest AI yorumu değildir. |
| `eligibility_filter` | Dahil/dışarıda kapsamı. Filtre sonucu ve dışlama nedeni denetlenebilir olmalıdır. |
| `null_policy` | Eksik veri sessizce `0` olmaz. `NOT_APPLICABLE`, `MISSING_SOURCE`, `BLOCKED_DEPENDENCY`, `INSUFFICIENT_HISTORY` gibi sonuç durumu üretir. |
| `negative_policy` | İşaretli hareketin korunması, mutlak değer veya dışlama davranışı açıkça belirtilir. |
| `precision_policy` | Hesap katmanında `numeric/decimal`; yuvarlama yalnızca açıkça belirtilen gösterim veya paket siparişi aşamasında yapılır. |
| `explain_fields` | AI ve denetim izinde saklanacak temel girdiler, kapsam, sürüm ve uyarılar. |

Her hesap sonucu en az şu ortak alanlarla saklanır:

`metric_id, metric_version_id, calculation_run_id, as_of_at, period_start, period_end, scenario_id, dimension_keys, value_numeric, value_text, unit, result_status, source_snapshot_ids, dependency_result_ids, formula_inputs_json, exclusion_summary_json, data_quality_flags, calculated_at`.

### Kural durumlarının çalışma etkisi

| Durum | Hesaplanır | Kararda kullanılır | Açıklama |
|---|---:|---:|---|
| `APPROVED_ACTIVE` | Evet | Konfigürasyona göre | Onaylı resmi hesap. |
| `PENDING_APPROVAL` | Senaryo/karşılaştırma olarak | Hayır | Kullanıcı onayı olmadan resmi sonuç veya sipariş kararı üretmez. |
| `OPTIONAL_DRAFT` | `calculation_enabled=true` ise | Varsayılan hayır | Tam kapsam için korunmuş yardımcı metrik. |
| `PASSIVE_BY_POLICY` | Hayır | Hayır | Kaynak ileride eklense dahi kullanıcı politikası değiştirilmeden açılmaz. |
| `BLOCKED_RULE` | Hayır | Hayır | Veri olabilir fakat iş kuralı henüz onaylı değildir. |
| `BLOCKED_SOURCE` | Hayır | Hayır | Kural tanımlı olsa da zorunlu kaynak yoktur. |

## 2. Hesaplama bağımlılık sırası

1. `L0_RAW`: ham dosya satırı, yükleme ve kolon doğrulaması.
2. `L1_IDENTITY`: müşteri, ürün, varyant, aile, temsilci, SSM ve kanal eşleme.
3. `L2_EVENT`: satış/iade/iptal/belge olay sınıflandırması ve mükerrer kontrolü.
4. `L3_ACTUAL`: gerçekleşen litre, müşteri evreni, FKNS, hedef ve finansal gerçekleşenler.
5. `L4_MODEL`: tarihsel taban, dinamik tahmin, hedef ekli etkin günlük talep ve geri test.
6. `L5_STOCK`: son başarılı aktif Malzemeler yüklemesi, litre dönüşümü ve aile stok toplamı.
7. `L6_PROJECTION`: stok günü, tükenme, güvenlik stoğu, kritik eşik ve riskler.
8. `L7_DECISION`: net sipariş, paket/MOQ yuvarlama ve senaryolar.

Bir üst katman başarısız bağımlılığı sıfır kabul ederek devam edemez.

## 3. Müşteri, kanal ve organizasyon matrisi

| ID | Durum | Seviye | Kaynak / dönem | Hesap / filtre | Boş veri ve çıktı |
|---|---|---|---|---|---|
| `CUS-001 customer_identity` | `APPROVED_ACTIVE` | müşteri | Master `Müşteri`; geçerlilik tarihi | Yalnızca metin olarak birebir `500` ile başlayan kod. Sayısal dönüşüm, sıfır ekleme ve Bira/Distile ayrımı yok. | Geçersiz kod dışlanır ve DQ listesine girer. |
| `CUS-002 customer_status` | `APPROVED_ACTIVE` | müşteri × geçerlilik dönemi | Master `Müşteri Durumu` | Aynı müşteri satırlarında `Aktif` varsa Aktif; yoksa `Pasif` varsa Pasif; yalnızca tamamı iptalse İptal. | Tanımsız değer `UNKNOWN_STATUS`; aktif varsayılmaz. |
| `CUS-003 master_channel` | `APPROVED_ACTIVE` | müşteri × geçerlilik dönemi | Master `Satış Kanalı Tanımı` | `Standart Açık/Horeca/Otel → Açık Kanal`; `Standart Kapalı/Ekomini → Kapalı Kanal`. Sellout kanalı kullanılmaz. | Eşleşmeyen değer `UNCLASSIFIED_CHANNEL`. |
| `CUS-004 customer_segment` | `APPROVED_ACTIVE` | müşteri × geçerlilik dönemi | Master segment | Segment aynen tarihçeli boyut olur; standart KPI'yı filtresizken değiştirmez. | Eksik segment `UNCLASSIFIED_SEGMENT`; müşteri silinmez. |
| `ORG-001 normalized_rep` | `APPROVED_ACTIVE` | müşteri × geçerlilik dönemi | Master temsilci | Ham bağlantı tutarlılığıyla tek güncel temsilci. Aykırı bağlantı müşteriyi silmez; gerekirse normalize temsilci boş kalır. | Sabit müşteri adedi eşiği yok. Manuel kontrol bayrağı. |
| `ORG-002 dominant_ssm_ratio` | `APPROVED_ACTIVE` | temsilci × dönem | Aktif müşterilerin SSM bağlantısı | `max(SSM'ye bağlı aktif müşteri) / temsilcinin SSM bilgili aktif müşterisi`. | Payda 0 ise hesaplanamaz. |
| `ORG-003 normalized_ssm` | `APPROVED_ACTIVE` | temsilci × geçerlilik dönemi | `ORG-002` | Baskın oran `≥0.90` ise baskın SSM; değilse otomatik düzeltme yok ve manuel kontrol. | Aktif müşteri yoksa performans hiyerarşisinden çıkar. |
| `ORG-004 hierarchy_financial_retention` | `APPROVED_ACTIVE` | temsilci × dönem | `CUS-002`, `FIN-006` | Aktif müşterisi olmasa da pasif/iptal müşterilerde toplam pozitif borçlu kapsam bakiyesi varsa finansal hiyerarşide tutulur. | `FIN-006` bloke ise sonuç da bloke. |
| `CUS-005 fkns_eligible_customer` | `APPROVED_ACTIVE` | müşteri × ay kesimi | Dönem sonu müşteri/temsilci/kanal snapshot'ı | Durum Aktif, geleneksel uygunluk açık, geçerli normalize temsilci ve istenen kanal/organizasyon kapsamında. | Geçmiş snapshot yoksa bugünkü masterla geriye yürütülmez. |
| `CUS-006 financial_scope_customer` | `APPROVED_ACTIVE` | müşteri × as-of | Durum + `FIN-006 balance` | Aktif müşteri dahil. Pasif/İptal yalnızca pozitif borçlu bakiye `≥100 TL` ise dahil. | Bakiye hesaplanamıyorsa kapsam da hesaplanamaz. |
| `ORG-005 ssm_target_litres` | `APPROVED_ACTIVE` | SSM × ay | Temsilci hedefleri | `Σ bağlı temsilci litre hedefi`. | Eksik temsilci hedefi ayrı uyarı; sessizce sıfır değil. |
| `ORG-006 ssm_actual_litres` | `APPROVED_ACTIVE` | SSM × ay | Temsilci net litre | `Σ bağlı temsilci net satış litresi`; müşteri tek temsilciye bağlı olmalıdır. | Aykırı/boş bağlantı dışlama özeti verir. |
| `CUS-007 master_field_resolution` | `APPROVED_ACTIVE` | müşteri × alan × Master snapshot | Aynı koda bağlı bütün Master satırları | Dolu değerler güvenli metin karşılaştırmasında aynıysa tek değer; yalnız boş kardeş satır dolu kardeşten tamamlanabilir. Farklı dolu değer arbitrary ilk/son seçilmeden `CONFLICT_REVIEW`; kredi limiti/risk oranı raw-only. | Sonuç `RESOLVED/PARTIAL/UNRESOLVED`; bütün source ref'leri ve aday değerler korunur. |
| `CUS-008 master_snapshot_membership` | `APPROVED_ACTIVE` | müşteri × Master snapshot/as-of | Aktif `FULL_REPLACE` Master yayını | Snapshot'ta geçerli kodla bulunan her müşteri bir kez üyedir. Yeni tam snapshot'ta bulunmayan eski müşteri silinmez/iptal edilmez; o kesimde `NOT_PRESENT_IN_CURRENT_MASTER`. | Backdated snapshot onaysız geçmişi değiştirmez; upload-time fallback provenance taşır. |
| `ORG-007 customer_rep_assignment_resolution` | `APPROVED_ACTIVE` | müşteri × geçerlilik | Master temsilci adayları + onaylı alias | Tek tanınmış aday→atanır; çoklu farklı aday→`REVIEW_REQUIRED`; boş/aykırı aday→`UNASSIGNED`. İsimler `/` ile birleşmez, müşteri sayısı eşiği kullanılmaz. | Çözümsüz müşteri şirkette mutabakat satırında kalır; başka temsilciye tahminle atanmaz. |
| `ORG-008 hierarchy_resolution_coverage` | `APPROVED_ACTIVE` | snapshot/as-of × organizasyon | `CUS-002/003/008`, `ORG-001..003/007` | Kimlik, status, kanal, rep ve rep→SSM çözülen benzersiz müşteri payları ile dışlanan müşteri/adet nedenleri ayrı hesaplanır. | Coverage oranı performans skoru değildir; unresolved kayıt aşağı akışta partial/blokaj nedeni taşır. |

## 4. Hareket sınıflandırma ve gerçekleşen Sellout/KA matrisi

| ID | Durum | Seviye | Kaynak / dönem | Hesap / filtre | Boş/negatif davranışı |
|---|---|---|---|---|---|
| `EVT-001 sellout_period` | `APPROVED_ACTIVE` | Sellout satırı | `Faturalama Tarihi` | Dönem yalnızca bu alanla belirlenir. | Geçersiz tarih satırı resmi hesaba girmez. |
| `EVT-001A sellout_month_catalog` | `APPROVED_ACTIVE` | bayi × `YYYY-MM` | Yayımlanmış geçerli Sellout olaylarının `Faturalama Tarihi`, coverage | En az bir yayımlanmış olay veya açık doğrulanmış coverage bulunan her takvim ayı tek seçenek olur; kullanıcı etiketi yerel dilde `YYYY AyAdı`, makine anahtarı `YYYY-MM`dır. Sellout ana raporu aynı anda tek ay seçer. | Yıl bilgisi olmadan `1..12` gösterimi ve Sellout için `ROLLING_3/6/12` filtresi yoktur; 3/6/12 yalnız `FIN-028..030` finansal pencereleridir. |
| `EVT-002 ka_period` | `APPROVED_ACTIVE` | KA satırı | Satırdaki `Yükleme Tarihi` | Dosya yüklenme, irsaliye, fatura ve istenen teslim tarihi kullanılmaz. | Geçersiz tarih satırı resmi hesaba girmez. |
| `EVT-003 movement_type` | `APPROVED_ACTIVE` | hareket satırı/belge | Belge tipi, bağlantı ve ürün masterı | `POSITIVE_SALE`, `PRODUCT_RETURN`, `CANCEL_REVERSAL`, `TECHNICAL_PACKAGE`, `UNCLASSIFIED_NEGATIVE`. Kod öneki tek başına belirlemez. | İşaret korunur; sınıflandırılamayan hareket silinmez. |
| `EVT-004 cancellation_pair` | `BLOCKED_RULE` | belge çifti | Finansal/Sellout belge bağları | Orijinal ve ters belgenin kesin eşleme anahtarı henüz onaylanmadı. | Eşleme onaylanana kadar otomatik iptal uygulama yok. |
| `EVT-005 sellout_invoice_event` | `APPROVED_ACTIVE` | müşteri × belge × gün | `Müşteri No + Satış Belgesi + Faturalama Tarihi`; ileride gerçek Fatura No | Aynı belge ve ürün ailesindeki bütün varyantlar litre olarak birleştirilir. | Anahtar eksikse olay DQ durumunda tutulur. |
| `EVT-006 sellout_duplicate` | `APPROVED_ACTIVE` | satır imzası × occurrence | Çakışan Sellout importları | Aynı kanonik satır imzasının batch içi çokluğu multiset olarak korunur; sonraki çakışan batch yalnız önceki çokluğu aşan farkı yeni olay adayı yapar. | Özdeş iki meşru fatura satırı korunur; aynı dosya/örtüşen dönem ikinci ekonomik olay üretmez. |
| `EVT-007 sellout_line_identity` | `APPROVED_ACTIVE` | belge × varyant × kaynak occurrence | Exact müşteri/belge/tarih/malzeme/miktar/litre ve kanıt rolleri | Rastgele/satır-sırası ID yerine kanonik signature+occurrence provenance; farklı miktar/litre ayrı satır olayıdır. | Eksik belge/tarih resmi olayı bloklar; raw observation kaybolmaz. |
| `EVT-008 sellout_coverage_day` | `APPROVED_ACTIVE` | yerel gün × import kapsamı | Onaylı `coverage_from/to`, Faturalama Tarihi | Gün `OBSERVED`, doğrulanmış satışsızsa `ZERO`, eksikse `MISSING/PARTIAL`. | Onaysız boş gün 0 yapılamaz. |
| `EVT-009 sellout_responsibility` | `APPROVED_ACTIVE` | Sellout olayı × billing date | Temporal müşteri status/kanal/rep/SSM | ACTIVE uygunluğu ve olay günü sorumluluğu; ilk Master öncesi yalnız açık `INITIAL_MASTER_PROXY`. | Proxy `ASSUMED_BASELINE/PARTIAL`; unresolved hacim reconciliation'da kalır. |
| `ACT-001 gross_sales_litres` | `APPROVED_ACTIVE` | aile × kanal × gün/ay × org | Sınıflandırılmış Sellout/KA | Geçerli pozitif satış litrelerinin toplamı. KA yalnız talep/stok kanalına girer. | Negatifler bu metrikte yok; ayrı izlenir. |
| `ACT-002 return_litres` | `APPROVED_ACTIVE` | aile × kanal × gün/ay × org | `PRODUCT_RETURN` | Geçerli ürün iadelerinin `Σ abs(litre)` toplamı. | Negatif işaret kaynaktaki haliyle ayrıca korunur. |
| `ACT-003 reversal_effect_litres` | `APPROVED_ACTIVE` ancak `EVT-004` bağımlı | aile × kanal × dönem | Geçerli iptal/ters çift | Geçerli ters kaydın orijinal satışa etkisi. | Kesin çift yoksa `BLOCKED_DEPENDENCY`. |
| `ACT-004 net_sales_litres` | `APPROVED_ACTIVE` | aile × kanal × gün/ay × org | `ACT-001..003` | `brüt satış - iade - geçerli ters kayıt etkisi`. | Sınıflandırılamayan negatif ayrı DQ bayrağıyla açıklanır. |
| `ACT-005 return_rate` | `APPROVED_ACTIVE` | aile × kanal × dönem | `ACT-001`, `ACT-002` | `iade litresi / brüt satış litresi`. | Brüt 0 ise oran `NULL/NOT_APPLICABLE`. |
| `ACT-006 unique_documents` | `APPROVED_ACTIVE` | aile × kanal × dönem | Geçerli belge olayı | `count(distinct document_event_id)`. | Eksik belge anahtarı sayılmaz, DQ'da görünür. |
| `ACT-007 unique_buying_customers` | `APPROVED_ACTIVE` | aile × geleneksel × dönem | Geçerli pozitif olay + aktif müşteri | `count(distinct customer_id)`. | KA için FKNS değil, yalnız dağılım metriği. |
| `ACT-008 litres_per_document` | `APPROVED_ACTIVE` | aile × kanal × dönem | `ACT-004`, `ACT-006` | `net litre / benzersiz belge`; brüt alternatifi ayrı ölçü olabilir. | Belge 0 ise NULL. |
| `ACT-009 litres_per_customer` | `APPROVED_ACTIVE` | aile × geleneksel × dönem | `ACT-004`, `ACT-007` | `net litre / benzersiz alan müşteri`. | Müşteri 0 ise NULL. |
| `ACT-010 channel_contribution` | `APPROVED_ACTIVE` | aile × kanal × dönem | Kanal ve aile toplam net litre | `kanal net litre / aile toplam net litre`. | Toplam 0 ise NULL. |
| `ACT-011 segment_litres` | `APPROVED_ACTIVE` | segment × aile × dönem | Segment tarihçesi + Sellout | Seçili segment müşterilerinin aile varyantlarındaki net Sellout litresi. | Varsayılan “ne kadar satılmış” ölçüsü litre; Sellout TL yok. |
| `ACT-012 unclassified_negative_litres` | `APPROVED_ACTIVE` | aile/eşleşmemiş kod × dönem | `UNCLASSIFIED_NEGATIVE` | İşaretli ve mutlak litre ayrı toplamlar. | Resmi KPI etkisi veri kalite uyarısıyla açıkça belirtilir. |
| `ACT-013 sellout_responsibility_reconciliation` | `APPROVED_ACTIVE` | ay × şirket | `EVT-009`, `ACT-004` | Uygun şirket net litresi = Açık+Kapalı+kanalı çözümsüz; rep/SSM atanan ve atanmayan litreler ayrı mutabık toplamlar. | Çözümsüz litre kaybolmaz veya tahminle organizasyona yazılmaz. |

## 5. FKNS ve penetrasyon matrisi

| ID | Durum | Seviye | Bağımlılıklar | Kesin hesap | Özel davranış |
|---|---|---|---|---|---|
| `FKNS-001 denominator_general` | `APPROVED_ACTIVE` | temsilci/SSM/şirket × ay | `CUS-005` | Dönem kesiminde kapsamdaki benzersiz uygun aktif müşteri sayısı. | Satıştan türetilmez. Cari ay `as_of`; tamamlanmış ay ay sonu. |
| `FKNS-002 numerator_invoice` | `APPROVED_ACTIVE` | müşteri × ay, sonra org | Paket 04 geçerli pozitif Sellout document event | En az bir geçerli pozitif faturalama belgesi bulunan uygun aktif müşteri bir kez. Sellout TL kullanılmaz; iade tek başına pay oluşturmaz. | Tam iptal edilmiş belge oluşturmaz; gerçek iade geçmiş faturalama olayını silmez. Paket 07 finansal fatura ileride mutabakat kanıtıdır. |
| `FKNS-003 rate_general` | `APPROVED_ACTIVE` | temsilci/SSM/şirket × ay | `FKNS-001`, `FKNS-002` | `100 × benzersiz pay / benzersiz payda`. | Payda 0 ise NULL; alt grup yüzdelerinin ortalaması alınmaz. |
| `FKNS-004 denominator_channel` | `APPROVED_ACTIVE` | org × kanal × ay | `CUS-003`, `CUS-005` | Açık/Kapalı master kanalındaki benzersiz uygun aktif müşteriler. | Sellout kanalı kullanılmaz. |
| `FKNS-005 product_eligibility_universe` | `APPROVED_ACTIVE` | aile × kanal × ay | Tarihçeli ürün ailesi-kanal uygunluk matrisi + `CUS-005` | Ailenin tanımlı uygun kanallarındaki benzersiz müşteri kümesi. | Uygunluk satış oranından veya ürün adından türetilmez. |
| `FKNS-006 numerator_product` | `APPROVED_ACTIVE` | aile seçimi × org × ay | Pozitif satış olayı + aile varyantları | `∪f {müşteri | müşteri f ailesine uygun ∧ f ailesinde pozitif geçerli satış aldı}`. | Çoklu ürün OR; müşteri bir kez. Başka ailenin evreninde bulunmak uygunsuz ürün satışını paya sokmaz. |
| `FKNS-007 denominator_product_or` | `APPROVED_ACTIVE` | aile seçimi × org × ay | `FKNS-005` | Seçilen ailelerin uygun müşteri evrenlerinin küme birleşimi. | Müşteri bir kez. |
| `FKNS-008 rate_product_or` | `APPROVED_ACTIVE` | aile seçimi × org × ay | `FKNS-006`, `FKNS-007` | `100 × pay/payda`. | Payda 0 ise NULL. |
| `FKNS-009 raw_product_penetration` | `APPROVED_ACTIVE` | aile × kanal × org × ay | Pozitif satış + aktif müşteri | Uygunluk tanımı yoksa `ürünü alan aktif müşteri / seçili kanaldaki tüm aktif müşteri`. | Resmi/hedef FKNS değildir; eksik uygunluk uyarısı taşır. |
| `FKNS-010 retained_product_points` | `APPROVED_ACTIVE` | aile seçimi × org × ay | Müşteri × aile net litre | Seçilen ailelerden en az birinde net litre `>0` olan benzersiz müşteri. | Tam iade edilen nokta dışarıda. |
| `FKNS-011 exclusion_breakdown` | `APPROVED_ACTIVE` | FKNS sonucu | Pay/payda kümeleri | Aktif değil, kanal belirsiz, temsilci dışı, ürün uygun değil, iptal vb. nedenlere göre dışlanan müşteri sayısı/listesi. | AI açıklamasının zorunlu girdisi. |
| `FKNS-012 portfolio_cutoff` | `APPROVED_ACTIVE` | müşteri × ay × scope | temporal Master/organizasyon | Tamamlanmış ayda ay sonu, cari ayda Europe/Istanbul as-of durum/kanal/rep/SSM kümesi hem pay hem payda için sabitlenir. | Ay içi rep değişiminde müşteri kesim sahibine bir kez bağlanır; geçmiş current Master'la geriye taşınmaz. |
| `FKNS-013 selection_set_identity` | `APPROVED_ACTIVE` | aile seçimi | benzersiz sıralı family id kümesi | Sırasız/tekrarsız canonical family set hash'i; varyant seçimi ailesine çözülür. | Seçim sırası, aynı ailenin tekrar/varyant seçimi sonucu değiştirmez. |
| `FKNS-014 product_eligibility_completeness` | `APPROVED_ACTIVE` | seçim × kanal × ay kesimi | tarihçeli family-channel matrisi | Her seçili aile için geçerli eligibility zorunlu. Bir eksik aile resmi tek/OR sonucu `NULL/PARTIAL_ELIGIBILITY` yapar. | Tanımlı aileler sessizce tam seçim gibi sunulmaz; raw penetrasyon ayrıdır. |
| `FKNS-015 fkns_target` | `APPROVED_ACTIVE` | rep × ay × genel-kanal/aile | sürümlü manuel hedef oranı | Exact `0..100`; `target_equivalent_points=denominator×rate/100`, `required_whole_customers=ceil(...)`, `gap=max(0,required−numerator)`. | Eksik hedef 0 değildir; ad hoc çoklu OR için aile hedefleri toplanmaz. |
| `FKNS-016 organization_target_rollup` | `APPROVED_ACTIVE` | SSM/şirket × ay × hedef türü | rep target ve paydaları | `100×Σ target_equivalent_points/Σ target-covered denominator`; target coverage ayrıca. | Rep hedef oranı ortalaması ve eksik hedefi 0 sayma yasak. |
| `FKNS-017 fkns_coverage_guard` | `APPROVED_ACTIVE` | sonuç | Master/Sellout/aile/eligibility coverage | Eksik Master paydası veya satış dönemi resmi oranı null/partial yapar; observed buyer alt sınırı ayrıca. | Eksik gün müşteriyi non-buyer yapmaz; non-buyer yalnız tam coverage'ta tanımlıdır. |

## 6. Ürün ailesi, paket ve litre dönüşüm matrisi

| ID | Durum | Seviye | Kaynak / bağımlılık | Hesap | Hata/yuvarlama |
|---|---|---|---|---|---|
| `PRD-001 family_membership` | `APPROVED_ACTIVE` | varyant × geçerlilik dönemi | Paket işlemi + doğrulanmış master | Her ürün kodu tek ürün ailesine bağlı varyanttır. Yönlü işlem kalıcı ana kod belirlemez. | Salt ad benzerliği adaydır, resmi eşleme değildir. |
| `PRD-002 canonical_variant` | `APPROVED_ACTIVE` | aile × geçerlilik dönemi | Kullanıcı/onaylı master | Açıkça belirlenen `canonical_stock_variant_id`. | Yön veya isimden otomatik çıkarılmaz. |
| `PRD-003 sellout_lpu_candidate` | `APPROVED_ACTIVE` | varyant × kaynak sürümü | Geçerli pozitif Sellout | `Σ litre / Σ miktar`, yalnız `miktar>0` ve `litre>0`. | İade/iptal yok; satır oranı medyan/yayılım doğrulama içindir. |
| `PRD-004 ka_lpu_candidate` | `APPROVED_ACTIVE` | varyant × kaynak sürümü | Geçerli pozitif KA | `Σ litre / Σ miktar`. | Selloutla aynı doğrulama; ikinci kaynak. |
| `PRD-005 package_lpu` | `APPROVED_ACTIVE` | varyant × geçerlilik dönemi | `units_per_case`, `unit_volume_ml` veya dönüşüm ağı | `units_per_case × unit_volume_ml / 1000` ya da doğrulanmış aile dönüşümü. | Eksik bileşende hesaplanamaz. |
| `PRD-006 active_lpu` | `APPROVED_ACTIVE` | varyant × geçerlilik dönemi | `PRD-003..005`, manuel master | Öncelik: istikrarlı Sellout → KA → doğrulanmış paket işlemi → onaylı master/manuel. | Uyuşmazlık gizlenmez; geçmiş sürüm korunur. |
| `PRD-007 conversion_status` | `APPROVED_ACTIVE` | varyant | Aday dağılımları | `verified`, `unit_inconsistent`, `manual`, `non_volume`, `missing` vb. | `volume_tracked=false` ürün litre/stok günü dışında. |
| `PRD-008 variant_stock_litres` | `APPROVED_ACTIVE` | snapshot × varyant | Yüklenen miktar + `PRD-006` | `available_quantity × litres_per_stock_unit`. | Katsayı eksikse NULL; ham miktar gösterilir. |
| `PRD-009 family_stock_litres` | `APPROVED_ACTIVE` | snapshot × aile | `PRD-001`, `PRD-008` | Doğrulanmış bütün hacim varyantlarının kesin litre toplamı. | Eksik varyant katsayısı varsa eksik kapsam uyarısı; resmi toplam politikası açık olmalı. |
| `PRD-010 canonical_case_equivalent` | `APPROVED_ACTIVE` | aktif stok yüklemesi × aile | `PRD-002`, `PRD-006`, `PRD-009` | `aile stok litresi / ana kod litre-koli katsayısı`. | Kesin ondalık saklanır. |
| `PRD-011 displayed_case_equivalent` | `APPROVED_ACTIVE` | snapshot × aile | `PRD-010` | `round(kesin ana kod koli eşdeğeri)`. | Yalnız gösterim; hiçbir hesaba girdi olmaz. |
| `PRD-012 replenishment_quantity_raw` | `APPROVED_ACTIVE` | aile × karar anı | Net gerekli litre + ikmal varyantı | `net gerekli litre / lpu(ikmal varyantı)`. | Sipariş yuvarlaması `ORD` katmanında. |
| `PRD-013 conversion_graph_consistency` | `APPROVED_ACTIVE` | graph sürümü × bağlı bileşen | Paket dönüşüm edge'leri | Her çevrimde yönlü oran çarpımı kaynak hassasiyeti içinde `1`; iki yol aynı eşdeğerliği vermeli. | Çatışmalı bileşen otomatik aile/litre yayınına girmez. |
| `PRD-014 product_family_resolution_coverage` | `APPROVED_ACTIVE` | snapshot/run | Varyantlar + tarihçeli aile üyeliği | `resmî aileye bağlı benzersiz varyant / kapsamdaki benzersiz varyant`; miktar/litre etkisi ayrıca verilir. | Ad-only aday paya girmez; eksik sıfır sayılmaz. |
| `PRD-015 litre_resolution_coverage` | `APPROVED_ACTIVE` | snapshot/run | Hacim izlenen varyantlar + aktif LPU | `aktif doğrulanmış LPU'lu hacim varyantı / kapsamdaki hacim varyantı`; kaynak miktar ve gözlenen litre ağırlıklı coverage ayrıca verilir. | `non_volume` paydadan ayrı raporlanır; missing/unit-conflict blok/partial üretir. |
| `PRD-016 litre_source_variance` | `APPROVED_ACTIVE` | varyant × evidence/run | Sellout, KA, paket propagation, katalog/manual adayları | Her aday için `candidate_lpu - selected_lpu` ve bağıl fark; `ΣL/ΣQ`, medyan/MAD ve kaynak hassasiyetiyle açıklanır. | Uyuşmazlık gizlenmez; tolerans rule version'dan gelir. |

## 7. Hedef, dinamik talep ve tahmin matrisi

| ID | Durum | Seviye | Bağımlılık | Hesap | Veri davranışı |
|---|---|---|---|---|---|
| `TGT-001 channel_target_litres` | `APPROVED_ACTIVE` | kanal × org × ay | Hedef kaynağı | Geleneksel temsilci Açık+Kapalı hedefleri; KA kendi hedefi. | Eksik hedef `MISSING_SOURCE`, 0 sayılmaz. |
| `TGT-002 current_actual_litres` | `APPROVED_ACTIVE` | kanal × org × ay × as-of | `ACT-004` | Ay başından kesim tarihine net litre. | Gelecek satır dahil edilmez. |
| `TGT-003 attainment_rate` | `APPROVED_ACTIVE` | kanal × org × ay | `TGT-001..002` | `actual / target`. | Hedef 0 ise NULL. |
| `TGT-004 remaining_channel_target` | `APPROVED_ACTIVE` | kanal × org × ay | `TGT-001..002` | `max(0, target - actual)`. | Eksik hedefte NULL. |
| `TGT-005 historical_family_share` | `APPROVED_ACTIVE` | aile × kanal × model sürümü | Tamamlanmış geçmiş net talep | `robust/ağırlıklı aile talebi / kanal toplam talebi`. | Geçmiş yetersizse belgeli geri düşme. |
| `TGT-006 target_based_remaining` | `APPROVED_ACTIVE` | aile × kanal × ay | `TGT-004..005` | `kalan kanal hedefi × tarihsel aile payı`. | Bağımlılık yoksa hesaplanamaz. |
| `TGT-007 organization_target_rollup` | `APPROVED_ACTIVE` | rep/SSM/şirket × kanal × ay | Sürümlü rep Açık/Kapalı hedefleri, hedefte sabitlenen owner SSM assignment | Resmi giriş rep×ay×kanal; SSM ve şirket hedefi bağlı rep hedeflerinin exact toplamıdır. | SSM/şirket ayrıca elle girilip çatışamaz; hiyerarşi değişikliği hedefi sessiz taşımaz; eksik rep hedefi coverage'da kalır. |
| `TGT-008 monthly_sellout_performance` | `APPROVED_ACTIVE` | org × kanal × ay × as-of | `ACT-004`, `TGT-001..004/007`, coverage | Brüt/iade/ters/net, hedef, `actual/target`, remaining ve over-target tek run'da; üst seviye oran ham toplamdan yeniden hesaplanır. | Eksik/0 hedefte oran NULL; partial source/classification/organization kapsamı açık durumdur. |
| `FCST-001 daily_actual_demand` | `APPROVED_ACTIVE` | aile × kanal × gün | `ACT-004`, kaynak kapsam takvimi | Net talep. Kapsam tam ve satış yoksa `0`; kaynak eksikse NULL. | Sıfır ile veri yok ayrıdır. |
| `FCST-002 demand_pattern_class` | `APPROVED_ACTIVE` | aile × kanal × model kesimi | ADI, CV², mevsimsellik, geçmiş | `regular`, `seasonal`, `intermittent`, `new/insufficient`. | Sınıf model seçim girdisi. |
| `FCST-003 selected_model` | `APPROVED_ACTIVE` | aile × kanal × model sürümü | Rolling-origin aday sonuçları | Operasyonel hata/bias/stockout-fazla stok dengesine göre seçilen model/pencere. | Tek model bütün ailelere zorlanmaz. |
| `FCST-004 baseline_daily_path` | `APPROVED_ACTIVE` | aile × kanal × gelecek gün | `FCST-002..003`, takvim | Seçilen modelin yakın dönem, hafta günü, ay içi ve doğrulanmış olay etkili günlük tahmini. | Bilinmeyen etkinlik için çarpan uydurulmaz. |
| `FCST-005 expected_to_date` | `APPROVED_ACTIVE` | aile/kanal × ay × as-of | Tarihsel ay içi kümülatif eğri | `aylık taban × kesim gününe tarihsel kümülatif oran`. | Düz gün oranı kullanılmaz. |
| `FCST-006 deviation_rate` | `APPROVED_ACTIVE` | aile × kanal × as-of | Gerçekleşen + `FCST-005` | `(actual_to_date - expected_to_date) / expected_to_date`. | Beklenen 0 ise NULL. |
| `FCST-007 concentration_features` | `APPROVED_ACTIVE` | aile × kanal × yakın pencere | Belge/müşteri/gün olayları | En büyük fatura ve müşteri payı, benzersiz belge/müşteri/gün, normal fatura medyan-MAD/yüzdelik karşılaştırması. | Tek müşteri/tek fatura tamamen gerçekleşene girer. |
| `FCST-008 continuation_confidence` | `APPROVED_ACTIVE` | aile × kanal × kesim | `FCST-006..007`, tekrar/yayılım | Sürümlü açıklanabilir `0..1` güven skoru. | KA'da FKNS değil yükleme/sipariş/müşteri yayılımı. |
| `FCST-009 sudden_demand_effect` | `APPROVED_ACTIVE` | aile × kanal × kalan ay | Son hız, taban, `FCST-008` | Taban üzerindeki devam edebilir ek talep × devamlılık güveni. | Sabit `%50` patlama kuralı yok. |
| `FCST-010 dynamic_month_end` | `APPROVED_ACTIVE` | aile × kanal × ay | Taban, gerçekleşen, `FCST-009` | Tarihsel taban tahmini + güven ağırlıklı ani etki; cari gerçekleşmenin altına düşmez. | Bileşenler ayrı saklanır. |
| `FCST-011 dynamic_remaining` | `APPROVED_ACTIVE` | aile × kanal × ay | `FCST-010`, cari aile gerçekleşmesi | `max(0, dynamic_month_end - current_family_actual)`. | — |
| `FCST-012 effective_remaining` | `APPROVED_ACTIVE` | aile × kanal × ay | `TGT-006`, `FCST-011` | `max(target_based_remaining, dynamic_remaining)`. | Hedef eksikse politika gereği dinamik yol ayrıca gösterilir; resmi birleşim durumu açıklanır. |
| `FCST-013 target_gap` | `APPROVED_ACTIVE` | aile × kanal × ay | `TGT-006`, `FCST-011` | `max(0, target_based_remaining - dynamic_remaining)`. | — |
| `FCST-014 effective_daily_demand` | `APPROVED_ACTIVE` | aile × kanal × gelecek gün | `FCST-004`, `FCST-013`, kalan-gün ağırlığı | `dynamic_daily + target_gap × normalized_remaining_day_weight`. | Hedef dinamik yolu azaltmaz. |
| `FCST-015 combined_daily_demand` | `APPROVED_ACTIVE` | aile × gelecek gün | `FCST-014` | `Geleneksel etkin günlük + KA etkin günlük`. | Kanal katkıları ayrı korunur. |
| `FCST-016 forecast_interval` | `OPTIONAL_DRAFT` | aile × kanal × gelecek gün/ufuk | Model hata dağılımı | Seçili quantile/güven düzeyinde alt-üst talep. | Güven düzeyi ve model sürümü zorunlu. |
| `FCST-017 MAE` | `OPTIONAL_DRAFT` | aile × kanal × model sürümü | Rolling-origin gerçek/tahmin | `mean(abs(actual-forecast))`. | Eksik günler dışarı, doğrulanmış sıfırlar içeride. |
| `FCST-018 WAPE` | `APPROVED_ACTIVE` | aile × kanal × model sürümü | Aynı | `Σabs(actual-forecast)/Σabs(actual)`. | Payda 0 ise NULL. |
| `FCST-019 bias` | `APPROVED_ACTIVE` | aile × kanal × model sürümü | Aynı | `Σ(forecast-actual)/Σactual`. | Payda 0 ise NULL. |
| `FCST-020 RMSE` | `OPTIONAL_DRAFT` | aile × kanal × model sürümü | Aynı | `sqrt(mean((actual-forecast)^2))`. | — |
| `FCST-021 interval_coverage` | `OPTIONAL_DRAFT` | model sürümü | Gerçek + alt/üst | Gerçeğin aralıkta kaldığı kesim oranı. | — |
| `FCST-022 pinball_loss` | `OPTIONAL_DRAFT` | quantile model sürümü | Gerçek + quantile tahmin | Standart quantile pinball loss. | — |
| `FCST-023 naive_gain` | `OPTIONAL_DRAFT` | model sürümü | Seçilen hata + naif hata | `(naive_error - model_error) / naive_error`. | Naif hata 0 ise NULL. |

## 8. Günlük stok, projeksiyon ve stok günü matrisi

| ID | Durum | Seviye | Bağımlılık | Hesap | Özel politika |
|---|---|---|---|---|---|
| `STK-001 active_current_stock_import` | `APPROVED_ACTIVE` | bayi/depo | Malzemeler yüklemesi | Son başarıyla yayımlanan tek aktif tam stok kümesi; yeni yayın eskisinin tamamının yerini atomik alır. | Önceki stok satırları tarihçe/metrik için saklanmaz; hatalı yeni yükleme aktifi bozmaz. |
| `STK-002 current_stock_age` | `APPROVED_ACTIVE` | aktif yükleme | `as_of - loaded_at` | Gün/saat cinsinden son başarılı yükleme yaşı. | Kaynakta stok tarihi yoksa Europe/Istanbul yükleme zamanı; eşik sürümlü. |
| `STK-003 variant_available_litres` | `APPROVED_ACTIVE` | aktif yükleme × varyant | `STK-001`, `PRD-006` | `Tahditsiz kullanılabilir miktar × active_lpu`. | Sistem Sellout/KA ile gerçek stoğu azaltmaz. |
| `STK-004 family_available_litres` | `APPROVED_ACTIVE` | aktif yükleme × aile | `STK-003`, aile eşleme | Doğrulanmış varyant litrelerinin toplamı. | Ham 6'lı/12'li miktarlar doğrudan toplanmaz; alış/transfer/iade/inbound eklenmez. |
| `STK-005 stock_position` | `APPROVED_ACTIVE` | aktif yükleme × aile | `STK-004` | Son başarılı Malzemeler yüklemesinin kullanılabilir aile stok litresi. | Ticari Stok, ayrılmış/backorder/inbound dahil değildir. |
| `STK-006 stock_import_replacement` | `APPROVED_ACTIVE` | yeni Malzemeler yüklemesi | staging doğrulamaları, `STK-001` | Kritik kontroller geçerse tek transaction ile eski aktif küme kapanır/yeni küme açılır; aksi halde rollback ve eski aktif korunur. | Append/upsert geçmişi ve kısmi yayın yasaktır. |
| `STK-006A historical_stock_difference` | `PASSIVE_BY_POLICY` | aile × iki yükleme | Önceki stok değerleri | Kullanıcı kararıyla stok satır geçmişi tutulmadığı için hesaplanmaz. | AI geçmiş stok değişimi iddiası kuramaz. |
| `STK-007 projected_stock_daily` | `APPROVED_ACTIVE` | aile × gelecek gün | `STK-005`, `FCST-015` | `projected(d)=projected(d-1)-effective_demand(d)`. | Tahmin serisidir, gerçek snapshot değildir; inbound yok. |
| `STK-008 stockout_date` | `APPROVED_ACTIVE` | aile × kesim | `STK-007` | Projeksiyonun ilk `≤0` günü. | Ufukta yoksa `NOT_WITHIN_HORIZON`. |
| `STK-009 stock_days_exact` | `APPROVED_ACTIVE` | aile × kesim | `STK-007..008` | Tam günler + `önceki gün kalan litre / tükenme gününün talebi`. | Kesin decimal; talep yoksa “hesaplanamadı”, `400/sonsuz` değil. |
| `STK-010 stock_days_display` | `APPROVED_ACTIVE` | aile × kesim | `STK-009` | Kullanıcı gösterim kuralı ayrıca konfigüre edilir. | Hesap değerini değiştirmez. |
| `STK-011 no_depletion_in_horizon` | `APPROVED_ACTIVE` | aile × kesim | `STK-007` | Ufuk boyunca pozitifse ör. `>365 gün / ufukta tükenmiyor`. | 365 kesin stok günü değildir. |
| `STK-012 active_import_cutoff_effect` | `APPROVED_ACTIVE` | aktif yükleme | Kesim türü/saat | Gün sonuysa projeksiyon tüketimi ertesi gün; gün içiyse kalan gün parçasından başlar. | Aynı gün satışı iki kez düşmez. |
| `STK-013 stock_without_demand` | `APPROVED_ACTIVE` | aile × kesim | Stok var, tahmin yok | `talep geçmişi yok / stok günü hesaplanamadı`. | Ürün rapordan düşmez. |
| `STK-014 unexplained_stock_change` | `PASSIVE_BY_POLICY` | aile × yükleme aralığı | Önceki aktif değerler + hareketler | Önceki değerler ve hareket defteri tutulmadığı için hesaplanmaz. | Talep geri test metriği değildir. |
| `STK-015 current_stock_variant_quantity` | `APPROVED_ACTIVE` | aktif yükleme × varyant | `Tahditsiz kullanılabilir` | Kaynak kesin decimal miktarı, kendi `quantity_uom`uyla aynen korunur. | Farklı varyant/UOM miktarları toplanmaz; negatif/boş geçersiz, sıfır geçerli. |
| `STK-016 current_stock_known_litres` | `APPROVED_ACTIVE` | aktif yükleme × aile/şirket | `STK-003`, yalnız çözülen pozitif varyantlar | `Σ doğrulanmış varyant litresi`; eksik dönüşüm varken yalnız açık “bilinen litre” ara toplamıdır. | Kesin toplam diye sunulamaz ve eksik kısım sıfır değildir. |
| `STK-017 current_stock_completeness` | `APPROVED_ACTIVE` | aktif yükleme × aile/şirket | `STK-015`, aile ve LPU resolution | Pozitif stoklu bütün satırlar aile+LPU çözüldüyse `COMPLETE`, aksi halde `PARTIAL`; eksik kod/miktar ayrı. | `COMPLETE` değilse resmî toplam NULL; sıfır miktarlı eksik LPU etkiyi eksik yapmaz. |
| `STK-018 current_stock_publish_delta_check` | `APPROVED_ACTIVE` | yayın önizlemesi | yeni staging + o anda aktif aggregate | Varsayılan warning: kod sayısında mutlak `%20+` veya karşılaştırılabilir bilinen litrede `%30+` değişim. | Sürümlü warning, blokaj/stock-trend değildir; eski satır geçmişi saklanmaz. |

### Ticari Stok — müşteride kalan ürün raporu

| ID | Durum | Seviye | Bağımlılık | Hesap | Özel politika |
|---|---|---|---|---|---|
| `CST-001 active_commercial_stock_import` | `APPROVED_ACTIVE` | bayi | Ticari Stok Excel yüklemesi | Son başarıyla yayımlanan tam ticari stok kümesi; yeni geçerli dosya eskisinin tamamının yerini atomik alır. | Malzemeler/Anlık Stoktan tamamen ayrıdır; geçmiş satır trendi tutulmaz. |
| `CST-002 commercial_stock_natural_key` | `APPROVED_ACTIVE` | ticari stok satırı | Belge Numarası, Müşteri No, Malzeme Kodu | `bayi + belge + müşteri + malzeme`; mükerrer/çelişki karantina veya manuel inceleme. | Örnekte 5.869 satırda doğal anahtar tekrarı `0`. |
| `CST-003 remaining_quantity` | `APPROVED_ACTIVE` | belge × müşteri × malzeme | `Depoda Kalan Mk.` | Kaynak miktar aynen korunur; negatif veya litreyle işaret/kapsam çelişkisi DQ. | Yalnız aynı malzeme/varyant içinde toplanabilir; farklı ürünlerde genel koli toplamı yapılmaz. |
| `CST-004 remaining_litres` | `APPROVED_ACTIVE` | belge × müşteri × malzeme | `Depoda Kalan Lt.` | Kaynak litre aynen korunur; varsayılan aktif rapor `>0`. | Ticari Stok raporunun ana toplama ölçüsü. |
| `CST-005 ignored_source_measures` | `APPROVED_ACTIVE` | kaynak satırı | Sevk Edilmiş Mik./Lt., Toplam Mik./Lt. | Normalize modele ve hiçbir hesap/rapor/AI aracına alınmaz. | Sell-through, toplam-sevk farkı ve türetilmiş kalan hesaplanmaz. |
| `CST-006 customer_commercial_stock` | `APPROVED_ACTIVE` | müşteri | `CST-004` | `Σ kalan litre`; benzersiz kalan ürün ve belge sayısı ayrıca. | Müşteri durumu pasif/iptal olsa da fiziksel kalan stok görünür. |
| `CST-007 product_commercial_stock` | `APPROVED_ACTIVE` | malzeme/ürün ailesi | `CST-003/004`, ürün eşleme | `Σ kalan litre`, benzersiz stoklu müşteri/belge; miktar yalnız aynı varyantta. | Paket birleştirme rapor filtresi olabilir, kaynak satırı korunur. |
| `CST-008 responsibility_commercial_stock` | `APPROVED_ACTIVE` | müşteri→temsilci→SSM | `CST-004`, Master hiyerarşisi | Alt satırların ham kalan litre toplamı; oran ortalaması yok. | Dosya temsilcisi provenance/DQ; resmi sorumluluk Master. |
| `CST-009 commercial_stock_concentration` | `APPROVED_ACTIVE` | şirket/temsilci/SSM | `CST-006..008` | En yüksek müşteri/ürün katkıları ve toplam litre payı; ör. top-N/HHI isteğe bağlı. | Neden değil yoğunlaşma sinyali; ana değer litre. |
| `CST-010 inactive_customer_stock` | `APPROVED_ACTIVE` | pasif/iptal müşteri | `CST-006`, müşteri durumu | Pasif/iptal müşteride pozitif kalan litre ve ürünler. | Finansal bakiye veya Sellout değildir; operasyonel geri toplama/kontrol sinyali. |
| `CST-011 commercial_stock_source_coverage` | `APPROVED_ACTIVE` | yükleme | zorunlu alanlar/eşlemeler | Satır, müşteri, ürün, temsilci-Master eşleşme ve geçerli kalan litre coverage'ı. | Eksik kimlik/tutar sıfır kabul edilmez. |
| `CST-012 commercial_stock_regression_totals` | `APPROVED_ACTIVE` | örnek `Ürünler.xlsx` | gerçek veri testi | 5.869 satır; 426 pozitif satır, 103 belge, 81 müşteri, 38 ürün, 8 dosya temsilcisi; `12.800 Mk.` ve `151.185,59 L` kaynak kontrolü. | Genel miktar KPI değildir; yalnız parser kontrol toplamıdır. |
| `CST-013 warehouse_stock_exclusion` | `APPROVED_ACTIVE` | tüm stok/ikmal hesapları | `CST-*`, `STK-*` | Ticari Stok hiçbir `STK-003..014`, güvenlik stoğu, stok günü veya sipariş ihtiyacı girdisi olamaz. | Yalnız ayrı rapor/AI bağlamı. |

## 9. Güvenlik stoğu ve kritik eşik matrisi

Bu bölüm karar dosyasındaki Bölüm 18 ile onaylanmıştır.

| ID | Durum | Seviye | Bağımlılık | Hesap | Özel politika |
|---|---|---|---|---|---|
| `SS-001 protection_horizon_days` | `APPROVED_ACTIVE` | aile × geçerlilik dönemi | Kullanıcı konfigürasyonu | Genel varsayılan veya aile istisnası `H`. | Gerçek tedarik süresiymiş gibi türetilmez. |
| `SS-002 protection_demand` | `APPROVED_ACTIVE` | aile × kesim | `SS-001`, `FCST-015` | `Σ effective_daily_demand(t+1..t+H)`. | Geleneksel+KA ailede birleşir. |
| `SS-003 cumulative_forecast_error` | `APPROVED_ACTIVE` | aile × geçmiş kesim | Rolling-origin, `H` | `E_H=actual_H-forecast_H`. | Olay işaretli ve düzeltilmiş seri ayrı saklanabilir. |
| `SS-004 quantile_safety_stock` | `APPROVED_ACTIVE` | aile × kesim | `SS-003`, servis quantile | `max(0,Q_service(E_H))`. | Yeterli temsili örnek gerekir. |
| `SS-005 days_buffer_safety_stock` | `APPROVED_ACTIVE` | aile × kesim | Günlük talep yolu, tampon gün | Tampon gün içindeki günlük talep toplamı. | Yalnız geri düşme/alternatif. |
| `SS-006 normal_safety_stock` | `OPTIONAL_DRAFT` | aile × kesim | Hata sigma, H, z | `z × sigma_error × sqrt(H)`. | Kararda varsayılan değil. |
| `SS-007 active_safety_stock` | `APPROVED_ACTIVE` | aile × kesim | Aktif yöntem + geri düşme | Quantile; yetersizde benzer grup → tampon gün → manuel. | Geri düşme yoksa NULL; yalnız açıkça kapatılırsa 0. |
| `SS-008 critical_threshold` | `APPROVED_ACTIVE` | aile × kesim | `SS-002`, `SS-007` | `koruma süresi talebi + aktif SS`. | Fiziksel stok değildir. |
| `SS-009 safety_threshold_date` | `APPROVED_ACTIVE` | aile × kesim | `STK-007`, `SS-007` | Projeksiyonun ilk `≤SS` günü. | Tükenme tarihinden ayrıdır. |
| `SS-010 critical_threshold_date` | `APPROVED_ACTIVE` | aile × kesim | `STK-007`, `SS-008` | Projeksiyonun ilk `≤kritik eşik` günü. | Yeniden sipariş/acıliyet sinyali. |
| `SS-011 safety_stock_days` | `APPROVED_ACTIVE` | aile × kesim | `SS-009` | Bugünden SS eşiğine kadar tam + kesirli gün. | Fiziksel stok gününden ayrı. |
| `SS-012 critical_days` | `APPROVED_ACTIVE` | aile × kesim | `SS-010` | Bugünden kritik eşiğe kadar tam + kesirli gün. | — |
| `SS-013 service_failure_rate` | `APPROVED_ACTIVE` | yöntem × aile/grup | Geri test simülasyonu | Koruma süresinde talebi karşılayamayan kesim / toplam geçerli kesim. | Yöntem seçiminde ana çıktı. |
| `SS-014 excess_inventory_litre_days` | `APPROVED_ACTIVE` | yöntem × aile/grup | Geri test projeksiyonu | Seçili üst seviyenin üzerindeki günlük litrelerin toplamı. | Servis-stok dengesi için. |

## 10. İhtiyaç, sipariş ve risk matrisi

| ID | Durum | Seviye | Bağımlılık | Hesap | Özel davranış |
|---|---|---|---|---|---|
| `REQ-001 combined_effective_remaining` | `APPROVED_ACTIVE` | aile × planlama kesimi | Kanal `FCST-012` | `Σ kanal etkin kalan talebi`. | Ortak aile stoğu bir kez düşülür. |
| `REQ-002 gross_target_stock_need` | `APPROVED_ACTIVE` | aile × kesim | `REQ-001`, aktif SS, onaylı ek koruma | `etkin planlama talebi + SS + onaylı ek koruma`. | Planlama ufku H'yi kapsıyorsa koruma talebi ikinci kez eklenmez. |
| `REQ-003 shortage_excess_litres` | `APPROVED_ACTIVE` | aile × kesim | `REQ-002`, `STK-005` | `need-stock`; pozitif eksik, negatif fazla. | İki ayrı gösterim alanı üretilebilir. |
| `ORD-001 net_order_litres` | `APPROVED_ACTIVE` | aile × kesim | `REQ-002`, `STK-005` | `max(0,gross_need-stock_position)`. | Inbound düşülmez. |
| `ORD-002 raw_package_quantity` | `APPROVED_ACTIVE` | aile × ikmal varyantı | `ORD-001`, lpu | `net_order_litres/lpu(replenishment_variant)`. | Kesin decimal. |
| `ORD-003 rounded_package_quantity` | `APPROVED_ACTIVE` | aile × ikmal varyantı | `ORD-002` | `ceil(raw_package_quantity)`. | Sipariş miktarı tam pakete çıkar. |
| `ORD-004 moq_quantity` | `BLOCKED_SOURCE` | aile/tedarik rotası | `ORD-003`, MOQ | `max(rounded_qty,MOQ)` ve sipariş katına yukarı yuvarlama. | MOQ/kademe kaynağı yok. |
| `ORD-005 final_order_litres` | `APPROVED_ACTIVE` veya MOQ bağımlı | aile × karar | Nihai miktar + lpu | `final_quantity × lpu`. | MOQ kapalıysa `ORD-003` miktarı. |
| `ORD-006 rounding_excess_litres` | `APPROVED_ACTIVE` | aile × karar | `ORD-001`, `ORD-005` | `final_order_litres-net_order_litres`. | — |
| `RISK-001 stockout` | `APPROVED_ACTIVE` | aile × kesim | `STK-005/007` | Mevcut veya projekte stok `≤0`. | Açıklanabilir neden kodu. |
| `RISK-002 below_safety_stock` | `APPROVED_ACTIVE` | aile × kesim | `STK-005`, `SS-007` | `stock_position≤SS`. | Fiziksel tükenmeden ayrı risk. |
| `RISK-003 below_critical_threshold` | `APPROVED_ACTIVE` | aile × kesim | `STK-005`, `SS-008` | `stock_position≤critical_threshold`. | — |
| `RISK-004 order_required` | `APPROVED_ACTIVE` | aile × kesim | `ORD-001` | `net_order_litres>0`. | Neden bileşenleri gösterilir. |
| `RISK-005 excess_stock` | `OPTIONAL_DRAFT` | aile × kesim | Üst seviye + stok | Stok seçili planlama/maksimum üst seviyesini aşıyor. | Üst seviye konfigürasyonu gerekir. |
| `RISK-006 slow_stock` | `OPTIONAL_DRAFT` | aile × kesim | Talep hızı + stok günü | Sürümlü düşük talep/yüksek kapsama eşiklerinin birlikte sağlanması. | Sabit eşik uydurulmaz. |
| `RISK-007 dead_stock` | `OPTIONAL_DRAFT` | aile × kesim | Talep geçmişi + stok | Onaylı süre boyunca talep yok ve stok var. | Süre konfigürasyonu gerekir. |
| `RISK-008 stale_stock_data` | `APPROVED_ACTIVE` | aktif Malzemeler yüklemesi/aile | `STK-002` | Son başarılı yükleme yaşı aktif eşiği aşar. | Yükleme zamanı gösterilir; önceki günlük stok üretilmez. |

## 11. Kaynağı/politikası pasif stok metrikleri

| ID grubu | Durum | Metrikler | Açılma koşulu |
|---|---|---|---|
| `INB-*` | `PASSIVE_BY_POLICY` | Açık sipariş litresi, kesin inbound, ETA, geciken inbound, zamanında kullanılabilir inbound, inbound güven katsayısı | Kullanıcı alış/yoldaki stok takibini açıkça etkinleştirir ve kaynak sağlar. |
| `RES-*` | `BLOCKED_SOURCE` | Ayrılmış stok, backorder, net kullanılabilir stok | Rezervasyon/backorder kaynağı sağlanır ve kapsam kuralı onaylanır. |
| `LOT-*` | `BLOCKED_SOURCE` | Yaşlanan stok, SKT riski, parti bazlı tüketim | Parti, üretim/SKT ve miktar kaynağı sağlanır. |
| `SUP-*` | `PASSIVE_BY_POLICY` | Gerçek tedarik süresi, P50/P80/P95, zamanında teslim oranı, gecikme riski | Sipariş ve depo giriş hareket geçmişi izlenmeye başlanır. |

## 12. Finansal hesaplama matrisi

Sellout TL hiçbir satırda finansal kaynak değildir. Belge geçerliliği, iptal eşleştirmesi, tahsilat/devir/virman, FIFO, aging ve temel finansal performans kuralları onaylanmıştır. Bir sonuç yalnız kendi satırındaki kaynak, coverage ve mutabakat kapıları sağlanırsa resmî olarak çalıştırılır.

| ID | Durum | Seviye | Aday kaynak | Hesap sözleşmesi / mevcut sınır |
|---|---|---|---|---|
| `FIN-000 normalized_invoice_customer` | `APPROVED_ACTIVE` | fatura satırı | `Cari Kodu`, `Cari Kodu 2` | Birebir `500...` kodu taşıyan alan; ikisi de farklı 500 koduysa DQ/manual. |
| `FIN-001 invoice_candidate` | `APPROVED_ACTIVE` | fatura | Satış Faturaları | `Tip=SATIS`, geçerli `500...` müşteri, geçerli Fatura Tarihi ve sayısal vergi dahil Satış Tutarı. Aktarım `Durum` alanı kullanılmaz. |
| `FIN-001A cancellation_pair` | `APPROVED_ACTIVE` | CREATED↔CANCELLED belge çifti | EDOCUMENTNO, müşteri, sipariş, tutar, durum | Her yüklemede yeni+geçmiş üzerinde önce aynı `EDOCUMENTNO+müşteri`; sipariş/vergi dahil tutar/tip/tarih doğrulama. Benzersiz değilse DQ/manual. EDOCUMENTNO yoksa benzersiz müşteri+sipariş+tutar geri düşmesi. |
| `FIN-001B cancellation_validation_run` | `APPROVED_ACTIVE` | veri yükleme çalışması | Ham fatura yüklemesi + tüm fatura geçmişi | Aday, eşleşen çift, eşleşmeyen CANCELLED, çoklu aday ve etkilenen CREATED sayı/tutarı; başarısızsa yükleme `validation_failed`. |
| `FIN-001C valid_sales_invoice` | `APPROVED_ACTIVE` | fatura | `FIN-001`, `FIN-001A` | `Fatura Durum=CREATED` ve cancellation çifti yok. `Durum` aktarım alanı görmezden gelinir. Eşleşen CREATED ve CANCELLED birlikte geçersizdir. |
| `FIN-001D visible_sales_invoice` | `APPROVED_ACTIVE` | fatura | `FIN-001C` | Yalnız geçerli faturalar. İptal grubu standart rapor, ekstre, dışa aktarım ve normal AI listesinde görünmez. |
| `FIN-002 financial_revenue` | `APPROVED_ACTIVE` | müşteri × dönem | `FIN-001C` | Geçerli müşteri faturalarının vergi dahil `Satış Tutarı` toplamı. Vergi ikinci kez eklenmez; Sellout TL kesinlikle dışarıda. |
| `COLL-001 collection_candidate` | `APPROVED_ACTIVE` | tahsilat belgesi | Nakit/Havale/Çek/Senet | Geçerli 500 müşteri, belge no, işlem tarihi, pozitif tutar, para birimi, yöntem ve CREATED/CANCELLED tipi. Belgeler kaynağı dahil değildir. |
| `COLL-000 official_collection_source_contract` | `APPROVED_ACTIVE` | yükleme × source kind | Nakit/Havale/Çek/Senet exact başlık imzaları | `OFFICIAL_CASH/TRANSFER/CHECK/NOTE` yükleme girişinde immutable seçilir ve exact yöntem kolonlarıyla doğrulanır. Dosya adı/Aktarıldı/eşleşme source kind değildir; yanlış kart publish olmaz. |
| `COLL-002 collection_natural_key` | `APPROVED_ACTIVE` | tahsilat belgesi | Yöntem + belge no | `collection_method + source_document_no`; yeniden yüklemede idempotent upsert. Aynı anahtarda kaynak içeriği değişirse manuel-kaynak çatışması açılır. |
| `COLL-002A collection_source_revision` | `APPROVED_ACTIVE` | doğal anahtar × kaynak sürümü | geçmiş ve yeni resmî yüklemeler | Aynı içerik idempotent; müşteri/tarih/tutar/currency/status/yöntem detayı değişirse immutable revision conflict. Yeni dosyada yokluk silme değildir; kaynak full-replace olmaz. |
| `COLL-003 collection_cancellation_pair` | `APPROVED_ACTIVE` | CREATED↔CANCELLED tahsilat | Ters kayıt referansı veya yöntem/müşteri/tutar/tarih + yöntem detayı | Her yüklemede geçmiş dahil kontrol; tek güvenli aday yoksa manual. Eşleşen iki kayıt geçersiz ve görünmez. |
| `COLL-003A collection_publication_gate` | `APPROVED_ACTIVE` | import validation run | contract/customer/decimal/revision/cancellation/settlement/note checks | Eşleşmeyen veya çoklu cancellation, source conflict ya da blocking instrument issue varsa batch publish atomik olarak durur; önceki resmî görünüm korunur. |
| `COLL-004 valid_collection` | `APPROVED_ACTIVE` | tahsilat | `COLL-001..003` | İptal grubunda olmayan geçerli CREATED olay. Aktarım durumu alanı kullanılmaz. |
| `COLL-005 collection_amount` | `APPROVED_ACTIVE` | müşteri/yöntem/org × dönem | `COLL-004`, `COLL-012`, `COLL-018..021` | `Σ geçerli CREATED yüz değeri - Çek kapaması olarak sınıflanan Havale`; Çek kapaması cariyi ve tahsilat performansını ikinci kez etkilemez. Senet iade/karşılıksız adayı kullanıcı kararı olmadan toplamı değiştirmez; onaylı disposition etkisi kendi sınıfıyla uygulanır. |
| `COLL-006 cash_bank_effective_date` | `APPROVED_ACTIVE` | nakit/normal havale/IADE/HIZMET | Kaynak `Fatura Tarihi` | Normalize `transaction_date`; müşteri borcunu azaltma tarihi. Çek kapama Havalesi hariç. |
| `COLL-007 instrument_acceptance_date` | `APPROVED_ACTIVE` | çek/senet | Kaynak `Fatura Tarihi` | Müşteri borcunu azaltma ve aynı yüz değerde portföy riskini açma tarihi. |
| `COLL-008 instrument_due_date` | `APPROVED_ACTIVE` | çek/senet | `Vade Tarihi` | Araç vade/risk takvimi; müşteri fatura aging tarihi değildir. |
| `COLL-009 instrument_portfolio_exposure` | `APPROVED_ACTIVE` | müşteri/araç × as-of | Geçerli çek/senet + ödeme/iptal/onaylı disposition | Kabulden ödeme/iptal/onaylı kapanış tarihine kadar açık yüz değeri; cariyi ikinci kez etkilemez. |
| `COLL-010 bank_check_account_cluster` | `APPROVED_ACTIVE` | hesap no ilişki kümesi | `Havale.Hesap No = Çek.Çek Hesap No` | Aynı banka/çek hesabına bağlı Havale ve Çek kayıtlarını kümeler. Tekil olay anahtarı veya otomatik mükerrer kararı değildir. |
| `COLL-011 cross_method_double_count_risk` | `APPROVED_ACTIVE` | hesap kümesi × dönem | `COLL-010`, müşteri/tarih/tutar/belge bağları | Aynı ekonomik olay olasılığını aday/güven skoru ve manuel inceleme ile gösterir; yalnız `COLL-012`nin kesin benzersiz eşleşmesi finansal kapama üretir, diğer adaylar hareket silmez. |
| `COLL-012 check_settlement_match` | `APPROVED_ACTIVE` | geçerli Havale ↔ açık Çek | `Havale.Hesap No = Çek.Çek Hesap No` ve kesin `Havale.Tutar = Çek.Tutar` | Tek benzersiz, aynı para birimli, iptalsiz ve kronolojik aday bağlanır; çoklu aday manual. |
| `COLL-013 check_paid_status` | `APPROVED_ACTIVE` | çek × as-of | `COLL-012` | Geçerli kapama varsa `PAID`, ödeme tarihi Havale işlem tarihi; bu tarihten sonra çek portföy riskinden düşer. |
| `COLL-014 hidden_check_settlement_transfer` | `APPROVED_ACTIVE` | Havale hareketi | `COLL-012` | Müşteri cari/tahsilat etkisi `0`; ekstre, normal Havale listesi, dashboard ve AI normal dökümünde görünmez; denetimde korunur. |
| `COLL-015 settlement_reversal` | `APPROVED_ACTIVE` | kapama bağlantısı × yeni veri kesimi | Havale/Çek iptal veya manuel geçersiz kılma | Bağlantıyı geri alır; başka kapama yoksa Çek yeniden riskte olur. |
| `COLL-016 note_return_bounced_candidate` | `APPROVED_ACTIVE` | Senet iade belgesi | Senet kaynağında doğrulanmış `180...` iade/karşılıksız aday türü | İşlem tarihi/tutarı korur; kullanıcı kararı olmadan tahsilat, bakiye veya risk etkisi üretmez. |
| `COLL-017 note_original_candidates` | `APPROVED_ACTIVE` | iade adayı ↔ orijinal Senet adayları | Önce aynı Senet No; müşteri+tutar+para birimi doğrulama | Adayları ve güveni kullanıcıya sunar; tek adayda dahi finansal işlem sonucu onay bekler. |
| `COLL-018 note_disposition_decision` | `APPROVED_ACTIVE` | iade adayı × kullanıcı kararı | `COLL-016..017` | Bakiyeye ekle, bakiyeden düş, bakiye yok/riskte tut, ödendi, orijinalle birlikte sil, yalnız adayı dışla/sil. |
| `COLL-019 note_balance_effect` | `APPROVED_ACTIVE` | müşteri × karar tarihi | `COLL-018` | Kullanıcının ayrı seçtiği `INCREASE/DECREASE/NONE`; satış cirosu değildir ve karar yoksa 0 etki değil `PENDING`. |
| `COLL-020 net_note_collection` | `APPROVED_ACTIVE` | müşteri/org × dönem | Geçerli Senet kabulü + onaylı disposition etkileri | Kullanıcı kararında tahsilat etkisi verilen olaylarla hesaplanır; varsayılan otomatik iade düşümü yoktur. |
| `COLL-021 note_risk_effect` | `APPROVED_ACTIVE` | müşteri/Senet × as-of | `COLL-018` | Kullanıcı seçimine göre normal risk, karşılıksız risk, paid/closed veya geçersiz; karar yoksa son onaylı durum. |
| `COLL-022 note_statement_visibility` | `APPROVED_ACTIVE` | Senet olayı | `COLL-018` | Kullanıcı kararına göre görünür/gizli; silinen/geçersiz çift normal ekstrede görünmez. |
| `COLL-023 normal_collection_visibility` | `APPROVED_ACTIVE` | tahsilat olayı × kullanıcı yüzeyi | `COLL-003/004/012/014/018/022` | Normal liste/ekstre/export/AI yalnız geçerli görünür collection'ı taşır. İptal çifti, hidden Çek settlement Havalesi ve invalidated Senet çifti yalnız yetkili audit/detail'dedir. |
| `NOTEPRINT-001 print_source_amount` | `APPROVED_ACTIVE` | customer × selected source × as-of | 07A open order; optional 07B deferred/10 open invoice; manual proposal | Source kind/run/revision/result/currency/coverage pinlenir. Kalan borç bağlamdır; sipariş/manual tutar finansal gerçek değildir; source change stale preview. |
| `NOTEPRINT-002 exact_minor_unit_split` | `APPROVED_ACTIVE` | positive TRY minor units × count 1..12 | integer division | `total=q×n+r`; ilk n−1=q, son=q+r; parçalar pozitif ve exact toplam. `100,00/3=33,33+33,33+33,34`. |
| `NOTEPRINT-003 due_schedule` | `APPROVED_ACTIVE` | note parts × issue date × due dates | Europe/Istanbul + override policy | Her vade dolu, issue date'ten önce değil, sıra azalmıyor; eşit vade warning. Issue override capability+reason ister. |
| `NOTEPRINT-004 debtor_snapshot` | `APPROVED_ACTIVE` | customer Master revision | tabela/unvan/VKN-TCKN/adres/ilçe/il | Türkçe tekrar önleme ve adres tekilleştirme; zorunlu business alan eksikse yalnız EKSİK TASLAK, final yok. |
| `NOTEPRINT-005 approved_legal_template` | `APPROVED_ACTIVE` | issuer profile × legal template × validity | TTK m.776–777 karakterizasyonu + legal approval | Bono ibaresi, koşulsuz bedel vaadi, vade, ödeme yeri, lehtar, düzenlenme tarih/yeri, imza alanı; template hash/approval olmadan final yok. |
| `NOTEPRINT-006 amount_words_integrity` | `APPROVED_ACTIVE` | TRY minor units | deterministic Turkish number words | Rakam/yazı parse-back aynı minor unit; bitişik yazım ve Lira/Kuruş exact; overflow küçültülmez, bloke. |
| `NOTEPRINT-007 immutable_document_snapshot` | `APPROVED_ACTIVE` | group × note part × source/customer/template/renderer versions | content hash | Her note benzersiz id/no; generated yerinde değişmez, değişiklik superseded yeni revision/hash. |
| `NOTEPRINT-008 print_lifecycle_no_financial_effect` | `APPROVED_ACTIVE` | draft/preview/generate/print states | Paket 08 boundary | DRAFT/PREVIEWED/GENERATED/PRINT_REQUESTED/PRINT_CONFIRMED/SUPERSEDED/VOIDED hiçbir OFFICIAL_NOTE/cari/risk/FIFO/KPI etkisi üretmez. |
| `NOTEPRINT-009 original_copy_void` | `APPROVED_ACTIVE` | document × print event | actor/reason/sequence/original hash | İlk ORİJİNAL; reprint görünür KOPYA N; void fiziki imhayı garanti etmez ve reprint olamaz. Dialog yalnız requested, confirm ayrıdır. |
| `NOTEPRINT-010 official_note_link_candidate` | `APPROVED_ACTIVE` | print document ↔ official note | exact dealer/customer/draft no/amount/currency/due | Link yalnız provenance adayıdır; exact aday dahi acceptance değildir, Paket 08 resmî source tek otoritedir. |
| `NOTEPRINT-011 a5_pdf_render` | `APPROVED_ACTIVE` | immutable document snapshot × renderer version | server-side PDF | A5 landscape 210×148mm, margin0, padding8mm, note/page, no blank final, embedded Turkish font, grayscale-safe, no overflow. |
| `NOTEPRINT-012 artifact_audit_integrity` | `APPROVED_ACTIVE` | PDF artifact × print job/event | snapshot/content/artifact hashes | Preview/final aynı sayılar; generate idempotent/atomic, renderer failure safe; signed short-lived download ve retention policy. |
| `NOTEPRINT-013 privacy_rls` | `APPROVED_ACTIVE` | user × tenant/dealer/customer × artifact | capabilities + RLS | Source/preview/PDF/download/audit fail-closed; VKN/TCKN log/telemetry/AI'ya gereksiz sızmaz. |
| `NOTEPRINT-014 print_ui_accessibility` | `APPROVED_ACTIVE` | modal/preview/print surface | reference UX + accessibility | Lacivert modal, source/count/due cards, warning; keyboard/focus/Escape/mobile/screen reader ve print fallback; yalnız renkle anlam yok. |
| `NOTEPRINT-015 ai_print_boundary` | `APPROVED_ACTIVE` | eligibility/source/status/preview workflow | read descriptors + explicit confirmation | AI hukuk metni/tutar/vade/taraf değiştirmez, generate/print/reprint/void yapmaz; PRINT_CONFIRMED resmî kabul değildir. |
| `FIN-003 valid_collection` | `APPROVED_ACTIVE` | tahsilat | `COLL-004`, `FIN-004A..004C` | Finansal bakiye ve tahsilat dağıtımında kullanılan ortak resmî tahsilat olayı; IADE ve HIZMET ayrı sınıflar olarak dahildir. Çek kapama Havalesi ikinci kez girmez; Senet adayı yalnız onaylı kullanıcı disposition'ı kadar etki eder. |
| `FIN-004A purchase_file_type_router` | `APPROVED_ACTIVE` | Satın Alma dosyası satırı | `Tip` | `SATIN ALMA→SUPPLIER_IGNORED`, `IADE→CUSTOMER_RETURN_COLLECTION`, `HIZMET→CUSTOMER_SERVICE_COLLECTION`; tanımsız tip DQ/manual. |
| `FIN-004B valid_return_collection` | `APPROVED_ACTIVE` | müşteri IADE belgesi | Satın Alma dosyası | `Tip=IADE`, geçerli birebir `500...` müşteri, sayısal tutar, geçerli Fatura Tarihi, CREATED ve iptal/mükerrer grubunda değil. Aktarım Durum alanı kullanılmaz. Cariyi işlem tarihinde azaltır, tahsilat sayılır, ciro ve stok etkisi yoktur. |
| `FIN-004C valid_service_collection` | `APPROVED_ACTIVE` | müşteri HIZMET belgesi | Satın Alma dosyası | `Tip=HIZMET`, geçerli birebir `500...` müşteri, sayısal tutar, geçerli Fatura Tarihi, CREATED ve iptal/mükerrer grubunda değil. Aktarım Durum alanı kullanılmaz. Cariyi işlem tarihinde azaltır, tahsilat sayılır, ciro ve stok etkisi yoktur. |
| `FIN-004D supplier_purchase_ignored` | `APPROVED_ACTIVE` | SATIN ALMA belgesi | Satın Alma dosyası | `Tip=SATIN ALMA`; tedarikçi firma hareketi olduğu için müşteri cari, tahsilat, temsilci finansal performansı ve mevcut uygulama raporlarında finansal olay üretmez. Ham denetimde tutulabilir. |
| `FIN-004E purchase_file_cancellation_pair` | `APPROVED_ACTIVE` | IADE/HIZMET CREATED↔CANCELLED çifti | EDOCUMENTNO, müşteri, Tip, tutar, fatura no, tarih | Her yüklemede geçmiş dahil aktif kontrol; önce aynı EDOCUMENTNO+müşteri+Tip. Benzersiz değilse manual. Eşleşen iki kayıt ve önceki dağıtımları resmi hesaplardan çıkarılır. |
| `FIN-004F purchase_writeoff_source_contract` | `APPROVED_ACTIVE` | import × satır | Exact `Tip, Fatura Durum, Fatura No, EDOCUMENTNO, Cari Kodu, Cari Kodu2, Fatura Tarihi, Tutar` | Source kind immutable `PURCHASE_WRITEOFF`; exact tip yalnız `IADE/HIZMET/SATIN ALMA`. Dosya adı/fuzzy kolon ve `KREDI/DEKONT/ALACAK` fallback'i yoktur. | Eksik contract veya unknown tip finansal publish dışı DQ/review. |
| `FIN-004G credit_adjustment_source_identity` | `APPROVED_ACTIVE` | dealer × Tip × Fatura No × revision | `FIN-004F`, kanonik ekonomik alanlar | Aynı key+aynı içerik idempotent; değişen customer/date/amount/currency/EDOCUMENTNO/status immutable `SOURCE_REVISION_CONFLICT`. Aynı belge satır tutarları toplanmaz. | Çakışma çözülmeden ikinci cari azaltma yoktur. |
| `FIN-004H credit_adjustment_economic_class` | `APPROVED_ACTIVE` | geçerli event | `FIN-004A..004D` | IADE/HIZMET=`NONCASH_RETURN_SERVICE` ekonomik tahsilat ve cari azaltma; ayrı alt sınıf korunur. SATIN ALMA müşteri finansal etkisi `0`. | Nakit/likidite, ciro, Sellout, stok veya araç etkisi üretmez. |
| `FIN-004I credit_adjustment_batch_reconciliation` | `APPROVED_ACTIVE` | batch/run × Tip × currency | source, validation, cancellation, event sonuçları | `source=IADE+HIZMET+SATIN_ALMA+UNKNOWN`; uygun IADE/HIZMET ayrık olarak valid/cancel-pair/duplicate/conflict/invalid/pending kümelerine mutabık. Raw, etkisiz ve yayımlanan tutarlar ayrı. | Kayıp/çakışan satır veya tutar farkında publish bloklanır. |
| `FIN-004J credit_adjustment_fifo_eligibility` | `APPROVED_ACTIVE` | IADE/HIZMET event × Fatura Tarihi | `FIN-004B/C/E/H`, Paket 10 | Geçerli CREATED IADE/HIZMET etkin tarihinde debit-reducing FIFO event'tir; allocation sınıfı `NONCASH_RETURN_SERVICE`. İptal linki allocation replay/invalidation üretir. | Paket 10 yoksa allocation/kapama sonucu `BLOCKED_DEPENDENCY`; SATIN ALMA uygun değildir. |
| `FIN-004K credit_adjustment_payment_speed_effect` | `APPROVED_ACTIVE` | müşteri/org × 3/6/12 tamamlanmış ay × sınıf | `FIN-004J`, `FIN-022..030`, coverage | IADE/HIZMET allocation'ları ekonomik tahsilat gerçekleşme günü, gerçekten kapanan fatura kapama günü, aylık tahsilat ve tahsilat/fatura oranına girer; nakit dışı tutar/gün katkısı ayrı gösterilir. | Nakit-only hız IADE/HIZMET'i dışlar; SATIN ALMA bütün pay/payda/gün sonuçlarında 0 katkıdır. |
| `FIN-004 valid_credit_adjustment` | `APPROVED_ACTIVE` | müşteri × dönem × sınıf | `FIN-004B`, `FIN-004C` | `Σ geçerli IADE + Σ geçerli HIZMET`; iki sınıf ayrı raporlanır, toplam tahsilata dahil edilir, `FIN-002` ciroya ve fiziksel stoğa girmez. |
| `FIN-005 opening_balance_invoice` | `APPROVED_ACTIVE` | müşteri × ilk başlangıç yılı | Devir Bakiye + `initial_baseline_year` | Yalnız ilk başlangıç yılında pozitif devir bakiye `01-01` tarihli `OPENING_BALANCE_INVOICE` kaydıdır. Cari borcu artırır; FIFO, açık fatura, aging ve kapamaya girer. Yeniden yükleme aynı müşteri+başlangıç yılı kaydını çoğaltmaz. |
| `FIN-005A opening_balance_revenue_exclusion` | `APPROVED_ACTIVE` | devir faturası | `FIN-005` | Devir kaydı faturalama defterinde bulunur ancak ticari satış/ciro değildir; `FIN-002 financial_revenue`, Sellout, FKNS ve stok hareketi dışında kalır. |
| `FIN-005B opening_balance_share` | `APPROVED_ACTIVE` | müşteri/org × dönem | `FIN-005`, `FIN-008`, `FIN-026` | Fatura, açık bakiye, aging, allocation ve kapama sonuçlarında devir kaynaklı kayıt/tutar/pay ayrı açıklanır; AI ve rapor devir etkisini ticari satıştan ayırır. |
| `FIN-005C initial_negative_opening_ignored` | `APPROVED_ACTIVE` | müşteri × ilk başlangıç yılı | Negatif Devir Bakiye + `initial_baseline_year` | Finansal etki tam `0`; fatura, tahsilat, avans veya allocation oluşturmaz. Ham kayıt `INITIAL_NEGATIVE_OPENING_IGNORED` nedeniyle denetimde kalır. Yalnız ilk otomatik başlangıç aktarımında geçerlidir. |
| `FIN-005D continuous_year_rollover` | `APPROVED_ACTIVE` | müşteri × yıl sınırı | Önceki tüm geçerli olay/lot/allocation | Başlangıç yılından sonraki 1 Ocaklarda yeni devir kaydı veya sıfırlama yoktur; açık lotlar ve gerçek dağıtılmamış alacaklar orijinal tarihlerle devam eder. |
| `FIN-005E manual_debit_transfer` | `APPROVED_ACTIVE` | müşteri × belge tarihi | Manuel `DEVIR_BORC` | Pozitif tutarlı özel faturalama/açık borç olayı; cariyi artırır, FIFO/aging/kapamaya girer, satış/ciro ve satış performansına girmez. |
| `FIN-005F manual_credit_transfer` | `APPROVED_ACTIVE` | müşteri × belge tarihi | Manuel `DEVIR_ALACAK` | Pozitif tutarlı özel cari azaltan olay; FIFO'ya girer, artığı dağıtılmamış alacak olur. Gerçek tahsilat/likidite ve tahsilat performansı değildir. |
| `FIN-006 customer_balance` | `APPROVED_ACTIVE` | müşteri × as-of | `FIN-001,003,004,005..005F,033..036` | Geçerli satış/devir faturalama lotları eksi geçerli tahsilat ve özel alacak olayları. İlk negatif otomatik devir etkisi 0'dır. Virman lot sorumluluğunu taşır ve şirket toplamını değiştirmez. |
| `FIN-006A ledger_event_eligibility` | `APPROVED_ACTIVE` | yayımlanmış finansal event revision | Paket 07/08/09/11 adapter'ları | Yalnız tipli, geçerli, exact customer/currency/date/amount ve yayımlanmış revision deftere girer. TEMP Belgeler, Sellout, sipariş/sevkiyat, SATIN ALMA, settlement ikinci etkisi, iptal/conflict/pending kayıt dışarıdadır. Bilinmeyen sınıf tutar işaretinden yönlendirilmez; `BLOCKED_DQ`. |
| `FIN-006B ledger_currency_boundary` | `APPROVED_ACTIVE` | müşteri × currency × as-of | `FIN-006A` | Defter ve FIFO currency bazında ayrıdır. V1 resmî sonuç TRY'dir; başka currency kur kanıtı olmadan birleşmez ve `UNSUPPORTED_CURRENCY/BLOCKED_COVERAGE` olur. |
| `FIN-006C ledger_reconciliation` | `APPROVED_ACTIVE` | customer × currency × run; şirket × run | lot, allocation, azaltan event, unallocated credit, virman | `balance=open_lots−unallocated_credit`; lotta `principal=allocated+open`; azaltan olayda `amount=allocated+unallocated`; aging toplamı=open lots; virman şirket net=0. Açıklanamayan fark, orphan/fazla allocation, negatif open veya dengesiz virman publish'i bloklar. |
| `FIN-007 positive_debit_balance` | `APPROVED_ACTIVE` | müşteri × as-of | `FIN-006` | `max(0,customer_balance)`; alacaklı bakiye riskten mahsup edilmez; `CUS-006` kapsamını besler. |
| `FIN-019 cheque_exposure` | `APPROVED_ACTIVE` | müşteri × as-of | `COLL-007..009`, `COLL-012..015` | Kesim tarihinde kabul edilmiş ve henüz geçerli ödeme/iptal/kapanışla kapanmamış Çek yüz değerleri toplamı. |
| `FIN-020 note_exposure` | `APPROVED_ACTIVE` | müşteri × as-of | `COLL-007..009`, `COLL-016..021` | Kesim tarihinde açık Senet yüz değeri; iade/karşılıksız adayında son onaylı risk/disposition durumu. |
| `FIN-021 total_customer_exposure` | `APPROVED_ACTIVE` | müşteri × as-of | `FIN-007`, `FIN-019`, `FIN-020` | `max(0,cari bakiye) + açık Çek riski + açık Senet riski`; negatif cari bakiye araç riskini mahsup etmez. |
| `FIN-022 invoice_close_days` | `APPROVED_ACTIVE` | tamamen kapanmış fatura × calculation run | `FIN-008C` | Yerel takvim `invoice_close_date - invoice_date`; aynı gün 0, kısmi/açık null, negatif yasak. |
| `FIN-023 weighted_avg_invoice_close_days` | `APPROVED_ACTIVE` | müşteri/org × kapanış dönemi | `FIN-022`, geçerli faturalama kaydı tutarı | `Σ(invoice_amount×close_days)/Σ(invoice_amount)`; üyelik close_date. `OPENING_BALANCE_INVOICE` yılın 1 Ocak tarihinden ölçülerek dahildir; devir tutarı/pay etkisi `FIN-005B` ile ayrıca gösterilir. |
| `FIN-024 allocation_realization_days` | `APPROVED_ACTIVE` | allocation parçası | `FIN-008` | `max(0, allocation_effective_date-invoice_date)`; kısmi tahsilatı ölçer. Çek/Senet ödeme tarihi değil kabul tarihi cariyi kapatır. |
| `FIN-025 weighted_avg_collection_days` | `APPROVED_ACTIVE` | müşteri/org × allocation dönemi | `FIN-024` | `Σ(allocated_amount×realization_days)/Σ(allocated_amount)`; üyelik allocation tarihi, coverage zorunlu. |
| `FIN-025A payment_speed_mode_split` | `APPROVED_ACTIVE` | müşteri/org × 3/6/12 tamamlanmış ay × mode | `FIN-008F`, `FIN-022..025` | `ECONOMIC` geçerli IADE/HIZMET allocation'ını içerir; `CASH_ONLY` yalnız nakit/normal banka tahsilat sınıflarını içerir. Fatura kapama ve allocation gerçekleşme günü ayrı sonuçtur. Mod etiketi zorunlu; SATIN ALMA ve dağıtılmamış tutar gün pay/paydasına girmez. |
| `FIN-026 monthly_invoice_total` | `APPROVED_ACTIVE` | müşteri/org × takvim ayı × fatura sınıfı | `FIN-001C`, `FIN-005`, `FIN-005E` | `Σ satış faturası + Σ geçerli OPENING_BALANCE_INVOICE + Σ manuel DEVIR_BORC`; devirler ayrı sınıf/paydır. İlk otomatik devir başlangıç yılının Ocak ayına, manuel borç kendi belge ayına girer. Sellout TL, IADE/HIZMET/SATIN ALMA dışarıda; ticari ciro `FIN-002` olup devirleri içermez. |
| `FIN-027 monthly_collection_total` | `APPROVED_ACTIVE` | müşteri/org × takvim ayı × sınıf | `FIN-003`, `FIN-004` | Nakit+normal Havale+Çek/Senet kabulü+IADE+HIZMET; Çek kapama Havalesi, `DEVIR_ALACAK` ve iptaller dışarıda; sınıflar ayrıca korunur. |
| `FIN-028 rolling_monthly_avg_invoice` | `APPROVED_ACTIVE` | müşteri/org × 3/6/12 tamamlanmış ay | `FIN-026`, coverage | `Σ aylık fatura/N`; yalnız N tam takvim ayı kapsaması varsa resmi. Cari ay MTD ayrı. |
| `FIN-029 rolling_monthly_avg_collection` | `APPROVED_ACTIVE` | müşteri/org × 3/6/12 tamamlanmış ay | `FIN-027`, coverage | `Σ aylık tahsilat/N`; yalnız N tam takvim ayı kapsaması varsa resmi. Yöntem kırılımı korunur. |
| `FIN-030 collection_invoice_ratio` | `APPROVED_ACTIVE` | müşteri/org × 3/6/12 dönem | `FIN-026`, `FIN-027` | `Σ collection/Σ invoice×100`; aylık oran ortalaması yapılmaz, eski borç tahsilatıyla >100 olabilir. Fatura 0 ise null. |
| `FIN-031 invoice_collection_coverage` | `APPROVED_ACTIVE` | kapsam × dönem | Yükleme kapsamı + allocation | Tam kaynak ayı sayısı, eşleşen tutar, uygun toplam tutar ve coverage yüzdesi. Onaylı yıl başı devir faturası eşleşebilir kapsamdadır; ancak gerçek ticari fatura olmadığı `opening_balance_share` ile açıklanır. Kaynaksız ve devir kaydına da bağlanamayan bakiye ayrıca DQ'dur. |
| `FIN-031A completed_month_window_coverage` | `APPROVED_ACTIVE` | kapsam × period_end_month × 3/6/12 | kaynak türü/ay coverage | Bitiş ayı dâhil N tamamlanmış takvim ayı; expected/covered ay, event/tutar ve exclusion nedenleri taşınır. Cari ay yalnız ayrı MTD/PARTIAL olabilir. Eksik ay sıfır değildir; N×30, upload tarihi ve Sellout ay filtresi yasaktır. |
| `FIN-032 current_month_run_rate` | `OPTIONAL_DRAFT` | müşteri/org × cari ay | `FIN-026/027 MTD` | `MTD/geçen gün×aydaki gün`; `FORECAST`, gerçekleşmiş 3/6/12 ortalamaya karışmaz. |
| `FIN-033 valid_receivable_transfer` | `APPROVED_ACTIVE` | virman | Virman iki tarafı | Aynı `transfer_id`, eşit pozitif tutar, aynı para birimi/etkin tarih, farklı geçerli kaynak-hedef müşteri ve aktif sürüm. Dengesiz/eksik çift DQ/manual ve resmi hesap dışında. |
| `FIN-034 transferred_receivable_lot` | `APPROVED_ACTIVE` | virman × kaynak fatura parçası | `FIN-033`, kaynak FIFO | Kaynak müşterinin en eski açık lotlarından tutar kadar parçayı hedef müşteriye taşır; `origin_invoice_id/date`, kaynak/hedef müşteri, transfer tarihi ve tutar korunur. Yeni ticari fatura yaratmaz. |
| `FIN-035 transfer_company_net_effect` | `APPROVED_ACTIVE` | şirket × virman | `FIN-033`, `FIN-034` | Kaynak müşteri bakiye etkisi `-tutar`, hedef müşteri `+tutar`, şirket toplam etkisi tam `0`. Organizasyon açık risk dağılımı virman tarihinde değişebilir. |
| `FIN-036 transfer_reporting_exclusion` | `APPROVED_ACTIVE` | virman × dönem | `FIN-033` | Virman satış, ciro, aylık fatura veya tahsilat değildir; `FIN-002`, `FIN-026`, `FIN-027`, Sellout, FKNS ve satış/tahsilat performansından dışlanır. Ekstre ve virman denetim raporunda görünür. |
| `FIN-037 daily_financial_position` | `APPROVED_ACTIVE` | müşteri × gün × currency × run | yayımlanmış Paket 10 ledger/lot, Paket 08 instrument | Cari, pozitif borçlu bakiye, açık lot, dağıtılmamış alacak, açık Çek/Senet ve toplam risk ayrı exact sonuçlardır. `total exposure=max(0,cari)+çek+senet`; negatif cari araç riskini mahsup etmez. |
| `FIN-038 daily_lot_ownership` | `APPROVED_ACTIVE` | lot parçası × gün × owner × run | `FIN-008..012`, temporal org, virman | Orijinal tarih/yaş, açık tutar, bucket, 29+ ve günlük müşteri/rep/SSM sahipliği. Virman yaşı sıfırlamaz; hedef sahipliği transferden önce başlamaz. |
| `FIN-039 daily_instrument_position` | `APPROVED_ACTIVE` | instrument × gün × run | Paket 08 lifecycle, temporal org | Açık araç yüz değeri ve kesin durum. Kabul cari `-X` ve araç `+X`; settlement cari `0`, araç/toplam risk `-X`; pending sonuç açık riskte kalır. |
| `FIN-040 classified_financial_event_delta` | `APPROVED_ACTIVE` | kanonik event revision × etkin gün × scope | Paket 07–11 events/results | Cari, lot, fatura, ekonomik/cash-like tahsilat, araç ve toplam risk deltaları ayrı. Çek/Senet kabulü toplam risk `0`, virman şirket neti `0`; cancellation/restatement performans başarısı değildir. |
| `FIN-041 daily_position_bridge` | `APPROVED_ACTIVE` | scope × gün × run | `FIN-037`, `FIN-040` | `opening position + Σ classified deltas = closing position` her cari/araç/toplam risk bileşeninde exact sağlanır; açıklanamayan fark publish'i bloklar. |
| `FIN-042 financial_reconciliation_readiness` | `APPROVED_ACTIVE` | scope × run | `FIN-006C`, `FIN-037..041`, rollup | Defter-lot-allocation-aging-instrument-virman-rollup denklikleri. İhlal `NOT_READY`; exact denklik+non-critical uyarı `READY_WITH_WARNINGS`; tam sonuç `READY`. |
| `FIN-043 multidimensional_financial_coverage` | `APPROVED_ACTIVE` | metric scope × dönem/as-of × run | source/time/customer/amount/allocation/instrument/hierarchy/manual-conflict | Boyutlar ayrı `COMPLETE/PARTIAL/BLOCKED/NOT_APPLICABLE`; eksik kayıt/ay 0 değildir. Güven tek keyfî coverage ortalamasıyla üretilemez. |
| `FIN-044 read_model_run_publication` | `APPROVED_ACTIVE` | scope × manifest × rule/code versions | Paket 13 run/dependency/outbox | Pin→calculate→reconcile→atomic publish. Aynı manifest aynı hash; stale upstream `409`; rollback önceki active pointer'ı korur; eski run overwrite edilmez. |
| `FIN-045 targeted_financial_restatement` | `APPROVED_ACTIVE` | dependency impact × earliest date | iptal/manual/instrument/virman revision | Yalnız etkilenen müşteri(ler), temporal org üstleri, dönemler ve metrikler immutable yeni run alır. Virman iki tarafı atomik; pending source second effect üretmez. |
| `FIN-046 financial_metric_evidence_envelope` | `APPROVED_ACTIVE` | metric result × run | metric registry, contributions, coverage, reconciliation | Metric id/version, scope, as-of/period/mode, exact raw/display, numerator/denominator, run, coverage, exclusions ve drill-down refs API/UI/AI'da aynıdır. |
| `FIN-047 score_policy_snapshot` | `APPROVED_ACTIVE` | score/limit/performance run × validity | immutable policy version | Weight, band, penalty, piecewise, quantile, rounding, coverage, materiality ve governor tek snapshot'a pinlenir. Aynı result farklı policy kullanamaz; policy değişimi eski sonucu overwrite etmez. |
| `FIN-048 nullable_component_reweighting` | `APPROVED_ACTIVE` | composite score × component set | component score/null reason/original weight | `Σ(score×weight)/Σ(active original weight)`; aktif başlangıç ağırlığı `≥60%` ve uygun component `≥2`. Null 0 değildir; doğal aralık dışı sonuç clamp değil DQ'dur. |
| `FIN-049 financial_health_evidence` | `APPROVED_ACTIVE` | müşteri × as-of/12 tamamlanmış ay × run | `FIN-015A:G`, `FIN-047/048` | Skor/band, component raw/pay/payda/weight/contribution, confidence ve bağımsız flags aynı zarf. DSO context'tir, score component değildir; status keyfî ceza değildir. |
| `FIN-050 limit_quantile_inputs` | `APPROVED_ACTIVE` | müşteri × review date × method | commercial invoice windows, cash risk relief windows | Need: onaylı forecast P75, yoksa tam 12 ay kayan 28 gün `PERCENTILE_CONT(.75)`; capacity: cash risk relief `PERCENTILE_CONT(.25)`. Method/sample/coverage zorunlu; eksik gün 0 değildir. |
| `FIN-051 limit_recommendation_governor` | `APPROVED_ACTIVE` | müşteri × review × policy | `FIN-015`, `FIN-016A:C`, `FIN-050` | `HALF_UP(min(need,capacity)×behavior_factor,1000 TRY)`; exposure girdide yok. Previous effective'e göre `>25%`, ilk/null limit veya critical gate review ister; raw öneri gizlenmez, auto-apply yoktur. |
| `FIN-052 effective_limit_override_revision` | `APPROVED_ACTIVE` | müşteri × validity × decision version | recommendation, preview confirmation, actor capability | Immutable reason/validity/review ile override. Yeni recommendation aktif override'ı ezmez; expiry güncel recommendation ile yeni decision ister. Limit kararı finansal event değildir. |
| `FIN-053 pre29_adjusted_cohort` | `APPROVED_ACTIVE` | rep/SSM × tamamlanmış ay | lot day29 date, allocations, non-performance transfers | Day29'u döneme düşen adjusted principal; 28. gün sonuna kadar ekonomik kapanan tutar pay. Devir alacak/iptal/soft-delete/virman/reassignment başarı değildir; payda 0 null. |
| `FIN-054 temporal_financial_responsibility` | `APPROVED_ACTIVE` | event/lot/position × gün × org | `FIN-017F`, Paket 12A ownership | Invoice owner invoice date; allocation owner allocation date; exposure/limit owner day. Reassignment source-out/target-in; unknown rep company, unknown SSM not silently rolled up. |
| `FIN-055 organization_financial_score_aggregation` | `APPROVED_ACTIVE` | rep/SSM × completed period × run | `FIN-017A:H`, `FIN-048/053/054` | CEI, pre29, due instrument ve daily limit ham pay/paydalardan scope'ta yeniden hesaplanır; SSM rep score ortalaması değildir. MTD/null ayrı; satış/litre/prim birleşmez. |
| `FIN-056 analytic_result_non_mutation_gate` | `APPROVED_ACTIVE` | score/limit/performance publication | capability, outbox allowlist | Analitik publication müşteri status, sevkiyat, finansal event, prim veya effective override mutation'ı üretemez. Yalnız explicit limit override preview/commit ayrı rotadır. |
| `FIN-008 open_invoice_fifo` | `APPROVED_ACTIVE` | müşteri × receivable lot × cari azaltan parça × as-of | Satış + otomatik/manüel `DEVIR_BORC` + `FIN-034` lotları; tahsilatlar + `DEVIR_ALACAK` | Kesim tarihinde sorumlu müşterinin lotları orijinal tarih ASC sırasındadır. İlk devir 1 Ocak, manuel borç belge tarihi, aktarılmış lot orijinal tarihiyle girer. `DEVIR_ALACAK` seçili tarihte FIFO uygular fakat tahsilat metriğine girmez. |
| `FIN-008A unallocated_customer_credit` | `APPROVED_ACTIVE` | müşteri × as-of | `FIN-008` sonrası artan alacak | Açık fatura kalmadığında tahsilat artığı; negatif değer üretilmez. Gelecekte oluşan faturaya o fatura tarihinden önce etkili olmayacak biçimde FIFO uygulanır. |
| `FIN-008B invoice_open_amount` | `APPROVED_ACTIVE` | fatura × as-of | Geçerli vergi dahil fatura tutarı, `FIN-008` | `max(0, fatura tutarı - kesime kadar geçerli allocation toplamı)`; hesapta kesin decimal, gösterimde 2 hane. |
| `FIN-008C invoice_close_date` | `APPROVED_ACTIVE` | fatura | `FIN-008`, `FIN-008B` | Açık tutarı sıfırlayan son allocation etkin tarihi; önceden oluşmuş müşteri alacağı kullanılıyorsa `max(fatura tarihi, alacak tarihi)`. Açık faturada null. |
| `FIN-008D allocation_replay` | `APPROVED_ACTIVE` | müşteri × calculation run | İptal, manuel sürüm, tarih/tutar değişikliği | Etkilenen müşterinin geçerli olaylarını as-of zamanında yeniden oynatır; eski allocation sürümü denetimde korunur, resmi sonuç yeni run'dır. |
| `FIN-008E deterministic_fifo_order` | `APPROVED_ACTIVE` | müşteri × currency × run | lot/event kanonik anahtarları | Lot: origin date, document key, lot id ASC. Azaltan event: effective date, sürümlü class order, source key, event id ASC. Eşitlik sırası yalnız teknik determinizmdir; aynı manifest farklı allocation üretemez. |
| `FIN-008F allocation_class_preservation` | `APPROVED_ACTIVE` | allocation parçası | kaynak azaltan event sınıfı | CASH, BANK_TRANSFER, CHECK/NOTE_ACCEPTANCE, NONCASH_RETURN_SERVICE/RETURN veya SERVICE, MANUAL_CREDIT_TRANSFER ve PREEXISTING_UNALLOCATED_CREDIT ayrımı korunur. Settlement ikinci allocation değildir; IADE/HIZMET cash-only dışında, SATIN ALMA uygunsuzdur. |
| `FIN-008G transfer_effective_time_gate` | `APPROVED_ACTIVE` | devralınmış lot parçası × allocation | `FIN-033..035` | Origin tarih/kimlik yaş için korunur; hedef müşteri allocation etkin tarihi transfer tarihinden önce olamaz. Erken allocation DQ ve publish blokajıdır. |
| `FIN-008H replay_manifest_and_publication` | `APPROVED_ACTIVE` | scope × as-of × knowledge cutoff × run | `FIN-008D`, source revision seti | Aynı manifest/rule/code aynı sonucu üretir; en erken etkilenen tarihten yeni immutable run kurulur. Run sonucu, reconciliation, active pointer ve outbox atomik yayımlanır; stale source/publish `409`, rollback önceki run'ı korur. |
| `FIN-009 invoice_age_days` | `APPROVED_ACTIVE` | açık faturalama kaydı × as-of | `Fatura Tarihi`, rapor tarihi, `FIN-008B` | Yerel takvim günü farkı; fatura günü `0`. Devir faturası için başlangıç ilgili yılın 1 Ocak tarihidir. Ayrı vade/gecikme günü üretilmez. Negatif sonuç DQ ve resmi aging dışında. |
| `FIN-009A age_threshold_flag` | `APPROVED_ACTIVE` | açık fatura × as-of | `FIN-009`, sürümlü şirket eşiği `28` | `invoice_age_days > 28`; yalnız sınıflandırma/uyarı, sayısal vade aşımı günü değildir. |
| `FIN-010 aging_bucket_amount` | `APPROVED_ACTIVE` | müşteri/org × yaş dilimi × as-of | `FIN-008B`, `FIN-009` | İç motor kesin günle dinamik aralık hesaplar; standart rapor `0–6, 7–13, 14–20, 21–28, 29–45, 46–60, 61–89, 90+`. `Σ dilim tutarı = Σ açık fatura tutarı`. |
| `FIN-010A standard_aging_schema` | `APPROVED_ACTIVE` | açık lot × as-of | `FIN-009`, `FIN-010` | DTO anahtarları `D00_06,D07_13,D14_20,D21_28,D29_45,D46_60,D61_89,D90_PLUS`; sınırlar iki uçtan dâhil, 90+ üst sınırsızdır. Gelecek tarihli lot aging dışında DQ; boş kapsamda tutar 0 fakat oran/ortalama null'dır. |
| `FIN-011 over_28_open_amount` | `APPROVED_ACTIVE` | müşteri/org × as-of | `FIN-008B`, `FIN-009A` | Yaşı `>28` olan açık fatura kalan tutarları toplamı. Ayrı gecikme günü göstermez. |
| `FIN-011A weighted_average_open_invoice_age` | `APPROVED_ACTIVE` | müşteri/temsilci/SSM/şirket × as-of | `FIN-008B`, `FIN-009` | `Σ(positive_open_amount × invoice_age_days) / Σ(positive_open_amount)`; hesap kesin, gösterim tam güne yuvarlanır. Açık fatura yoksa null; alt grup ortalamalarının ortalaması yapılmaz. |
| `FIN-012 over_28_open_receivable_ratio` | `APPROVED_ACTIVE` | müşteri/temsilci/SSM/şirket × as-of | `FIN-008B`, `FIN-011`, finansal raporlama kapsamı | `100 × Σ(age_days>28 olan positive_open_amount) / Σ(tüm positive_open_amount)`. Pay ve payda aynı müşteri, organizasyon ve kesim kapsamından gelir. Açık fatura toplamı `0` ise sonuç `null`; `%0` üretilmez. Çek/Senet portföy riski, negatif cari, dağıtılmamış alacak ve başka risk türleri paydaya girmez. Toplulaştırmada alt oranların ortalaması alınmaz. |
| `FIN-013 accounting_dso_days` | `APPROVED_ACTIVE` | müşteri/temsilci/SSM/şirket × dönem | Gün sonu `FIN-008B` açık alacakları, `FIN-002` ticari fatura tutarı, kapsam takvimi | `Σ(dönemdeki her takvim gününün gün sonu positive_open_receivable_amount) / Σ(dönem ticari satış faturası)`. Eşdeğeri `günlük ortalama açık alacak / dönem satışları × gerçek dönem gün sayısı`dır. Devir/virman açık lotları günlük alacakta bulunur fakat satış paydasına girmez; Çek/Senet riski dışarıdadır. Satış paydası `0` ise null ve neden kodu üretilir; sonuç dönem gün sayısına veya 100'e sıkıştırılmaz. |
| `FIN-013A dso_devir_contribution_days` | `APPROVED_ACTIVE` | müşteri/org × dönem | `FIN-013`, devir kaynaklı açık lot gün sonları | `Σ(gün sonu açık devir tutarı) / Σ(dönem ticari satış faturası)`; devir/eski bakiye yükünün toplam DSO'ya gün katkısını açıklar, ana DSO'dan gizlice çıkarılmaz. |
| `FIN-013B dso_coverage` | `APPROVED_ACTIVE` | kapsam × dönem | Kaynak kapsama günleri, başlangıç bakiyesi uzlaşması, calculation run | Tam gün sayısı, beklenen gün sayısı, satış kapsamı ve açılış uzlaşmasını döndürür. Eksik başlangıç/gün varsa resmi DSO bloke veya `PARTIAL` olur; eksik gün sıfır bakiye sayılmaz. |
| `FIN-014 aged_receivable_cei` | `APPROVED_ACTIVE` | müşteri/temsilci/SSM/şirket × dönem | `FIN-008` allocation, `FIN-009`, dönem başı açık lotları, dönem içi yaş geçişleri | `100 × eligible_aged_settlement_amount / adjusted_aged_receivable_pool`. Uygun havuz: dönem başında 29+ açık tutar + dönem içinde ilk kez 29+ olan tutar + yeniden açılan 29+ tutar + 29+ virman girişleri − iptal/geçersizlik ve 29+ virman çıkışları. Pay yalnız allocation tarihinde yaşı >28 olan lotlara uygulanan geçerli cari azaltan allocation'dır. Payda `0` ise null; oran alt gruplardan ortalanmaz ve yapay clamp uygulanmaz. |
| `FIN-014A aged_receivable_pool` | `APPROVED_ACTIVE` | kapsam × dönem | 29+ lot olayları ve sahiplik | Açılış 29+ + dönem içinde 29+ yaşına giren + `aged_reinstatement` + 29+ transfer-in − non-performance exit − 29+ transfer-out. Aynı lot parçası kesintisiz açık kaldığı sürece aynı kapsam/pencerede ikinci kez havuza giremez; gerçekten kapanıp geçerli ters olayla yeniden açılan tutar reinstatement olarak girer. |
| `FIN-014B eligible_aged_settlement_amount` | `APPROVED_ACTIVE` | kapsam × dönem × kapama sınıfı | Allocation ve lot yaşı | Allocation etkin tarihinde `invoice_age_days>28` olan tutar. Nakit/normal Havale, Çek/Senet kabulü ve IADE/HIZMET ayrı sınıflarla dahil; Çek kapama Havalesi, virman, iptal ve soft-delete dahil değildir. |
| `FIN-014C cei_coverage_reconciliation` | `APPROVED_ACTIVE` | kapsam × dönem | `FIN-014A/B`, kapanış 29+ açık tutar | Havuz, uygun kapama, dönem sonu kalan 29+ ve performans dışı çıkışların lot bazlı mutabakatı; eksik başlangıç/allocation geçmişi resmi CEI'yi `PARTIAL/BLOCKED` yapar. |
| `FIN-015 financial_health_score` | `APPROVED_ACTIVE` | müşteri × as-of/12 tamamlanmış ay | `FIN-015A:E`, sürümlü ağırlık seti | `Σ(component_score × active_weight) / Σ(active_weight)`. Başlangıç ağırlıkları: aging `%35`, 29+ CEI `%25`, exposure burden `%20`, kapanma davranışı `%10`, kıymetli evrak güvenilirliği `%10`. Null bileşen yeniden ağırlıklandırılır; kullanılabilir başlangıç ağırlığı `<%60` veya uygun bileşen `<2` ise skor null/insufficient data. |
| `FIN-015A aging_health_component` | `APPROVED_ACTIVE` | müşteri × as-of | `FIN-010` pozitif açık tutarlar | `100 − Σ(bucket_share × severity_penalty)`; ceza: `0–28:0`, `29–45:25`, `46–60:50`, `61–89:75`, `90+:100`. Açık alacak yoksa null; devir payı ayrıca açıklanır. |
| `FIN-015B collection_effectiveness_component` | `APPROVED_ACTIVE` | müşteri × son 12 tamamlanmış ay | `FIN-014` | Coverage tam ise CEI yüzdesi bileşen puanıdır; uygun 29+ havuz yoksa null, `%100` varsayılmaz. |
| `FIN-015C exposure_burden_component` | `APPROVED_ACTIVE` | müşteri × as-of | `FIN-006`, son 12 ay ticari satışları | `exposure_months = total_exposure / (covered_12m_commercial_sales / covered_month_count)`. Sürüm v1 puan kırıkları: `≤1:100`, `1–2:80`, `2–3:60`, `3–4:40`, `4–6:20`, `>6:0`; yeterli satış coverage yoksa null. |
| `FIN-015D close_behavior_component` | `APPROVED_ACTIVE` | müşteri × son 12 tamamlanmış ay | tutar-ağırlıklı fatura kapama günü + coverage | Sürüm v1: `≤28:100`, `29–45` doğrusal `100→70`, `46–60` doğrusal `70→40`, `61–90` doğrusal `40→10`, `>90:0`. Coverage eşiği sağlanmazsa null. |
| `FIN-015E instrument_reliability_component` | `APPROVED_ACTIVE` | müşteri × son 12 tamamlanmış ay | sonucu kesinleşmiş vadesi gerçekleşmiş Çek/Senet olayları | `100 × (1 − confirmed_dishonored_amount / outcome_observed_matured_instrument_amount)`; yalnız kullanıcı kararı/ödeme eşleşmesiyle sonucu kesinleşmiş evrak paydaya girer. Vadesi gelmemiş veya sonucu bekleyen evrak paydaya girmez; gözlenmiş sonuç yoksa null. Sonradan ödeme ilk olumsuz olayı silmez; recovery ayrı gösterilir. |
| `FIN-015F financial_risk_flags` | `APPROVED_ACTIVE` | müşteri × as-of | Aging, evrak, coverage, çatışmalar | Skordan bağımsız, kanıtlı bayraklar: 90+ açık tutar, teyitli karşılıksız/iade evrak, sonucu bekleyen vadesi geçmiş evrak, satışsız açık risk, hızlı bozulma, kritik coverage/manuel çatışma. Bayrak otomatik sevkiyat engeli veya bakiye işlemi değildir. |
| `FIN-015G health_score_confidence` | `APPROVED_ACTIVE` | müşteri × run | Aktif bileşenler ve coverage | Kullanılabilir ağırlık, bileşen sayısı, kaynak kapsaması, başlangıç uzlaşması ve unresolved issue etkisinden `HIGH/MEDIUM/LOW/INSUFFICIENT`; güven puanı finansal sağlık puanına karıştırılmaz. |
| `FIN-016 system_recommended_exposure_limit` | `APPROVED_ACTIVE` | müşteri × review date | `FIN-016A:D`, `FIN-015`, policy version | `round_unit(min(operating_need_limit, cash_realization_capacity_limit) × behavior_factor)`. Bu limit cari + açık Çek + açık Senet toplam riskini sınırlar; mevcut risk formül girdisi değildir. Coverage/risk gate başarısızsa tutar null ve manuel inceleme durumu oluşur. |
| `FIN-016A operating_need_limit` | `APPROVED_ACTIVE` | müşteri × gelecek 28 gün | ticari fatura geçmişi/tahmini | Tam coverage varsa gelecek 28 günlük geçerli ticari fatura tutarı tahmininin `%75` quantile'ı; model yetersizse son 12 ay içindeki takvim uyumlu kayan 28 günlük ticari fatura toplamlarının `%75` quantile'ı. Devir/virman/IADE/HIZMET/Sellout TL hariç. |
| `FIN-016B cash_realization_capacity_limit` | `APPROVED_ACTIVE` | müşteri × son 12 tamamlanmış ay | toplam riski gerçekten azaltan olaylar | Son 12 ayın kayan 28 günlük `cash_risk_relief` toplamlarının muhafazakâr `%25` quantile'ı. Nakit, normal Havale ve Çek/Senetin gerçek ödemesi bir kez dahil; Çek/Senet kabulü, Çek kapama Havalesinin ikinci cari etkisi, IADE/HIZMET ve manuel devir alacak limit kapasitesini artırmaz. |
| `FIN-016C limit_behavior_factor` | `APPROVED_ACTIVE` | müşteri × review date | `FIN-015` skor/bayrak/güven | Başlangıç v1: `85–100:1.00`, `70–84:0.80`, `50–69:0.50`, `<50:0.25`. `LOW/INSUFFICIENT` güven, teyitli açık karşılıksız evrak veya kritik unresolved issue durumunda otomatik faktör yerine `MANUAL_REVIEW`; puan tek başına işlem üretmez. |
| `FIN-016D limit_usage_and_headroom` | `APPROVED_ACTIVE` | müşteri × as-of | `FIN-006`, `FIN-016` | `usage=total_exposure/recommended_limit`; `headroom=max(0,recommended_limit-total_exposure)`; limit null ise ikisi de null. `total_exposure>limit` yalnız `EXCEEDED` bayrağıdır, geçmiş hareketi veya bakiyeyi değiştirmez. |
| `FIN-016E effective_internal_limit` | `APPROVED_ACTIVE` | müşteri × validity | sistem önerisi + kullanıcı kararı | Varsayılan sistem önerisi; kullanıcı sürümlü gerekçe, geçerlilik ve inceleme tarihiyle override edebilir. Kaynak Excel kredi limiti hiçbir formüle/fallback'e girmez. Yeni öneri override'ı sessiz ezmez; karşılaştırmalı onaya sunar. |
| `FIN-016F limit_change_governor` | `APPROVED_ACTIVE` | müşteri × review | eski/yeni öneri, risk bayrakları | Ham öneri ile yayınlanan öneriyi ayırır. Normal koşulda bir incelemede artış/azalış `%25`ten büyükse kullanıcı incelemesi; teyitli kritik riskte daha büyük düşüş önerilebilir ama otomatik uygulanmaz. |
| `FIN-017 rep_financial_performance_score` | `APPROVED_ACTIVE` | temsilci/SSM × tamamlanmış ay | `FIN-017A:D`, policy version | `Σ(component_score×active_weight)/Σ(active_weight)`. Başlangıç ağırlıkları: 29+ CEI `%40`, 29 güne kalmadan kapanma `%30`, vadesi gelen evrak gerçekleşmesi `%20`, limit disiplini `%10`. Aktif ağırlık `<%60` veya bileşen `<2` ise null/insufficient; satış/litre performansıyla otomatik birleştirilmez. |
| `FIN-017A rep_aged_collection_component` | `APPROVED_ACTIVE` | temsilci/SSM × dönem | `FIN-014` pay/havuz ve etkin sorumluluk | Aynı dönemin yeniden toplulaştırılmış 29+ CEI yüzdesi. Reassignment/virman performans dışı transferdir; yüzdelerin ortalaması alınmaz. |
| `FIN-017B pre29_closure_rate` | `APPROVED_ACTIVE` | temsilci/SSM × dönem | 29. güne ulaşma tarihi döneme düşen invoice lotları ve allocation | `100 × day28_end'e kadar ekonomik olarak kapanan uygun principal / 29. gün tarihi dönem içinde olan düzeltilmiş principal`. İptal/virman/reassignment performans dışı mutabakat; manual devir alacak başarı değildir. Payda 0 ise null. |
| `FIN-017C due_instrument_realization_rate` | `APPROVED_ACTIVE` | temsilci/SSM × dönem | dönemde vadesi gelen Çek/Senet | `100 × dönem sonuna kadar gerçekten ödenmiş vadesi gelen evrak tutarı / dönemde vadesi gelen geçerli evrak tutarı`. Sonuç bekleyen, karşılıksız/iade ve ödenmemiş tutar paydada kalır; virman/iptal ayrı mutabakat. Payda 0 ise null. |
| `FIN-017D limit_discipline_component` | `APPROVED_ACTIVE` | temsilci/SSM × dönem | günlük toplam risk, etkin iç limit | `100 × (1 − Σ günlük limit aşım tutarı / Σ günlük pozitif toplam risk)`; limit/risk alanı yoksa null. Skor clamp edilmez; doğal sınır dışı sonuç DQ. Limit kullanıcı onaylı istisna döneminde istisna etiketiyle hesaplanır. |
| `FIN-017E rep_financial_context` | `APPROVED_ACTIVE` | temsilci/SSM × dönem/as-of | Fatura, tahsilat, risk, aging, DSO, limit | Skora girmeyen fakat zorunlu gösterilen bağlam: ticari fatura cirosu, ekonomik tahsilat ve sınıfları, gerçek nakit/risk azaltma, açılış/kapanış cari-Çek-Senet/toplam risk, 29+ tutar/oran, DSO, ortalama açık yaş, devir/virman ve pasif/iptal borç etkisi. |
| `FIN-017F responsibility_attribution` | `APPROVED_ACTIVE` | müşteri/lot/olay × gün | geçerlilik tarihli temsilci/SSM, virman ve reassignment | Satış sahibi fatura tarihindeki temsilci; tahsilat/kapama sahibi allocation tarihindeki temsilci; günlük risk sahibi o günün temsilcisi. Portföy reassignment kalan havuzu performans dışı source-out/target-in taşır. Belirsiz hiyerarşi şirkette kalır, yanlış temsilci/SSM'ye atanmaz. |
| `FIN-017G inactive_customer_period_scope` | `APPROVED_ACTIVE` | pasif/iptal müşteri × dönem | günlük pozitif borçlu bakiye | As-of listede `≥100 TL`; dönem performansında açılışta veya dönem içinde herhangi bir gün `≥100 TL` olduysa müşteri dönem sonuna kadar cohort'ta kalır. Tahsilatla 100 TL altına inmesi başarılı hareketi rapordan silmez. |
| `FIN-017H rep_score_confidence_and_distribution` | `APPROVED_ACTIVE` | temsilci/SSM × dönem | bileşen coverage ve müşteri dağılımı | `HIGH/MEDIUM/LOW/INSUFFICIENT`, bileşen nedenleri; ayrıca müşteri sağlık bandı adet/risk tutarı dağılımı. SSM skoru temsilci skorlarının ortalaması değildir. |
| `FIN-018 pareto_concentration` | `APPROVED_ACTIVE` | müşteri/organizasyon × seçili pozitif ölçü | Seçili doğrulanmış metrik | İlk 1/5/10/20 veya seçili N payı `100×Σ(top N katkı)/Σ(tüm pozitif katkı)`; sıfır toplamda null. HHI ve ayrıntılı ileri yoğunlaşma `FAN-001` altında üretilir. |

## 12A. İleri finansal analiz matrisi

Bu sonuçların ayrıntılı formül, güven ve rapor sözleşmesi `FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md` dosyasındadır. Temel gerçekleşmiş finansal olayları değiştirmezler.

| ID | Durum | Sonuç türü | Ana bağımlılıklar | Kısa sözleşme |
|---|---|---|---|---|
| `FAN-001 concentration_pareto_hhi` | `APPROVED_ACTIVE` | `FACT` | `FIN-002/007/011/019/020/021/027` | İlk N payı, Pareto ve `10.000×Σshare²`; ölçüler karıştırılmaz. |
| `FAN-002 aging_migration_matrix` | `APPROVED_ACTIVE` | `FACT` | `FIN-008..014`, sahiplik | Ay başı yaş diliminden ay sonu dilimi/kapama/transfer durumuna tutar ve adet geçişi. |
| `FAN-003 invoice_vintage_curve` | `APPROVED_ACTIVE` | `FACT` | fatura lotu + allocation | 7/14/21/28/45/60/90 gün kapanma oranı; yalnız gözlemlenebilir kohort paydaya girer. |
| `FAN-004 payment_survival_curve` | `APPROVED_ACTIVE` | `INFERENCE` | lot/allocation + censoring | Tutar-ağırlıklı açık kalma eğrisi, medyan gün ve geri düşme seviyesi. |
| `FAN-005 aged_burden_flow` | `APPROVED_ACTIVE` | `FACT` | `FIN-011/014` | Açılış 29+, yeni giriş, kapama, transfer/düzeltme ve kapanış köprüsü. |
| `FAN-006 total_exposure_bridge` | `APPROVED_ACTIVE` | `FACT` | tüm geçerli finansal olaylar | Açılış + sınıflı olay etkileri = kapanış toplam risk; açıklanamayan fark bloke. |
| `FAN-007 economic_vs_cash_relief_bridge` | `APPROVED_ACTIVE` | `FACT` | tahsilat/araç olayları | Ekonomik tahsilat, gerçek nakit/risk azaltma ve nakit dışı azaltım ayrı. |
| `FAN-008 instrument_maturity_ladder` | `APPROVED_ACTIVE` | `FACT` | `COLL-008/009`, `FIN-019/020` | Geçmiş vade, 0–7, 8–14, 15–30, 31–60, 61–90, 91+ tutar/adet. |
| `FAN-009 instrument_realization_forecast` | `APPROVED_ACTIVE` | `FORECAST` | `FIN-015E/017C`, `FAN-008` | Vade tutarı × kalibre gerçekleşme olasılığı; gözlem ve fallback açıklanır. |
| `FAN-010 thirteen_week_cash_forecast` | `APPROVED_ACTIVE` | `FORECAST` | `FAN-004/008/009` | Fatura + araç beklenen nakdi, haftalık P25/P50/P75. |
| `FAN-011 financial_forecast_backtest` | `APPROVED_ACTIVE` | `FACT` | tarihsel kesim tahmin/gerçek | Rolling-origin MAE, WAPE, bias ve interval coverage; gelecek sızıntısı yok. |
| `FAN-012 deterioration_signals` | `APPROVED_ACTIVE` | `INFERENCE` | aging/CEI/DSO/risk/limit/araç | Kanıtlı, maddilik kontrollü ayrı bozulma sinyalleri; otomatik işlem yok. |
| `FAN-013 robust_financial_anomaly` | `APPROVED_ACTIVE` | `INFERENCE` | yeterli dönem serisi | Medyan/MAD, IQR veya dönemsel geri düşme; anomali neden sayılmaz. |
| `FAN-014 financial_behavior_segment` | `APPROVED_ACTIVE` | `INFERENCE` | finansal temel metrikler | Master segmentten ayrı sürümlü davranış/risk sınıfı ve kanıt etiketleri. |
| `FAN-015 collection_priority` | `APPROVED_ACTIVE` | `RECOMMENDATION` | risk/aging/araç/bozulma/limit | Açıklanabilir takip sırası; coverage kapısı ve manuel inceleme, finansal mutasyon yok. |
| `FAN-016 stress_scenario` | `APPROVED_ACTIVE` | `SCENARIO` | tahmin + sürümlü varsayım | Tahsilat, satış, gecikme ve araç gerçekleşme şoklarının 4/13 haftalık etkisi. |
| `FAN-017 top_counterparty_stress` | `APPROVED_ACTIVE` | `SCENARIO` | `FAN-001/010` | İlk 1/5/10 müşterinin ödeme yapmama duyarlılığı; gerçek kayıp iddiası değildir. |
| `FAN-018 management_expected_loss` | `APPROVED_ACTIVE` | `SCENARIO` | risk + kalibre PD/LGD | Yeterli veri veya açık varsayımla yönetimsel senaryo; resmî muhasebe karşılığı değildir. |
| `FAN-019 restatement_impact` | `APPROVED_ACTIVE` | `FACT` | eski snapshot + güncel run | Geç yükleme/iptal/manual/kural/hiyerarşi kaynaklı yayımlanmış–güncel farkı. |
| `FAN-020 close_readiness_reconciliation` | `APPROVED_ACTIVE` | `FACT` | defter/lot/araç/allocation/virman | Kontrol denklikleri ve `NOT_READY/READY_WITH_WARNINGS/READY`. |
| `FAN-021 report_coverage_confidence` | `APPROVED_ACTIVE` | `FACT` | kaynak ve sonuç kapsamı | Dönem/satır/tutar/müşteri coverage, dışlanan tutar, çatışma ve fallback. |
| `FAN-022 peer_period_benchmark` | `APPROVED_ACTIVE` | `INFERENCE` | kanal/segment/org cohort | Medyan, P25/P75 ve yüzdelik; uygun birim `<10` ise üst gruba fallback/null. |
| `FAN-023 customer_financial_360` | `APPROVED_ACTIVE` | `FACT` bileşimi | bağlı `FIN/FAN` sonuçları | Yeni formül değil; tek müşteri finansal sonuç zarfı ve drill-down. |
| `FAN-024 action_outcome_measurement` | `APPROVED_ACTIVE` | `FACT + INFERENCE` | native case/activity/commitment günlüğü + canonical finance results | Öneri benimseme, iş akışı, söz sonucu ve 7/14/30 observed relief ayrı; normal sonuç `TEMPORAL_ASSOCIATION`, nedensellik yalnız deney kapısıyla. |
| `FAN-025 cohort_observation_cutoff` | `APPROVED_ACTIVE` | `FACT` | as-of/period × knowledge cutoff × temporal dimensions | Üyelik yalnız cutoff'ta bilinen olay/dimension ile; gelecek ödeme/status/hierarchy sızmaz. Origin class ve amount/lot/invoice/customer ölçüleri ayrı. |
| `FAN-026 aging_migration_slice` | `APPROVED_ACTIVE` | `FACT` | lot principal slice × month-open/close | Bucket/new/transfer/reassignment girişinden bucket/economic-close/transfer/reassignment/non-performance çıkışına tek yol. Opening+in=closing+close+out exact. |
| `FAN-027 observable_vintage_horizon` | `APPROVED_ACTIVE` | `FACT` | invoice cohort × 7/14/21/28/45/60/90 | Payda yalnız horizon'u gözlemlemiş adjusted principal; pay horizon EOD economic close. Genç invoice sahte başarısızlık değildir; transfer vintage'ı korur. |
| `FAN-028 weighted_payment_survival` | `APPROVED_ACTIVE` | `INFERENCE` | principal risk set × close/censor/exit | `S(t)=Π(1−close_amount/at_risk_amount)`; açık right-censored, transfer ownership change, non-performance competing exit. Median ilk `S≤.5`; commercial/devir ayrı. |
| `FAN-029 survival_fallback_eligibility` | `APPROVED_ACTIVE` | `INFERENCE` | cohort level × observations | V1 min 30 observable invoice+10 economic close; `CUSTOMER→REP→CHANNEL→COMPANY`, sonra null. Fallback/excluded dimensions ve coverage zorunlu. |
| `FAN-030 aged_burden_reconciliation` | `APPROVED_ACTIVE` | `FACT` | `FIN-014A:C` lot contributions | Opening+new-aged+reinstatement+in−eligible settlement−nonperformance−out=closing 29+. IADE/HIZMET economic, devir alacak adjustment, company transfer net 0. |
| `FAN-031 behavior_segment_policy` | `APPROVED_ACTIVE` | `INFERENCE` | health/aging/CEI/exposure/instrument/coverage trends | Priority tek ana class+evidence tags; critical/insufficient/no-sales/instrument-heavy/persistent-aged/recovery/growing/healthy/mixed. Master/status/limit değişmez. |
| `FAN-032 behavior_materiality_gate` | `APPROVED_ACTIVE` | `INFERENCE` | trailing-3 exposure × policy | `max(10,000 TRY, trailing_3m_avg_exposure×5%)`; oran ve maddi tutar birlikte. Küçük taban yüzdesi risk/recovery sınıfı üretmez. |
| `FAN-033 peer_benchmark_cohort` | `APPROVED_ACTIVE` | `INFERENCE` | metric/version/unit/period/coverage × peer hierarchy | Aynı karşılaştırılabilir entity'ler; segment+channel+rep→SSM→company→channel company→company. Her level min 10, sonra null; RLS minimum-group. |
| `FAN-034 peer_quantile_result` | `APPROVED_ACTIVE` | `INFERENCE` | eligible peer contributions | Median/P25/P75/percentile, eligible/excluded count, direction metadata ve fallback. Yüksek değer otomatik iyi değildir; fark neden/karar değildir. |
| `FAN-035 forecast_time_cutoff` | `APPROVED_ACTIVE` | `FACT` | as-of EOD × knowledge cutoff × timezone | Europe/Istanbul as-of sonrası 1–7…85–91 gün; yalnız cutoff'ta bilinen revision/dimension. Eksik gün 0, gelecek bilgi geçmiş değildir. |
| `FAN-036 invoice_direct_cash_competing_risk` | `APPROVED_ACTIVE` | `FORECAST` | açık ticari principal × cash/transfer/instrument/noncash transitions | Yalnız DIRECT_CASH/BANK_TRANSFER cause-specific weekly probability nakittir; araç kabulü ve IADE/HIZMET competing exit, devir/virman/SATIN ALMA uygun değildir. |
| `FAN-037 instrument_settlement_distribution` | `APPROVED_ACTIVE` | `FORECAST` | açık araç × due/settlement history | Face value'ın gerçek settlement hafta olasılığı; customer→rep→channel→company fallback, matured outcome coverage ve overdue pending ayrı. Kabul nakit değildir. |
| `FAN-038 commercial_invoice_forecast_gate` | `APPROVED_ACTIVE` | `FORECAST` | pozitif ticari invoice weekly series | 26 hafta trailing median, 52 hafta seasonal naive challenger; rolling-origin approval yoksa extended null. 12B P75 yalnız APPROVED modelden tüketir. |
| `FAN-039 forecast_path_quantiles` | `APPROVED_ACTIVE` | `FORECAST` | component distributions × residual blocks | Run hash seed'li 1.000 ortak nonnegative yol; P25≤P50≤P75. 4/13 hafta quantile aynı yol toplamıdır, marjinal quantile toplamı değildir. |
| `FAN-040 forecast_model_promotion` | `APPROVED_ACTIVE` | `FACT` | en az 26 rolling origin × naive/challenger | 4 ve 13 hafta WAPE ≥%5 iyileşme, hiçbir zorunlu horizon >%10 bozulma yok, interval coverage %40–%80; zero actual WAPE/bias null. |
| `FAN-041 deterioration_policy_v1` | `APPROVED_ACTIVE` | `INFERENCE` | recent-3/prior-3 ve same-elapsed-day metrics | 29+ amount +%20 material, share +10pp, CEI −10pp, DSO +7gün ve +%15, exposure +%20 ve sales'ten +10pp; exact limit/instrument/manual sinyalleri ayrı. |
| `FAN-042 signal_materiality_lifecycle` | `APPROVED_ACTIVE` | `INFERENCE` | signal state × evidence × materiality | `max(10.000 TRY,trailing-3 exposure×5%)`; OPEN/ACKNOWLEDGED/RESOLVED immutable occurrence zinciri. Ack fact'i değiştirmez, küçük taban tek başına alarm değildir. |
| `FAN-043 robust_anomaly_policy` | `APPROVED_ACTIVE` | `INFERENCE` | ≥12 aylık veya ≥26 haftalık tam seri | `0.6745×(x−median)/MAD`, mutlak z skoru ≥3.5; MAD0→3×IQR→seasonal/material fallback→null. Anomali neden değildir. |
| `FAN-044 collection_priority_policy_v1` | `APPROVED_ACTIVE` | `RECOMMENDATION` | exposure/aged/instrument/signal/limit raw components | CUME_DIST 0–100; %30/%25/%20/%15/%10, available weight ≥%60. Manual review önce, sonra score/material/customer. Mutasyon/temas yok. |
| `FAN-045 scenario_state_transition` | `APPROVED_ACTIVE` | `SCENARIO` | immutable base paths × versioned shocks | Invoice→delay→haircut→instrument P25→top-zero sırası; unpaid state'e kalır, duplicate shock yok, gerçek event/forecast overwrite edilmez. |
| `FAN-046 management_loss_calibration` | `APPROVED_ACTIVE` | `SCENARIO` | positive EAD × PD × LGD × 180-day recovery | Event=material 90+ 30 gün kalıcı veya confirmed adverse instrument; horizon başına tek. Segment+channel→channel→company fallback'ta ≥50 gözlem/≥10 event; aksi user PD/LGD ile SCENARIO_ONLY/null. Resmî karşılık değildir. |
| `FAN-047 recommendation_adoption_funnel` | `APPROVED_ACTIVE` | `FACT` | recommendation result × verified presentation events | Presented→opened→converted/dismissed/expired; unique user/customer/session, bot/prefetch dışı. Conversion finansal başarı değildir. |
| `FAN-048 prospective_action_eligibility` | `APPROVED_ACTIVE` | `FACT` | case/activity occurred/recorded time × finance known-at | Yalnız finansal sonuç bilinmeden kaydedilmiş PERFORMED faaliyet eligible; planned veya retrospective kayıt ölçüm anchor'ı/performans değildir. |
| `FAN-049 action_case_measurement_window` | `APPROVED_ACTIVE` | `FACT` | ilk eligible performed activity × timezone/policy | Customer×currency'de tek aktif ölçülen vaka; anchor sonrası kümülatif 1–7/1–14/1–30 gün, immature horizon zero değildir. |
| `FAN-050 observed_financial_outcome_components` | `APPROVED_ACTIVE` | `FACT` | Paket 08–10/12A canonical events/allocations | Economic, direct cash, IADE/HIZMET, instrument acceptance, instrument settlement, new exposure ve other deltas ayrı; user outcome tutarı kaynak değildir. |
| `FAN-051 exclusive_case_event_binding` | `APPROVED_ACTIVE` | `FACT` | customer/currency × active case/window × canonical event | Event en fazla bir case ve bir financial class'a; case içi faaliyetlere tutar paylaştırılmaz. 7/14/30 kümülatif horizonlar toplanmaz. |
| `FAN-052 action_exposure_bridge` | `APPROVED_ACTIVE` | `FACT` | baseline/closing exposure + `FAN-006` deltas | Opening + classified deltas = closing; yeni satış, iptal, transfer, manual/restatement ayrı. Negatif cari aracı mahsup etmez. |
| `FAN-053 commitment_definition` | `APPROVED_ACTIVE` | `FACT` | performed commitment activity + typed promise | Positive integer minor, TRY, due date ve `ECONOMIC_RELIEF`, `DIRECT_CASH_ONLY` veya `INSTRUMENT_SETTLEMENT_ONLY`; immutable revision. |
| `FAN-054 commitment_event_allocation` | `APPROVED_ACTIVE` | `FACT` | eligible canonical events × open commitments | Kind içinde due date→created_at→id FIFO; event minor-unit parçası tek söze, on-time due EOD, late +7 gün, excess ayrı. |
| `FAN-055 commitment_fulfilment_result` | `APPROVED_ACTIVE` | `FACT` | promise + allocated event parts + maturity | Open/partial/kept on-time/partial/kept late/broken/cancelled-invalid; immature broken değildir. Promise sonucu aksiyon nedenselliği değildir. |
| `FAN-056 workflow_performance_rates` | `APPROVED_ACTIVE` | `FACT` | verified exposure/activity/commitment states | Open/conversion, due activity completion, contact ve promise amount rates exact pay/payda/exclusion/coverage ile; adet ve tutar karışmaz. |
| `FAN-057 temporal_association_result` | `APPROVED_ACTIVE` | `INFERENCE` | baseline exposure × 7/14/30 observed outcomes | `min(observed economic relief,baseline eligible exposure)/baseline`; raw/excess ayrı, baseline 0 null. “Sonra”dır, “sayesinde” değildir. |
| `FAN-058 action_outcome_coverage_restatement` | `APPROVED_ACTIVE` | `FACT` | log timeliness/org/baseline/source/allocation/currency/maturity | Bileşenli coverage; immutable outcome snapshot. İptal/reversal/manual/source değişimi yeni run/diff ve deterministic promise replay üretir. |
| `FAN-059 randomized_action_experiment_gate` | `APPROVED_ACTIVE` | `FACT` | pre-registered protocol × eligibility snapshot × assignment | Unit/scope/strata/30d metric/exclusions assignment öncesi pinli; deterministic randomization, ITT, crossover deviation. Her kol ≥30 unit/10 event, coverage ≥%90. |
| `FAN-060 causal_action_lift` | `APPROVED_ACTIVE` | `INFERENCE` | `FAN-059` valid treatment/control results | Kol capped-relief/baseline oran farkı; 2.000 seeded stratified bootstrap %95 interval. 0 içerirse INCONCLUSIVE, kalite geçmezse CAUSAL_BLOCKED; diğer kıyaslar descriptive. |

## 12B. Rapor, dönem karşılaştırma ve çıktı matrisi

| ID | Durum | Seviye | Kaynak | Hesap/üretim sözleşmesi |
|---|---|---|---|---|
| `RPT-001 period_comparison` | `APPROVED_ACTIVE` | metrik × kapsam × dönem çifti | Aynı metrik tanımı ve karşılaştırılabilir iki sonuç | Cari/kıyas değer, mutlak fark ve güvenli yüzde fark. Kıyas `0` ise yüzde fark null/`BASE_ZERO`; kapsam veya coverage maddi farklıysa `NON_COMPARABLE`. |
| `RPT-002 report_result_manifest` | `APPROVED_ACTIVE` | rapor snapshot | Seçili `metric_result_id` ve FAN sonuçları | Formatlardan bağımsız tek sonuç listesi; calculation run, sürüm, filtre, dönem, coverage, birim ve ham/gösterim değerini taşır. |
| `RPT-003 ai_report_narrative` | `APPROVED_ACTIVE` | rapor snapshot × dil | `RPT-002`, AI claim sözleşmesi | Bulgu, karşılaştırma, katkı, risk, belirsizlik, gelecek/senaryo ve öneriyi dayanak sonuç kimlikleriyle üretir; sayı kaynağı değildir. |
| `RPT-004 pdf_report_artifact` | `APPROVED_ACTIVE` | snapshot × template version | `RPT-002/003`, grafik renderer | Kapak, yönetici özeti, KPI, karşılaştırma, grafik, bulgu, coverage ve metodoloji içeren baskıya hazır PDF. |
| `RPT-005 xlsx_report_artifact` | `APPROVED_ACTIVE` | snapshot × template version | `RPT-002/003`, yetkili detay sonuçları | Özet, karşılaştırma, analiz, detay, DQ ve metodoloji sekmeli XLSX; resmî KPI ayrı Excel formülüyle yeniden hesaplanmaz. |
| `RPT-006 image_report_artifact` | `APPROVED_ACTIVE` | widget/rapor × template version | `RPT-002`, chart spec | Kaynak dönem/birim/uyarı içeren yüksek çözünürlüklü PNG ve uygun görselde SVG. |
| `RPT-007 artifact_reproducibility` | `APPROVED_ACTIVE` | artifact | Snapshot, manifest, template ve renderer sürümü | Hash, üretim zamanı, oluşturan kullanıcı/AI isteği, gizlilik, sürüm ve dosya bütünlüğü; eski artifact sessizce güncel veriyle değişmez. |
| `RPT-008 export_authorization` | `APPROVED_ACTIVE` | kullanıcı × rapor × scope | RLS/rol/portföy yetkisi | Üretim ve indirme anında yeniden yetki kontrolü; yetkisiz detay özet, görsel veya dosyaya sızmaz. |
| `RPT-009 export_quality_gate` | `APPROVED_ACTIVE` | export job | PDF/XLSX/image doğrulamaları | Sayı manifest uyumu, detay kontrol toplamı, taşma/kırpılma, sayfa/tablo, kontrast, null/blocked ve dosya açılabilirlik kontrolleri başarılı olmadan artifact yayımlanmaz. |
| `RPT-010 universal_response_delivery` | `APPROVED_ACTIVE` | kullanıcı sorusu × semantic plan | Sonuç boyutu, tahmini token, boyut/metrik/dönem sayısı, kullanıcı niyeti | `INLINE`, `INLINE_PLUS_VISUAL` veya `REPORT_PACK`; her modda doğrudan cevap ve yorum sohbet içinde, yoğun detay artifact/drill-down'da. |
| `RPT-011 analysis_digest` | `APPROVED_ACTIVE` | doğrulanmış sonuç manifesti | Merkezi metrik sonuçları ve katkı motoru | Modele ham satırlar yerine temel sonuç, kıyas, top-N katkı, anomali/risk, coverage, dışlanan detay ve drill-down kimliklerini taşır. |
| `RPT-012 token_budget_governor` | `APPROVED_ACTIVE` | AI yürütme planı | Sürümlü bütçe politikası + tahmini giriş/çıkış | Doğruluğu bozmadan toplulaştırma, top-N+diğer, sayfalama, cache ve artifact yönlendirmesi seçer; sessiz veri kaybı veya sayı uydurma yapmaz. |
| `RPT-013 cross_format_analysis_reuse` | `APPROVED_ACTIVE` | soru × snapshot × scope | `RPT-002/003/007/010..012` | Bir hesaplama/manifest ve bir claim seti sohbet, HTML, PDF, XLSX ve görselde yeniden kullanılır; format başına tekrar AI analizi yapılmaz. |
| `RPT-014 report_definition_version` | `APPROVED_ACTIVE` | report key × version | registry metric refs + approved policies | Immutable `DRAFT→VALIDATED→APPROVED_ACTIVE→RETIRED`; widget/filter/drill/chart/template bağları sürüme pinli, formül/SQL/JS içermez. |
| `RPT-015 canonical_filter_scope` | `APPROVED_ACTIVE` | kullanıcı × rapor × filtre/dönem | tipli filter schema + RLS + period policy | Semantik eşdeğer giriş tek canonical JSON/hash; null/empty/ALL ayrıdır, yetki dışı değer fail-closed, Sellout ayı ile finansal 3/6/12 karışmaz. |
| `RPT-016 snapshot_publication_state` | `APPROVED_ACTIVE` | run request × definition version | calculation/source runs + cutoff + canonical hashes | Pin→validate→manifest→quality→immutable publish; idempotent retry ikinci snapshot üretmez, blocked/failed/cancelled veri diye yayımlanmaz. |
| `RPT-017 snapshot_restatement_diff` | `APPROVED_ACTIVE` | eski/yeni snapshot | eski/yeni result manifest | Result id, exact delta, state/coverage ve source reason diff'i; eski snapshot/artifact değişmez, UI stale/restated gösterir. |
| `RPT-018 chart_result_binding` | `APPROVED_ACTIVE` | widget/chart spec × snapshot | manifest result/dimension/series refs | Grafik yalnız result refs'i biçimler; istemci hesap yapmaz, sort/tie-break/unit/axis/precision deterministiktir. |
| `RPT-019 visual_state_semantics` | `APPROVED_ACTIVE` | chart/table cell/point | result state/kind/coverage | Zero, null, missing, partial, blocked, non-comparable, actual, forecast ve scenario renk+etiket/ikon/desenle ayrılır; table fallback aynıdır. |
| `RPT-020 secure_drilldown` | `APPROVED_ACTIVE` | snapshot × widget point × cursor | allowlist dimension/column/filter/sort + RLS | Snapshot'a pinli keyset sayfalama, unique tie-break, truncation ve evidence refs; serbest SQL ve yetkisiz ayrıntı yok. |
| `RPT-021 report_control_totals` | `APPROVED_ACTIVE` | manifest/widget/detail/export | domain control totals | Stack, waterfall, Pareto, top-N+diğer, detail ve bütün formatlar exact ana toplamla mutabıktır; satırdan yeni resmî total türetilmez. |
| `RPT-022 export_job_lifecycle` | `APPROVED_ACTIVE` | snapshot × requested formats | auth + templates + renderer | `QUEUED→AUTHORIZING→RENDERING→VALIDATING→PUBLISHED`; format alt durumları, partial failure, idempotency ve atomic publish; yarım dosya yok. |
| `RPT-023 private_artifact_delivery` | `APPROVED_ACTIVE` | artifact × kullanıcı/scope | private storage + capability/RLS + retention | Üretim/indirmede tekrar yetki, kısa ömürlü scope-bound link, güvenli ad, content hash, expiry/legal hold ve download audit. |
| `RPT-024 pdf_layout_quality` | `APPROVED_ACTIVE` | snapshot × PDF template/renderer | manifest + claims + chart renders | A4 seçimi, embed Türkçe font, bölüm/sayfa yapısı, header/footer ve bütün sayfa visual QA; kırpılma/taşma/boş final sayfa publish'i bloklar. |
| `RPT-025 xlsx_structure_safety` | `APPROVED_ACTIVE` | snapshot × XLSX template/renderer | manifest + yetkili detail + claims | Zorunlu sekmeler, Table/filter/freeze, gerçek veri tipleri/control totals; KPI yeniden hesaplanmaz, formula injection/macro/external link yok. |
| `RPT-026 image_artifact_safety` | `APPROVED_ACTIVE` | widget/report × image template | manifest + chart spec | En az 2× PNG; sanitize scriptsiz/external-resource'suz SVG; başlık/dönem/birim/coverage/snapshot id ve kırpılmasız render. |
| `RPT-027 cross_format_reconciliation` | `APPROVED_ACTIVE` | snapshot × published artifacts/UI | manifest/result/claim ids + exact values | HTML/PDF/XLSX/PNG/SVG/chat aynı ids/sayı/state/coverage; display rounding ortak, format başına hesap/model çağrısı yok. |
| `RPT-028 ai_focus_renderer_contract` | `APPROVED_ACTIVE` | focus analysis × surface | `AIFOCUS-*` + snapshot/claim set | Koyu cam/akıcı panel, typewriter hover-focus ve geniş Analiz modalı erişilebilir biçimde korunur; read-only ve tek claim setine bağlıdır. |
| `RPT-029 report_audit_observability` | `APPROVED_ACTIVE` | run/snapshot/drill/export/download | actor/scope/request/version/hash/state | Korelasyonlu audit/metric/log; PII ve hassas detail telemetry'de yok, failure/retry/quality reason izlenebilir. |
| `RPT-030 narrative_optional_resilience` | `APPROVED_ACTIVE` | snapshot × Paket 14 availability | deterministic digest + approved claims | Yeni AI anlatı yoksa `AI_NARRATIVE_UNAVAILABLE`; sayısal rapor/artifact çalışır, renderer serbest fallback metni veya sayı üretmez. |
| `AIFOCUS-001 focus_context_contract` | `APPROVED_ACTIVE` | domain entity/report/widget × run | domain state, metric/evidence refs, coverage | Tipli focus key/context hash, scope/as-of, priority, refs, exclusions, freshness ve allowed actions; context yoksa serbest yorum yok. |
| `AIFOCUS-002 deterministic_focus_digest` | `APPROVED_ACTIVE` | focus context | domain policy/materiality | Modelsiz compact status+en çok üç kanıt+coverage+iki next check. Liste açılışında satır başına model çağrısı yok. |
| `AIFOCUS-003 on_demand_claim_set` | `APPROVED_ACTIVE` | focus context × trigger | Paket 14 claim engine | User-open/bulk/snapshot trigger; FACT/INFERENCE/FORECAST/SCENARIO/RECOMMENDATION evidence bağlı. Kanıtsız sayı/neden/aksiyon reddedilir. |
| `AIFOCUS-004 focus_cross_surface_reuse` | `APPROVED_ACTIVE` | analysis id × snapshot | card/detail/chat/PDF/XLSX | Tek claim seti tüm yüzeylerde; material selection karşıt bulguyu gizlemez; renderer yeni analiz yapmaz. |
| `AIFOCUS-005 focus_cache_security` | `APPROVED_ACTIVE` | context/run/policy/model/prompt/locale/auth hash | RLS/capabilities | Hash değişiminde stale; authorization kapsamları cache paylaşmaz; eski claim güncel görünmez. |
| `AIFOCUS-006 focus_display_state` | `APPROVED_ACTIVE` | widget instance | digest/generation/claim/coverage/auth | EMPTY/READY_DIGEST/GENERATING/READY/STALE/BLOCKED_DATA/ERROR/UNAUTHORIZED; durum yalnız renk değildir, evidence/freshness erişilebilir. |
| `AIFOCUS-007 dispatch_focus_context` | `APPROVED_ACTIVE` | bugünkü dispatch order/card | Paket 07B/08/08A/10/10A/12A-B | Operasyon→cari/risk→resmî ödeme/allocation→aging/FIFO→araç→coverage→next check. Sipariş−ödeme hesabı ve geçmiş queue yok. |
| `AIFOCUS-008 temporary_official_payment_boundary` | `APPROVED_ACTIVE` | dispatch focus payment evidence | Belgeler/resmî event/allocation | TEMP yalnız sinyal; resmî event allocation olmadan sipariş/fatura ödendi değildir. Çek/Senet kabulü nakit değildir; araç riski ayrı. |
| `AIFOCUS-009 focus_action_boundary` | `APPROVED_ACTIVE` | claim recommendation × allowed action | capability/workflow/Paket 11 preview | Analiz read-only; eylem ayrı workflow/preview açar, claim doğrudan mutation yapmaz. |
| `AIFOCUS-010 focus_quality_gate` | `APPROVED_ACTIVE` | analysis claim set | evidence, materiality, coverage, semantic policy | Max 3 finding/2 next check, blocked/clear dil sınırı, provenance, ters bulgu, no unsupported causality ve UI/format birebirliği geçmeden publish yok. |
| `AIFOCUS-011 legacy_ux_preservation` | `APPROVED_ACTIVE` | mevcut AI panel/tooltip/modal karakterizasyonu | Paket 12E renderer + aynı claim seti | Koyu cam rapor paneli, durum rozeti/sol vurgu, akıcı özet+aksiyon, typewriter/dönüşümlü tooltip, geniş sekmeli Analiz modalı, metrik/grafik ve mor-mavi içgörü karakteri korunur; kuru madde-only dönüşüm yoktur. |
| `AIFOCUS-012 legacy_semantic_replacement` | `APPROVED_ACTIVE` | mevcut UI kabuğu × yeni sonuç manifesti | merkezî metric/evidence/claim ids | Görsel akış korunurken shadowLimit, Master fallback, sabit profil, yanlış dönem/vade ve allocation dışı kapanma kaldırılır; renderer yeni hesap yapmaz. |

### Sellout tarihsel karşılaştırma ve AI raporu

| ID | Durum | Seviye | Kaynak | Hesap/üretim sözleşmesi |
|---|---|---|---|---|
| `SORPT-001 monthly_sellout_series` | `APPROVED_ACTIVE` | kapsam × `YYYY-MM` | `EVT-001/001A`, `ACT-001..004`, coverage | Faturalama Tarihli her ay için brüt/iade/ters/net litre ve coverage. Aylar kronolojik tekildir; MISSING/PARTIAL 0 değildir. |
| `SORPT-002 channel_kpi_reconciliation` | `APPROVED_ACTIVE` | dönem × Master kanal | `CUS-003`, `ACT-004/010/013` | Açık, Kapalı, Unclassified ve Genel net litre; `general=open+closed+unclassified`. Unclassified iki kanala tahminle dağıtılmaz. |
| `SORPT-003 comparison_period_spec` | `APPROVED_ACTIVE` | cari/kıyas dönem çifti | month catalog, kullanıcı seçimi | `NONE, PREVIOUS_MONTH, SAME_MONTH_PREVIOUS_YEAR, PREVIOUS_EQUAL_PERIOD, EXPLICIT_PERIODS`; resmî kıyasta ay sayısı ve scope/filter aynı. Sellout financial rolling 3/6/12 değildir. |
| `SORPT-004 comparison_coverage_gate` | `APPROVED_ACTIVE` | metrik × dönem çifti | iki taraf source/metric/scope coverage | Tam ve eş kapsam karşılaştırılır. Eksik/farklı coverage `NON_COMPARABLE/PARTIAL`; doğrulanmamış boş ay sıfır düşüş değildir. |
| `SORPT-005 sellout_period_delta` | `APPROVED_ACTIVE` | KPI/ay × dönem çifti | `SORPT-001..004`, `RPT-001` | Cari, kıyas, mutlak fark ve güvenli yüzde değişim. Base 0 ise percent null/`BASE_ZERO`; both zero percent null; ham exact litre kullanılır. |
| `SORPT-006 channel_share_shift` | `APPROVED_ACTIVE` | kanal × dönem çifti | `SORPT-002/005` | Açık/Kapalı/Unclassified payları ham dönem litrelerinden ve yüzde-puan değişimiyle hesaplanır; aylık pay ortalaması yoktur. |
| `SORPT-007 sellout_comparison_contributions` | `APPROVED_ACTIVE` | ay/müşteri/aile/rep/SSM × dönem çifti | Paket 04 leaf metric results | Artış/düşüş katkıları top-N + `DİĞER` ile toplam delta/toplama mutabıktır; dış neden iddiası üretmez. |
| `SORPT-008 sellout_report_manifest` | `APPROVED_ACTIVE` | rapor snapshot | `SORPT-001..007`, source/run/template metadata | KPI, monthly facts, comparison, contribution, coverage, filters, result ids, chart/table refs, claim ids ve versions için format bağımsız tek manifest. |
| `SORPT-009 sellout_report_layout` | `APPROVED_ACTIVE` | template version × manifest | `SORPT-008`, örnek PDF karakterizasyonu | Başlık/dönem/kanal tanımı, üç KPI, monthly grouped bar, total trend, detay tablo, toplam, coverage, kaynak/footer. Uzun dönem facet/sayfalı; ay atlanmaz. |
| `SORPT-010 sellout_ai_narrative` | `APPROVED_ACTIVE` | manifest × dil | `SORPT-005..008`, AI claim policy | Toplam→kanal→önemli ay→katkı→iade/coverage sırası; iddialar result ids'e bağlı. Fiyat/kampanya/hava/rakip nedeni kanıtsız uydurulmaz. |
| `SORPT-011 sellout_cross_format_delivery` | `APPROVED_ACTIVE` | manifest × output mode | `RPT-004..013`, `SORPT-008..010` | Sohbet, PDF, XLSX, PNG/SVG aynı manifest ve claim setini kullanır; format başına yeniden hesap/AI analizi yoktur. |
| `SORPT-012 sellout_artifact_quality` | `APPROVED_ACTIVE` | artifact job | `SORPT-009/011`, render/open validators | PDF tüm sayfa render kalite kapısı; XLSX tip/sekme/toplam; image çözünürlük/etiket. Kırpılma, okunmaz eksen, bozuk Türkçe veya sayı farkında publish yok. |

### Belgeler — finansal matristen bağımsız operasyonel kontrol

| ID | Durum | Seviye | Kaynak | Hesap sözleşmesi |
|---|---|---|---|---|
| `OPS-DOC-001 operational_document_event` | `APPROVED_ACTIVE` | geçici belge × müşteri × gün × snapshot | `Belgeler` staging | Ham geçici operasyon evrakı; doğrudan yayımlanmaz, tahsilat veya bakiye hareketi üretmez. |
| `OPS-DOC-002 document_face_value` | `APPROVED_ACTIVE` | belge | Belgeler `Tutar` | Yalnız operasyon gösterimi için `abs(Tutar)`; finansal metriklere bağımlılık veremez. |
| `OPS-DOC-003 transient_snapshot_dedup` | `APPROVED_ACTIVE` | bayi × kapsam günü × kaynak snapshot | `OPS-DOC-001`, satır hash/doğal anahtar | Dosya içi tekrarlar tekilleştirilir; aynı kapsamın yeniden yüklenmesi append değil doğrulama sonrası atomik snapshot değişimidir. |
| `OPS-DOC-003A immutable_source_class` | `APPROVED_ACTIVE` | yükleme/satır | kaynak kayıt defteri, parser şeması | `BELGELER_TEMP` ile `OFFICIAL_CASH/TRANSFER/CHECK/NOTE` ayrımı yükleme girişinde verilir ve değiştirilemez; `Aktarıldı` alanı kaynak sınıfı veya finansal geçerlilik belirlemez. |
| `OPS-DOC-003B transient_snapshot_disappearance` | `APPROVED_ACTIVE` | geçici olay × ardışık tam snapshot | önceki/yeni Belgeler snapshot'ı | Önce vardı, aynı kapsamın yeni tam snapshot'ında yoksa aktif sinyalden çıkar; önce resmî arşivle mutabakat aranır, eşleşme yoksa `REMOVED_BEFORE_TRANSFER`. Kısmi snapshot yokluk kanıtı değildir. |
| `OPS-DOC-004 official_collection_reconciliation` | `APPROVED_ACTIVE` | geçici belge ↔ bütün geçmiş resmî tahsilat | Belge Numarası; müşteri/Cari Kodu 2, `abs(Tutar)`, Tarih/Fatura Tarihi, kaynak sınıfı, araç no | Önce aynı Belge Numarası adayı; sonra müşteri+tutar+tarih+beklenen kaynak doğrulaması, Çek/Senette araç no. Belge no yok/değişmişse yalnız benzersiz bileşik eşleşme. Resmî olay üstün; eşleşen geçici `MATCHED_REPLACED`, çoklu/çelişkili `AMBIGUOUS_RECONCILIATION`; ikinci finansal hareket yok. |
| `OPS-DOC-004B payment_source_mapping` | `APPROVED_ACTIVE` | Belgeler ödeme tipi → resmî kaynak | gerçek veri testi | `Kredi Kartı/Nakit→OFFICIAL_CASH`, `Banka havalesi→OFFICIAL_TRANSFER`, `Alınan Çek→OFFICIAL_CHECK`, `Alınan Senet→OFFICIAL_NOTE`. Bilinmeyen tip otomatik eşleşmez. Belgeler alt türü yalnız provenance zenginleştirmesidir. |
| `OPS-DOC-004C reconciliation_observed_coverage` | `APPROVED_ACTIVE` | mevcut örnek snapshot | 106 Belgeler, 4.244 resmî satır | `106/106` aynı belge no; hepsinde müşteri+mutlak tutar+tarih eşit; `99 Nakit dosyası, 5 Havale, 2 Çek`; `0` çoklu ve `0` eşleşmeyen. Kaybolup aktarılmayan gerçek vaka gözlenmedi; tek snapshot sınırı raporlanır. |
| `OPS-DOC-004A reconciliation_link` | `APPROVED_ACTIVE` | geçici olay ↔ resmî olay | iki değişmez olay kimliği | Olaylar ayrı kalır; bağlantı yöntem, güven, tarih, calculation run ve kullanıcı kararını taşır. Ham geçici satır resmî satıra dönüştürülmez. |
| `OPS-DOC-005 canonical_operational_signal` | `APPROVED_ACTIVE` | ekonomik olay × müşteri × gün | `OPS-DOC-003/004`, resmî tahsilat arşivi | Görünümde varsa resmî olay, aksi halde yalnız `TEMP_ACTIVE` Belgeler satırı bulunur. Aynı ekonomik olay en fazla bir kez görünür ve toplanır; `UNION ALL` toplaması yasaktır. |
| `OPS-DOC-006 official_snapshot_takeover` | `APPROVED_ACTIVE` | bayi × resmî kaynak × mutabakat kapsamı | resmî yükleme coverage'ı, `OPS-DOC-004` | Resmî yükleme sonrası kesin eşleşen geçiciler aktif görünümden çıkar. Eşleşmeyen geçiciler otomatik silinmez; oran sonucuna göre istisna veya düşük-eşleşme incelemesine gider. |
| `OPS-DOC-006C reconciliation_match_rate` | `APPROVED_ACTIVE` | bayi × Belgeler snapshot × mutabakat kapsamı | `OPS-DOC-003/004` | `100 × (kesin eşleşen + kullanıcı onaylı eşleşen benzersiz geçerli satır) / benzersiz geçerli kapsam satırı`. Mükerrer/geçersiz/kapsam dışı satırlar ayrı DQ; belirsiz aday paya girmez. Payda `0` ise null. |
| `OPS-DOC-006D reconciliation_batch_state` | `APPROVED_ACTIVE` | mutabakat batch'i | `OPS-DOC-006C` | Oran `≥%80→RECONCILED_WITH_EXCEPTIONS`; `<%80→LOW_MATCH_REVIEW`. Eşik satır eşleştirme şartını gevşetmez ve hiçbir eşleşmeyeni otomatik silmez. |
| `OPS-DOC-006E unmatched_exception_queue` | `APPROVED_ACTIVE` | eşleşmeyen geçici olay | `OPS-DOC-004/006D` | `%80+` batch'te belge/müşteri/tarih/tutar/tip/aday/neden ile istisna raporu; kullanıcı tekil/toplu `MANUAL_EXCLUDED/DELETED`, beklet veya manuel eşleştir kararı verir. Ham satır ve karar izi korunur. |
| `OPS-DOC-006A removed_untransferred_outcome` | `APPROVED_ACTIVE` | geçici olay | `OPS-DOC-003B/004` | Belgeler'den kaybolup hiçbir resmî kayda eşleşmeyen olay `BELGE_SİLİNDİ_AKTARILMADI`; finansal etkisi ve aktif ön sinyali `0`, audit/fark kaydı korunur. Sonraki resmî kayıt eşleşirse durum kapanır. |
| `OPS-DOC-006B disappeared_prepayment_alert` | `APPROVED_ACTIVE` | teslim edilmiş fatura × müşteri | `OPS-DOC-006A`, sevk/fatura bağlantısı | Sevk kararından önce görülen geçici peşin sinyal sonradan kaybolup resmileşmediyse `PREPAYMENT_SIGNAL_DISAPPEARED`; yeni resmî ödeme gelirse yeniden hesaplamayla kapanır. |
| `OPS-DOC-007 dispatch_document_status` | `APPROVED_ACTIVE` | müşteri/belge × gün | `OPS-DOC-005/006D/006E`, belge türü/statüler | `geçici belge mevcut`, `resmî kayıtla değiştirildi`, `eşleşmeyen istisna`, `düşük eşleşme incelemesi`, `kullanıcı sildi/kapsam dışı`, `mutabakat gerekli` gibi yönlendirici durum; finansal geçerlilik anlamına gelmez. |
| `OPS-DOC-008 reconciliation_candidate_router` | `APPROVED_ACTIVE` | geçici olay × run × aday | `OPS-DOC-003A/004/004B`, Paket 08 geçerli arşiv | Önce exact belge no ve bütün ekonomik doğrulama alanları; belge no yok/güvenilmezse exact dealer+customer+amount+currency+source kind ve sürümlü tarih penceresinde benzersiz bileşik aday. v1 pencere `0 gün`; belge no alan çatışması bileşik fallback'e düşmez. | Fuzzy ad/yakın tutar yok; 0 aday `UNMATCHED`, çoklu aday `AMBIGUOUS_RECONCILIATION`, alan çatışması `DOCUMENT_KEY_FIELD_CONFLICT`. |
| `OPS-DOC-008A official_eligibility_at_cutoff` | `APPROVED_ACTIVE` | resmî olay × knowledge cutoff | Paket 08 event/revision/cancellation/lifecycle sonucu | Yalnız cutoff'ta geçerli ve kanonik resmî olay devralabilir. İptal/geçersiz/invalidated olay ödeme kanıtı olamaz; bütün geçmiş arşiv aranır. | Son dosya/aynı günle sınırlama yok; sonradan invalidation yeni run üretir. |
| `OPS-DOC-008B reconciliation_decision_version` | `APPROVED_ACTIVE` | istisna × kullanıcı karar sürümü | `OPS-DOC-008`, preview/actor/capability/reason | `CONFIRM_MATCH`, `KEEP_UNMATCHED`, `MANUAL_EXCLUDE`, `RESTORE_EXCLUDED`, `MARK_REMOVED`; immutable preview→commit. Exact dealer/customer/amount/currency/source-kind çatışması override edilemez. | Kaynak/aday seti değişirse `PENDING_USER_APPROVAL`; aynı idempotency key ikinci etki üretmez. |
| `OPS-DOC-008C official_invalidation_fallback` | `APPROVED_ACTIVE` | bağlantı × yeni resmî revision | `OPS-DOC-004A/005/008A` | Devralan resmî olay geçersizleşirse link overwrite edilmez; yeni revision `OFFICIAL_INVALIDATED`. Hâlâ etkin geçici olay varsa kanonik görünüm ona geri düşer, yoksa sinyal kaldırılır/istisna açılır. | Eski calculation run değişmez; knowledge cutoff açıklanır. |
| `OPS-DOC-009 canonical_signal_reconciliation` | `APPROVED_ACTIVE` | bayi × run × kanonik ekonomik olay | `OPS-DOC-005/006/008..008C` | `canonical visible = valid official linked signal ∪ active unmatched temp signal`, fakat aynı ekonomik olay tek kimlik/tutar katkısı taşır. Kanonik toplam = resmî bağlam toplamı + benzersiz aktif geçici yüz değeri. | Raw iki kaynağın `UNION ALL` toplamı ve sipariş/fatura tahsisi yasak; currency ayrı. |
| `OPS-DOC-009A downstream_invalidation_outbox` | `APPROVED_ACTIVE` | kanonik sinyal revision'ı × consumer | `OPS-DOC-003B/005/008C/009` | Transactional outbox en az `OPS_CANONICAL_SIGNAL_CHANGED`, `ST_COLLECTION_COMPONENT_CHANGED`, `DISPATCH_PAYMENT_CONTEXT_CHANGED`, `PREPAYMENT_SIGNAL_DISAPPEARED` üretir. | Consumer idempotency zorunlu; 08A downstream hesabı kopyalamaz. |
| `OPS-DOC-009B reconciliation_run_atomicity` | `APPROVED_ACTIVE` | bayi × kapsam × run | aday/link/batch/read model/outbox | Validate/preview sonrası publish tek transaction'da link revision, batch, kanonik görünüm ve outbox'ı değiştirir. | Hata eski görünümü korur; concurrent tek kazanan, stale sürüm `409`. |
| `OPS-DOC-010 reconciliation_control_equation` | `APPROVED_ACTIVE` | batch/run × source kind/currency | `OPS-DOC-003/004/006C/009`, DQ sınıfları | `valid_unique = auto_matched + user_matched + unmatched + ambiguous + field_conflict`; ayrıca excluded/invalid/duplicate/unsupported ayrı kontrol sayımları. Kanonik event/tutar toplamı benzersiz resmî devralmalar + etkin benzersiz geçici sinyallerle mutabık olmalıdır. | Kategoriler ayrık/tam kapsamlı değilse publish bloklanır; payda 0 oran null. |
| `OPS-DOC-010A financial_isolation_guard` | `APPROVED_ACTIVE` | kanonik operasyon sinyali × finansal tüketici | dependency registry/semantic descriptor | TEMP olay cari/tahsilat/FIFO/aging/DSO/CEI üretmez; devralma resmî olayın Paket 08 etkisini ikinci kez üretmez. `OFFICIAL_CONTEXT` belirli sipariş/fatura kapaması değildir. | İhlalde sonuç yayımlanmaz ve kritik dependency issue oluşur. |

### ST Tahsilat/Litre — Sellout günü ile önceki gün Belgeler eşleştirmesi

| ID | Durum | Seviye | Kaynak | Hesap sözleşmesi |
|---|---|---|---|---|
| `STL-001 report_and_collection_day` | `APPROVED_ACTIVE` | etkin rapor günü `D` | Europe/Istanbul yerel takvimi | Ay sonu olmayan pazar Sellout'u pazartesi `D`ye taşınır: pazartesi `{cumartesi,pazar}` tahsilatını kullanır. Pazar ay sonuysa kendi gününde cumartesiyi; izleyen pazartesi yalnız pazarı kullanır. En yakın dolu/same-day fallback yoktur. |
| `STL-001A effective_sellout_date` | `APPROVED_ACTIVE` | Sellout satırı | Faturalama Tarihi, takvim | Pazar ve ay sonu değilse izleyen pazartesi; aksi halde ham Faturalama Tarihi. Ham tarih ve diğer Sellout/FKNS raporları değişmez. |
| `STL-002 daily_sellout_net_litres` | `APPROVED_ACTIVE` | temsilci/SSM/şirket × etkin `D` | Onaylı günlük Sellout, `STL-001A` | Etkin günü `D` olan geçerli Sellout net litre toplamı; normal pazarteside pazar+pazartesi litreleri birleşir. Pozitif/iade ayrı taşınır, kümülatif litre kullanılmaz. |
| `STL-003 matched_operational_collection_signal` | `APPROVED_ACTIVE` | temsilci/SSM/şirket × `collection_dates(D)` | `OPS-DOC-005..007`, `STL-001` | Eşleşen bir veya iki günde kanonik operasyon görünümündeki `Müşteri Tahsilat` + `Nakit/Kredi Kartı/Banka havalesi/Sanal Pos` işaret-normalize toplamı. Resmî kayıt Belgeler karşılığının yerini alır; aynı olay iki kez sayılmaz. Bu ST sinyali cari/fatura kapama etkisi üretmez; Çek/Senet ve tanımsız sınıflar dışarıda ve mutabakatta kalır. |
| `STL-003A operational_signal_date` | `APPROVED_ACTIVE` | kanonik operasyon olayı | `OPS-DOC-004/005`, resmî işlem tarihi | Doğrudan resmî olay kendi onaylı tarihini; kesin Belgeler↔resmî devralma ortak doğrulanmış tarihi kullanır. Kontrollü pencere adayı olup tarihler farklıysa olay güne taşınmaz, `OPERATIONAL_DATE_CONFLICT` ile resmi ST payından çıkar. |
| `STL-004 operational_tl_per_litre` | `APPROVED_ACTIVE` | temsilci/SSM/şirket × etkin `D` | `STL-002/003` | `Σ collection_dates(D) operasyonel tahsilat sinyali / Σ effective_sellout_date=D net litre`. Normal pazartesi payı cumartesi+pazar, paydası pazar+pazartesi Sellout'tur; ay sonu istisnası `STL-001`e uyar. Litre `≤0` ise null. |
| `STL-005 responsibility_aggregation` | `APPROVED_ACTIVE` | müşteri→temsilci→SSM | Master geçerlilikli hiyerarşi | İki kaynak müşteri bazında kendi günündeki sorumluluğa gruplanır; üst seviye ham TL ve litre toplamından yeniden hesaplanır, oran ortalaması yasak. |
| `STL-006 day_pair_coverage` | `APPROVED_ACTIVE` | kapsam × `D/collection_dates(D)` | İki kaynak yükleme kapsamı | Etkin Sellout günü ile eşleşen her kaynak gününün ayrı completeness durumu, dahil/dışlanan satır/tutar/litre ve son yükleme zamanı. Ay sonu pazar istisnası ayrıca doğrulanır; eksik gün sıfır değildir. |
| `STL-006A completeness_state` | `APPROVED_ACTIVE` | kaynak × tarih × kapsam | onaylı coverage manifestleri | `COMPLETE_ZERO/COMPLETE_OBSERVED/PARTIAL/MISSING`. Her zorunlu gün tam değilse bilinen bileşenler görünür fakat resmi oran null ve `PARTIAL_COVERAGE`; satır yokluğu tek başına sıfır kanıtı değildir. |
| `STL-007 period_tl_per_litre` | `APPROVED_ACTIVE` | temsilci/SSM/şirket × `[A,B]` | `STL-001..006` | `[A,B]` Sellout günlerinin takvim eşlemeleri kurulur; `Σ benzersiz eşleşmiş Belgeler kaydı operational TL / Σ net litre`. Günlük oran ortalaması ve aynı Belgeler kaydını iki kez saymak yasaktır; çakışma `OVERLAPPING_DAY_PAIR`, eksik gün partial üretir. |
| `STL-007A period_partial_policy` | `APPROVED_ACTIVE` | kapsam × `[A,B]` | `STL-006A/007` | Herhangi zorunlu pair partial/missing ise resmi dönem oranı null olur; bilinen pay/payda yalnız açık `observed_only` kontrol sonucu olabilir. Eksik günler atılıp tam dönem etiketi verilemez. |
| `STL-008 product_channel_detail` | `APPROVED_ACTIVE` | ürün ailesi/kanal × `D/dönem` | Sellout | Litre kırılımı gösterilir; Belgeler ürüne bağlı olmadığı için operasyonel tahsilat ürünlere dağıtılmaz ve ürün bazlı resmî TL/L üretilmez. |
| `STL-009 period_comparison` | `APPROVED_ACTIVE` | eş Sellout dönem çiftleri | `STL-007`, `RPT-001` | Her dönem kendi `collection_dates(D)` takvim eşlemeleriyle hesaplanır; pazartesi hafta sonu istisnası iki döneme de uygulanır, mutlak/yüzde fark coverage eşitse yorumlanır. |
| `STL-010 component_uniqueness` | `APPROVED_ACTIVE` | calculation run × source event | day-pair component manifesti | Her Sellout line yalnız tek effective güne, her kanonik operasyon olayı yalnız tek day pair'e katkı verir. Unique constraint/reconciliation ihlalinde sonuç yayımlanmaz. |
| `STL-011 metric_semantic_guard` | `APPROVED_ACTIVE` | ST sonucu/AI claim | `STL-004/007`, semantic descriptor | Sonuç `operasyonel sinyal TL / Sellout net litre`dir; fiyat, ciro, resmî tahsilat verimliliği, müşterinin litre bedeli veya fatura kapama oranı diye adlandırılamaz. |

### Sipariş belgesi ve Sevkiyat Takip

| ID | Durum | Seviye | Kaynak | Hesap sözleşmesi |
|---|---|---|---|---|
| `ORDOP-001 sales_order_document` | `APPROVED_ACTIVE` | satış belge no | Sipariş dosyası | `Satış Belge No` kanonik belge anahtarı; müşteri/tarih/tür/fatura/yükleme ve kaynak satır bağlantıları korunur. Boş veya çelişkili anahtar resmi görünüme girmez. |
| `ORDOP-002 requested_delivery_day` | `APPROVED_ACTIVE` | belge | `İstenilen Tsl. Trh.` | Sevkiyat rapor günü bu alandır. Bugünkü kuyruk `requested_delivery_date=report_date`; satış belge tarihi yalnız bağlamdır. |
| `ORDOP-003 document_amount_once` | `APPROVED_ACTIVE` | belge | Sipariş Toplam Tutar | Aynı belge satırlarında tekrarlanan bütün-belge tutarı bir kez alınır. Boş/0 tutar adet kapsamında `AMOUNT_NOT_PROVIDED`, TL toplamında katkısızdır; negatif/non-numeric veya farklı dolu değer bloke. Satır toplamı yasak. |
| `ORDOP-004 document_status_set` | `APPROVED_ACTIVE` | belge | bütün satır Teslimat Durumları | Tekil durum kümeleri `READY_OR_WAITING/IN_TRANSIT/COMPLETED/DEFERRED/REJECTED_OR_CANCELLED`; farklı aktif durumlar `PARTIAL_OR_MIXED`. |
| `ORDOP-005 active_dispatch_scope` | `APPROVED_ACTIVE` | bayi × rapor günü × görünüm sınıfı | `ORDOP-001..004`, tür router | `Depo Satışı/Soğuk Satış&Depozito→SIPARIS`; `Sevki Ertelenecek Sp→EMANET_SP`; `Key Account Sipariş→KEY_ACCOUNT_EXCLUDED`. Key Account raw/audit'te kalır fakat görünür liste, adet ve tutara katkı vermez. Tür, teslimat durumundan bağımsızdır; `DEFERRED` yalnız gerçek `Ertelendi` durumundan gelir. |
| `ORDOP-006 mixed_status_amount_rule` | `APPROVED_ACTIVE` | belge | `ORDOP-003/004` | Karma belgede tutar bir kez gösterilir; kalem tutarı yoksa statülere dağıtılmaz. Durum kümesi/satır adedi açıkça taşınır. |
| `ORDOP-007 operational_payment_context` | `APPROVED_ACTIVE` | sipariş belge × müşteri | `OPS-DOC-005..007` | Resmî üstün/Belgeler geçici kanonik sinyal yalnız bağlamdır. Sipariş tutarından çıkarılmaz, finansal kapama üretmez, siparişsiz müşteri eklemez. |
| `ORDOP-008 dispatch_exception` | `APPROVED_ACTIVE` | belge | anahtar/tarih/tür/durum/müşteri/tutar kontrolleri | Çelişkili müşteri/tutar, geçersiz tarih, bilinmeyen tür/durum, iptal-red çelişkisi, mixed ve coverage eksikliği kodlu inceleme üretir. |
| `ORDOP-009 dispatch_operational_state` | `APPROVED_ACTIVE` | satış belgesi × rapor günü | `ORDOP-001..008` | `BLOCKED_DATA > MIXED_REVIEW > ACTION_NOW > IN_TRANSIT > COMPLETED > DEFERRED > EXCLUDED`; finansal risk/skor değildir. |
| `ORDOP-010 daily_dispatch_summary` | `APPROVED_ACTIVE` | bayi × rapor günü × görünüm sınıfı × durum | etkin `SIPARIS/EMANET_SP` belgeleri | Belge adedi ve `Σ document_amount_once`; durum ve iki görünüm sınıfı toplamları benzersiz günlük görünür evrenle mutabık. `KEY_ACCOUNT_EXCLUDED` paydada/tutarda yok, yalnız exclusion kontrolünde. Tutar coverage'ı ayrıca. |
| `ORDOP-010A customer_dispatch_group` | `APPROVED_ACTIVE` | bayi × rapor günü × görünüm sınıfı × müşteri | görünür farklı satış belgeleri, `ORDOP-003/009/017` | Aynı müşterinin farklı belge numaraları tek müşteri satırında `document_count + Σ document_amount_once` gösterilebilir; önce belge tekilleşir. Sipariş/Emanet SP ayrı gruptur. Eksik tutarda grup partial; state dağılımı korunur, attention state yalnız sıralamadır. Ödeme bağlamı grupta bir kez, link/aksiyon/handoff belge bazındadır. |
| `ORDOP-011 overdue_open_dispatch` | `PASSIVE_BY_POLICY` | geçmiş satış belgesi | önceki gün siparişleri | Kullanıcı kararıyla Sevkiyat Takip geçmişi/geçmiş-açık kuyruğu yoktur; hesaplanmaz ve API/AI/UI'a açılmaz. Teslim edilmiş finansal takip Fatura Kontrol'dedir. |
| `ORDOP-012 dispatch_card` | `APPROVED_ACTIVE` | satış belgesi | `ORDOP-*`, Master, FCTL link, OPS-DOC context | Kimlik/sorumluluk, tarih/tür, durum kümesi, yükleme/fatura referansı, tekil tutar, ödeme bağlam etiketi, istisna ve drill-down read-model'i. |
| `ORDOP-013 load_reference_quality` | `APPROVED_ACTIVE` | satış belgesi | Yükleme numarası, operasyon durumu | Boş/0 gerçek referans değildir. ACTION_NOW'da bilgi; IN_TRANSIT/COMPLETED'da `MISSING_LOAD_REFERENCE` incelemesi. Durumu otomatik değiştirmez. |
| `ORDOP-014 active_daily_order_snapshot` | `APPROVED_ACTIVE` | bayi × yerel bugün | bugünün son geçerli tam sipariş yüklemesi | Yeni başarılı aynı-gün tam küme eskisini atomik değiştirir; başarısız yayın son geçerliyi korur. Eski iş satırları rapor/AI geçmişi değildir; yalnız teknik import audit'i kalabilir. |
| `ORDOP-015 order_snapshot_disappearance` | `PASSIVE_BY_POLICY` | ardışık gün/snapshot | eski sipariş gözlemleri | Sevkiyat geçmişi tutulmadığı için iş metriği/istisna üretilmez. Aynı gün tam küme değişimi yeni kaynağı esas alır; manuel override çatışması genel `MAN-006` ile korunur. |
| `ORDOP-016 status_transition_quality` | `PASSIVE_BY_POLICY` | geçmiş durum zinciri | eski sipariş gözlemleri | Kullanıcıya açık durum geçmişi ve gerileme analizi yoktur. Güncel snapshot durumu kullanılır; yalnız kaynak/manual denetim izi teknik logda kalır. |
| `ORDOP-017 payment_context_label` | `APPROVED_ACTIVE` | satış belgesi × müşteri/gün | `OPS-DOC-005..007` | `TEMP_SIGNAL/OFFICIAL_CONTEXT/AMBIGUOUS/NONE/UNAVAILABLE_DEPENDENCY`; tutardan düşmez, siparişlere dağıtılmaz, paid/approved üretmez, finansal ayrıntıya handoff sağlar. |
| `ORDOP-018 dispatch_list_order` | `APPROVED_ACTIVE` | bugünkü filtreli belge kümesi | `ORDOP-009/014` | Durum önceliği, varsa teslim zamanı ASC, tutar DESC, belge no ASC. Yalnız bugünkü son aktif snapshot; deterministik sayfalama. |
| `ORDOP-019 invoice_control_handoff` | `APPROVED_ACTIVE` | bugünkü teslim kanıtlı görünür `SIPARIS/EMANET_SP` belgesi | güvenli fatura bağı veya teslim/fatura istisnası | Her başarılı günlük publish'te kimlik, teslim kanıtı, fatura bağlantı durumu ve provenance hemen/idempotent Fatura Kontrol'e devredilir. Completed kanıtlı mixed ayrı incelemedir; Key Account/diğer excluded ve teslim kanıtsız belge handoff üretmez. Sevkiyat geçmişi oluşturmaz. |
| `ORDOP-020 current_day_manual_override` | `APPROVED_ACTIVE` | bugünkü aktif satış belgesi | kullanıcı önizleme+onay | Ham satırı değiştirmeyen sürümlü düzeltme/kapsam dışı/soft-delete/geri alma; günlük özet ve handoff etkisi önizlenir. |
| `ORDOP-021 same_day_reimport_conflict` | `APPROVED_ACTIVE` | belge doğal anahtarı × yeni yükleme | önceki kaynak + aktif override + yeni kaynak | Değişmediyse override korunur/bildirilir; kaynak değiştiyse `PENDING_USER_APPROVAL`, onaya kadar manuel sürüm etkin. `MAN-006..008` ile aynı motor. |
| `ORDOP-022 immediate_idempotent_handoff` | `APPROVED_ACTIVE` | satış belgesi+teslim kanıtı+bağ sürümü | her başarılı günlük publish | Uygun adayı FCTL'ye hemen upsert eder; aynı sürüm ikinci aday üretmez. Değişiklik yeni evidence version/restatement tetikler. |

### Teslim edilmiş Fatura Kontrol

| ID | Durum | Seviye | Kaynak | Hesap sözleşmesi |
|---|---|---|---|---|
| `FCTL-001 delivered_invoiced_candidate` | `APPROVED_ACTIVE` | fatura × teslimat | geçerli satış faturası, sipariş/sevkiyat | Yalnız güvenli bağlanan ve `Teslim Edildi/Depodan Teslim` tamamlanan aday. Eksik taraf veya çoklu eşleşme kodlu alarmdır; otomatik finansal hüküm yoktur. |
| `FCTL-002 prior_open_invoice_stack` | `APPROVED_ACTIVE` | müşteri × aday fatura anı | Paket 10 lot/FIFO | Aday fatura oluşmadan hemen önceki açık lotların adedi, tutarı ve en eski `invoice_age_days`; yeni fatura dahil edilmez. |
| `FCTL-003 current_open_invoice_stack` | `APPROVED_ACTIVE` | müşteri × report date | Paket 10 açık faturalar | Güncel açık belge adedi/tutarı/en eski yaş; aday faturanın açık/kısmi/kapalı durumu ayrıca. |
| `FCTL-004 prior_day_official_prepayment` | `APPROVED_ACTIVE` | aday fatura × D−1 | resmî Nakit/Kart-POS/normal Havale, FIFO | D−1 resmî nakit benzeri olay ve aday faturaya gerçekten uygulanan dağıtılmamış alacak ayrılır. Çek/Senet, IADE/HIZMET, devir/virman peşin nakit değildir. |
| `FCTL-005 operational_prepayment_signal` | `APPROVED_ACTIVE` | aday fatura × D−1/D | `OPS-DOC-*` | Belgeler yalnız geçici ön sinyal ve provenance; cari/allocation/kapama kanıtı değildir. Kaybolursa `FCTL-010`. |
| `FCTL-006 fifo_collection_path` | `APPROVED_ACTIVE` | aday fatura | `FIN-008*`, invoice allocation | Tahsilatın önce hangi eski lotlara, sonra adaya ne kadar uygulandığını ve kalan tutarı açıklar; same-day toplam çıkarımı yasak. |
| `FCTL-007 instrument_risk_at_delivery` | `APPROVED_ACTIVE` | müşteri × teslimat anı | açık Çek/Senet risk olayları | Teslimattaki açık araç riski ayrı bağlamdır; cariyle mahsup edilmez ve ödeme kabulüyle karıştırılmaz. |
| `FCTL-008 cash_prepayment_coverage` | `APPROVED_ACTIVE` | aday fatura | `FCTL-004/006/007` | Resmî nakit benzeri peşin allocation / aday fatura tutarı; veri yeterli değilse null. Açık araç riski ve sıfır resmî peşin kanıt inceleme alarmı üretir, otomatik karar değil. |
| `FCTL-009 control_alert` | `APPROVED_ACTIVE` | aday/eksik eşleşme | `FCTL-001..008`, coverage | Kod, severity, dayanak kimlikleri, kaynak, kesim, kapanma koşulu. Tanımlı kod+coverage olmadan “sorunlu” hükmü yasak. |
| `FCTL-010 disappeared_prepayment_signal` | `APPROVED_ACTIVE` | aday fatura | `OPS-DOC-006A/006B` | Daha önce görülen Belgeler peşin sinyali kaybolmuş ve resmileşmemişse alarm; resmî olay sonradan gelirse yeni run'da kapanır. |
| `FCTL-011 same_day_sequence_quality` | `APPROVED_ACTIVE` | aday fatura × gün | olay timestamps/provenance | Saat yoksa aynı gün tahsilatın sevkten önce/sonra olduğu çıkarılamaz; `SAME_DAY_SEQUENCE_UNKNOWN`. Onaylı bağ/timestamp olmadan peşin denemez. |
| `FCTL-012 aged_collection_evidence` | `APPROVED_ACTIVE` | aday fatura × müşteri × `D−1/D` × yaş dilimi | fatura lotları, `FIN-008C` allocations | Allocation anındaki fatura yaşıyla eski açık tutar; D−1 ve D'de bu lotlara uygulanan tutar; sınıf ve kalan tutar. Toplam tahsilat değil gerçek FIFO allocation ölçülür. |
| `FCTL-013 prior_day_collection_split` | `APPROVED_ACTIVE` | aday fatura × `D−1` | resmî cari azaltan olaylar, allocation/unapplied credit | D−1 toplamı `eski faturaya uygulanan + aday faturaya D tarihinde uygulanan + dağıtılmamış/kalan + kapsam dışı` olarak mutabık ayrılır; aynı tutar iki sınıfa giremez. |
| `FCTL-014 normalized_document_identity` | `APPROVED_ACTIVE` | kaynak belge kimliği | Fatura No, Satış Belge No, Sipariş Numarası | Kaynak metni korunur; trim/Excel gösterimi temizliği ve yalnız sayısal kimlikte baştaki sıfır normalizasyonu ile karşılaştırma anahtarı üretilir. Boş/0 sahte anahtar değildir. |
| `FCTL-015 dual_key_invoice_delivery_link` | `APPROVED_ACTIVE` | sipariş belgesi ↔ satış faturası | normalize Fatura No; normalize Satış Belge No↔Sipariş Numarası; müşteri/tutar/geçerlilik | İki güçlü anahtar doluysa aynı tek faturayı göstermeli; müşteri ve vergi dahil tutar birebir, `SATIS+CREATED` geçerli olmalı. Çelişki/blokajda bağlantı yok. |
| `FCTL-016 single_key_controlled_fallback` | `APPROVED_ACTIVE` | sipariş belgesi ↔ satış faturası | yalnız mevcut tek güçlü anahtar, müşteri, tutar | Diğer güçlü anahtar gerçekten boşsa; tek aday+müşteri+tutar birebir+geçerli fatura ile kontrollü bağ. Diğer anahtar dolu/çelişkiliyse fallback yasak. |
| `FCTL-017 invoice_delivery_link_state` | `APPROVED_ACTIVE` | sipariş belgesi | `FCTL-014..016`, teslim/fatura coverage | `CONFIRMED_DUAL_KEY`, `CONFIRMED_SINGLE_KEY`, `DELIVERED_WITHOUT_INVOICE_REFERENCE`, `ORDER_INVOICE_REFERENCE_NOT_IN_SALES_SOURCE`, `INVOICE_ORDER_KEY_CONFLICT`, `AMBIGUOUS`, `COVERAGE_INCOMPLETE`. Eksik kaynak “faturasız” diye yorumlanmaz. |
| `FCTL-018 invoice_delivery_observed_regression` | `APPROVED_ACTIVE` | mevcut örnek yüklemeler | 126 sipariş satırı/87 belge ve satış faturası arşivi | 73 tamamlanmış+Fatura No, 4 tamamlanmış+Fatura No boş; 25 dual-key kesin bağ; bu 25'te müşteri/tutar/anahtar çatışması ve belirsiz aday `0`. Tarih: 23 satış belge günü, 1 istenilen teslim günü, 1 diğer. |
| `FCTL-019 control_overall_state` | `APPROVED_ACTIVE` | fatura kontrol adayı | etkin alarmlar, coverage | En yüksek önem: `BLOCKED_DATA > CRITICAL_REVIEW > HIGH_RISK > ATTENTION > CLEAR_WITH_EVIDENCE`. Skor/mutasyon değildir; bütün alt alarmlar korunur. |
| `FCTL-020 aged_uncollected_new_delivery` | `APPROVED_ACTIVE` | müşteri × aday teslimat | `FCTL-002/003/006/012` | 29+ eski açık lot >0, D−1/D eski lot allocation=0 ve aday fatura açık ise `HIGH_RISK`; 0–28 gün aynı durum `ATTENTION`. Eksik coverage'da risk hükmü yerine `BLOCKED_DATA`. |
| `FCTL-021 invoice_control_card` | `APPROVED_ACTIVE` | aday fatura/teslimat | `FCTL-001..020` | Kimlik/tarih/bağ/mutabakat, önceki aging, D−1/D allocation ayrımı, peşin coverage, araç riski, güncel fatura durumu, alarmlar ve kanıt kimliklerinden tek read-model. |
| `FCTL-022 invoice_control_list_order` | `APPROVED_ACTIVE` | filtreli aday kümesi | `FCTL-019`, yaş/tutar/kimlik | Önce overall severity, sonra en eski açık yaş DESC, fatura tutarı DESC, kalıcı belge kimliği ASC; sayfalı ve deterministik. |
| `FCTL-023 review_workflow_state` | `APPROVED_ACTIVE` | alarm/aday × çözüm sürümü | kullanıcı aksiyonu, kanıt, calculation run | `OPEN/ACKNOWLEDGED/PENDING_USER_APPROVAL/RESOLVED/REOPENED/REJECTED_RESOLUTION`. Acknowledge nedeni kapatmaz veya severity'yi düşürmez. |
| `FCTL-024 manual_invoice_delivery_link` | `APPROVED_ACTIVE` | sipariş/teslim ↔ fatura | kullanıcı seçimi, aday kanıtları | Sürümlü `MANUAL_LINK_OVERRIDE`; ham anahtarlar değişmez. Kaynak anahtarı değişirse otomatik reuse yok, yeniden onay. |
| `FCTL-025 financial_mutation_boundary` | `APPROVED_ACTIVE` | Fatura Kontrol kullanıcı aksiyonu | merkezi finansal olay/FIFO/risk motoru | Peşin/tahsil edildi/kapandı/araç ödendi salt flag ile değişmez. Mevcut resmî bağlantı veya Paket 09/11 önizleme+commit gerekir. |
| `FCTL-026 manual_allocation_override_effect` | `APPROVED_ACTIVE` | tahsilat ↔ fatura lotları | kullanıcı seçimi, Paket 10 replay | Etkilenen bakiye, aging, kapama ve org metrikleri önizlenir; commit sonrası müşteri zinciri replay; geri alınabilir/auditli. |
| `FCTL-027 workflow_authorization` | `APPROVED_ACTIVE` | kullanıcı × capability × scope | Auth/RLS/backend policy | View/upload/bugünkü sipariş override/alarm acknowledge/link çözümü/finansal mutasyon/allocation override ayrı yetkiler; preview ve commit tekrar doğrulanır. |
| `FCTL-028 control_run_manifest` | `APPROVED_ACTIVE` | control scope × as-of × knowledge cutoff × run | handoff, invoice/link, ledger, instrument, operational reconciliation ve org run'ları | Bütün candidate/evidence/alert aynı source manifest ve rule versions'a pinlidir; aynı manifest aynı sonuç verir. Source değişiminde yeni immutable run; stale publish/cursor `409`. |
| `FCTL-029 candidate_evidence_versioning` | `APPROVED_ACTIVE` | logical candidate × source/link revision | `ORDOP-019`, `FCTL-014..017`, manual link | Doğal key dealer+sales document+delivery evidence revision+link revision; exact tekrar idempotent. Değişen handoff/link aynı logical candidate'ın yeni version'ıdır; eski evidence/alert overwrite edilmez. |
| `FCTL-030 evidence_reconciliation` | `APPROVED_ACTIVE` | candidate × D−1/D × currency × run | reducing events, allocation, unallocated credit, exclusions | D−1 valid amount = old-lot allocations + D'de adaya uygulanan prepayment + closing unallocated + ineligible/excluded + invalidated explanation. Aynı tutar iki sınıfta olamaz; açıklanamayan fark publish'i bloklar. |
| `FCTL-031 prepayment_application_evidence` | `APPROVED_ACTIVE` | candidate invoice × eligible prior-day credit | `FCTL-004/006/013`, Paket 10 allocation | Peşin kanıt yalnız D−1 uygun resmî nakit benzeri olaydan kalan alacağın D'de adaya gerçek allocation'ıdır. Coverage `min(eligible allocated, principal)/principal`; fazla kredi ayrı kalır. Principal/coverage geçersizse null; olay varlığı tek başına peşin değildir. |
| `FCTL-032 coverage_gated_alert_router` | `APPROVED_ACTIVE` | candidate × alarm rule version | link/ledger/instrument/operational/source coverage | Davranış/risk alarmı yalnız gerekli coverage tamken üretilebilir. Eksik kanıt `BLOCKED_DATA`; overall priority sabit ve bütün alt alarmlar korunur. `CLEAR_WITH_EVIDENCE` borçsuzluk değildir; hiçbir state otomatik mutasyon üretmez. |

## 12C. Merkezi metrik motoru kontrol matrisi

| ID | Durum | Grain/tür | Girdi | Kesin kural |
|---|---|---|---|---|
| `MET-001 metric_registry_version` | `APPROVED_ACTIVE` | metric key × version | semantik, result kind, unit, grain, dönem, null/rounding, owner | Kalıcı key altında immutable DRAFT→VALIDATED→APPROVED_ACTIVE→RETIRED sürüm; semantik değişiklik yeni version, geçmiş overwrite yok. |
| `MET-002 metric_approval_gate` | `APPROVED_ACTIVE` | metric version | şema, calculator, dependency, fixture, coverage/reconciliation | Bütün kapılar ve actor/reason geçmeden activation yok; çakışan effective active version reddedilir. |
| `MET-003 typed_grain_dimension_contract` | `APPROVED_ACTIVE` | metric version × requested scope | allowlist dimensions, grain, rollup | Serbest JSON grain yok; yalnız eş grain veya onaylı rollup, canonical unique-sort. |
| `MET-004 unit_currency_contract` | `APPROVED_ACTIVE` | result/dependency | unit registry, currency policy, optional FX ref | Uyumsuz unit birleşmez; currency karışmaz; FX yalnız açık sürümlü dependency ile. |
| `MET-005 period_contract` | `APPROVED_ACTIVE` | metric × period | date basis, timezone, boundary policy | AS_OF/DAY/CALENDAR_MONTH/COMPLETED_MONTH_WINDOW/CUSTOM/FORECAST/SCENARIO ayrıdır; Sellout ayı finansal 3/6/12 değildir. |
| `MET-006 dependency_dag_validity` | `APPROVED_ACTIVE` | graph version | source/metric edges, required/optional, version constraints | Self/dolaylı cycle yok; closure ve topological order deterministik; required failure downstream'i bloklar. |
| `MET-007 minimal_calculation_plan` | `APPROVED_ACTIVE` | canonical request × graph version | requested metrics, dependencies, scope/period mapping | Minimal transitive closure; ortak node bir kez; bütün source/result/version/code girdileri immutable pinli. |
| `MET-008 canonical_request_hash` | `APPROVED_ACTIVE` | request × auth scope | typed scope/dimensions/period/scenario/defaults | Unicode/enum/date/currency/list normalize; null/empty/ALL ayrı; semantik eşdeğer istek aynı hash. |
| `MET-009 run_idempotency` | `APPROVED_ACTIVE` | canonical request × plan × auth | idempotency key/body/hash | Aynı key+body aynı run; farklı body 409; farklı auth scope sonuç/cache paylaşmaz. |
| `MET-010 run_state_and_lease` | `APPROVED_ACTIVE` | calculation run/node attempt | state machine, server lease, fencing token, heartbeat | Terminal geri dönmez; yalnız güncel token yazar/yayımlar; concurrency çift node/result üretmez. |
| `MET-011 deterministic_exact_execution` | `APPROVED_ACTIVE` | plan node × pinned inputs | calculator/code/parameter versions, optional seed | Decimal/integer exact; pinsiz clock/network/random/active read yok; aynı input aynı output hash. |
| `MET-012 metric_result_envelope` | `APPROVED_ACTIVE` | metric result | run/plan/version/scope/period/value/status/provenance | Raw/display, unit, pay/payda/components, sources/dependencies, coverage/reconciliation/evidence eksiksiz ve immutable. |
| `MET-013 result_state_semantics` | `APPROVED_ACTIVE` | result | completeness/eligibility/comparison/maturity | VALUE/ZERO/NULL_NOT_APPLICABLE/MISSING/PARTIAL/BLOCKED/IMMATURE/NON_COMPARABLE/BASE_ZERO birbirine çevrilmez. |
| `MET-014 contribution_integrity` | `APPROVED_ACTIVE` | result × leaf contribution | typed value/weight/evidence | Eligible katkılar control total'a exact; izinsiz leaf double count yok; top-N sunum motor sonucu değildir. |
| `MET-015 multidimensional_coverage_gate` | `APPROVED_ACTIVE` | result × coverage component | source/time/identity/classification/amount/dependency/domain | Pay/payda/state/reason ayrı; keyfî ortalama yok; kapı eksiği sahte zero değil PARTIAL/BLOCKED. |
| `MET-016 reconciliation_quality_gate` | `APPROVED_ACTIVE` | result/publication | sürümlü denklem, taraflar, precision tolerance | Unexplained delta görünür; exact kapı geçmezse publish yok; tolerans yalnız kaynak hassasiyetinden. |
| `MET-017 atomic_metric_publication` | `APPROVED_ACTIVE` | publication unit × run | manifest/results/quality/upstream refs/outbox | CAS active pointer en son; partial/stale upstream/transaction failure eski yayını korur; yalnız published normal okunur. |
| `MET-018 reproducibility_guard` | `APPROVED_ACTIVE` | same input manifest/version | canonical result/publication hashes | Aynı manifest aynı hash; fark `NON_DETERMINISTIC_RESULT` ve publish blokajıdır. |
| `MET-019 scoped_invalidation_replay` | `APPROVED_ACTIVE` | source/manual/version/hierarchy event × graph | earliest date, entities, two-sided transfer, org/period/consumers | Yalnız etkilenen closure idempotent replay; scope çözülemezse `BLOCKED_IMPACT_SCOPE`, sessiz global çalışma yok. |
| `MET-020 immutable_restatement` | `APPROVED_ACTIVE` | new publication × superseded publication | cause, old/new results, exact/state/coverage/reconciliation diff | Eski sonuç değişmez; backfill dry-run ayrı, active pointer yalnız açık publish ile değişir. |

## 13. Veri kalitesi ve sistem kontrol matrisi

| ID | Durum | Hesap | Karar etkisi |
|---|---|---|---|
| `DQ-001 source_freshness` | `APPROVED_ACTIVE` | `as_of_at-source_loaded_at` | Bayat veri uyarısı. |
| `DQ-002 missing_day_count` | `APPROVED_ACTIVE` | Beklenen fakat kapsam kaydı olmayan gün sayısı | Eksik günler sıfıra çevrilmez; tahmin güveni düşer/bloke olur. |
| `DQ-003 conversion_coverage` | `APPROVED_ACTIVE` | `doğrulanmış hacim stok kodu / hacim izlenen toplam stok kodu` | Aile stok hesap kapsamını açıklar. |
| `DQ-004 family_mapping_coverage` | `APPROVED_ACTIVE` | `doğrulanmış aileye bağlı kod / toplam hacim kodu` | Aday eşleme resmi toplamı etkilemez. |
| `DQ-005 duplicate_impact` | `OPTIONAL_DRAFT` | Mükerrer satır sayısı ve litre/TL etkisi | Mükerrer politikası uygulanmadan KPI bloke edilebilir. |
| `DQ-006 invalid_date_impact` | `APPROVED_ACTIVE` | Geçersiz/dönem dışı satır sayısı ve etkisi | Satır dışlanır, etki görünür. |
| `DQ-007 hierarchy_exception_count` | `APPROVED_ACTIVE` | Temsilci/SSM baskınlık kuralına uymayan müşteri/temsilci sayısı | Otomatik düzeltme yapılmayan kayıtları listeler. |
| `DQ-008 metric_dependency_health` | `APPROVED_ACTIVE` | Aktif metriğin başarısız/kapalı bağımlılık sayısı | Resmi sonuç üretimini engelleyebilir. |
| `DQ-009 reproducibility_check` | `APPROVED_ACTIVE` | Aynı snapshot+sürüm+filtreyle tekrar çalıştırma hash karşılaştırması | Sonuç deterministik değilse yayınlanmaz. |
| `DQ-010 ambiguity_issue` | `APPROVED_ACTIVE` | Tek güvenli eşleşme üretmeyen kayıt için sorun türü, adaylar, neden, etkilenen boyut/dönem ve tahmini tutar/litre etkisi | Kritikse yeni yükleme resmi hesaplamaya açılmaz; kullanıcıya görev oluşturur. |
| `DQ-011 manual_resolution` | `APPROVED_ACTIVE` | Kullanıcının seçtiği çözüm, eski/yeni normalize değer, gerekçe, kullanıcı, zaman, kanıt ve geçerlilik sürümü | Ham satırı değiştirmez; etkilenen bağımlılık zincirini yeniden hesaplatır. |
| `DQ-012 resolution_reuse_check` | `APPROVED_ACTIVE` | Yeni yüklemedeki doğal anahtar/kaynak değerlerinin mevcut manuel kararla uyuşması | Kaynak değişmediyse karar yeniden uygulanabilir; değiştiyse yeniden kullanıcı doğrulaması gerekir. |
| `DQ-013 unresolved_critical_count` | `APPROVED_ACTIVE` | Yükleme içindeki çözümlenmemiş bloke edici belirsizlik sayısı ve etkisi | `>0` ise run `awaiting_manual_resolution`; son geçerli snapshot yayında kalır. |
| `MAN-001 manual_transaction_add` | `APPROVED_ACTIVE` | finansal hareket | Kullanıcı girişi | `source_type=MANUAL`; kaynakla aynı zorunlu doğrulamalar ve hesap zinciri. |
| `MAN-002 manual_transaction_version` | `APPROVED_ACTIVE` | işlem × sürüm | Kullanıcı düzenlemesi | Ham satırı değiştirmeyen eski/yeni normalize değer, gerekçe, kullanıcı ve geçerlilik kaydı. |
| `MAN-003 exclude_from_calculation` | `APPROVED_ACTIVE` | işlem × geçerlilik | Kullanıcı kararı | Görünür kaydı resmi hesaplardan çıkarır; neden ve etki zorunlu. |
| `MAN-004 soft_delete_transaction` | `APPROVED_ACTIVE` | işlem × sürüm | Kullanıcı silme | Normal görünüm ve hesaplardan kaldırır; tombstone/denetim izi ve geri alma korunur. |
| `MAN-005 manual_change_impact` | `APPROVED_ACTIVE` | değişiklik × hesap bağımlılığı | Değişen işlem | Etkilenen müşteri/dönem/org/metrikleri belirler ve kısmi yeniden hesaplamayı tetikler. |
| `MAN-006 manual_source_conflict` | `APPROVED_ACTIVE` | doğal anahtar × yeni yükleme | Son kaynak sürümü + aktif manuel sürüm + yeni kaynak satırı | Alan bazlı üçlü diff, olası hesap etkisi ve `pending_user_approval`; manuel sürüm onaya kadar aktif kalır. |
| `MAN-007 conflict_resolution` | `APPROVED_ACTIVE` | çatışma × kullanıcı kararı | `MAN-006` | Manueli koru, kaynağı kabul et, alan bazında birleştir, kapsam dışı bırak, silinmiş tut veya bağlantıyı yeniden seç; karar yeni sürüm oluşturur. |
| `MAN-008 override_reapply_notice` | `APPROVED_ACTIVE` | değişmemiş yeniden yüklenen kayıt | Aynı yeni/eski kaynak + manuel override | İkinci hareket üretmez; `manuel override korunarak yeniden görüldü` kontrol kaydı ve kullanıcı özeti oluşturur. |
| `MAN-009 field_source_policy` | `APPROVED_ACTIVE` | kaynak/işlem/alan × geçerlilik | Kullanıcı politikası | Sınırlı ve geri alınabilir `kaynağı otomatik kabul et` veya `manuel değeri kilitle` davranışı. |
| `MAN-010 manual_domain_adapter_router` | `APPROVED_ACTIVE` | exact manual transaction type | Paket 07/08/09/10 domain adapter'ları | SATIS_FATURASI, IADE, HIZMET, NAKIT/HAVALE, CEK/SENET, DEVIR_BORC/ALACAK ve VIRMAN exact route edilir. Yön türden gelir; unknown/SATIN_ALMA müşteri olayına dönüşmez. |
| `MAN-011 mutation_preview_manifest` | `APPROVED_ACTIVE` | mutation request × expected versions | domain dry-run, dependency registry, actor scope | Before/after, bakiye, lot/FIFO/aging/kapama, instrument, KPI inclusion/exclusion, affected scope ve undo; request hash, expiration, versions/capabilities. Blocked invariant commit edilemez. |
| `MAN-012 atomic_manual_commit` | `APPROVED_ACTIVE` | confirmed preview × commit | `MAN-011`, actor confirmation, idempotency | Revision/decision/evidence, active projection, impact/replay ve outbox tek transaction'da. Aynı key+body tek etki; stale/auth loss/conflict reddedilir, rollback eski aktifi korur. |
| `MAN-013 manual_allocation_override` | `APPROVED_ACTIVE` | reducing event × selected lot parts | Paket 10 ledger/open lots | Aynı customer/currency/time; seçili toplam event'i ve lot open'ı aşmaz. FIFO-vs-override etkisi preview; commit/undo immutable replay. |
| `MAN-014 manual_link_override` | `APPROVED_ACTIVE` | iki source entity revision'ı | link evidence, Paket 07A/07B/10A | Ham key'i değiştirmeyen versioned bağlantı. Cross-scope/invalid entity yasak; source identity değişiminde auto-reuse yok, yeniden onay. |
| `MAN-015 three_way_field_state` | `APPROVED_ACTIVE` | natural key × field × O/M/N | last source, active effective/manual, new source | `UNCHANGED_SOURCE`, `SOURCE_CHANGED_MANUAL_UNCHANGED`, `MANUAL_CHANGED_SOURCE_UNCHANGED`, `BOTH_CHANGED_SAME_RESULT`, `BOTH_CHANGED_CONFLICT`, add/remove/type change; tipli exact comparison. |
| `MAN-016 conflict_pending_effective_value` | `APPROVED_ACTIVE` | açık manual-source conflict | `MAN-006/015`, last approved revision | N≠O iken yeni source immutable/audit ve pending'dir; last approved manual/effective resmî kalır, new source ikinci ekonomik etki üretmez. Coverage `PENDING_SOURCE_UPDATE`. |
| `MAN-017 field_policy_safety_gate` | `APPROVED_ACTIVE` | field policy version × new source diff | `MAN-009/015`, domain invariants | AUTO_ACCEPT_SOURCE/LOCK_MANUAL dar source/type/field/scope/validity policy'sidir. Critical identity/customer/currency/type/cancellation/instrument/link/security validation'ını bypass edemez; geri alınabilir. |
| `MAN-018 dependency_impact_and_replay` | `APPROVED_ACTIVE` | committed revision × dependency graph | Paket 07–10A/12/14 consumers | Earliest date, customers/entities/org/period/metric/report/tool ids; only affected chains idempotent replay/restatement/cache invalidation alır. Virman iki customer'ı atomik tetikler. |
| `MAN-019 ai_explicit_confirmation_gate` | `APPROVED_ACTIVE` | AI mutation plan × user confirmation | preview id/hash/expiry, actor capability | AI yalnız draft/preview üretir; unexpired exact preview bağlamında açık onay olmadan commit yoktur. Serbest “tamam” veya önceki confirmation başka preview'a taşınmaz. |

## 14. Senaryo matrisi

Senaryo hesapları resmi gerçekleşen veya tahminin üzerine yazmaz. Her sonuç `scenario_id`, varsayım, oluşturan kullanıcı, zaman ve temel hesap sürümleriyle saklanır.

| Senaryo ID | Değiştirilen girdi | Yeniden hesaplanan zincir |
|---|---|---|
| `SCN-001 target_change` | Kanal/temsilci hedefi `%x` | `TGT → FCST-013/014 → REQ → ORD → RISK` |
| `SCN-002 demand_surge` | Aile × kanal ek talep/devam güveni | `FCST → STK projection → SS → ORD` |
| `SCN-003 campaign` | Tarihli kampanya ek talebi/çarpanı | Günlük talep → stokout → ihtiyaç |
| `SCN-004 service_level` | Servis quantile'ı | `SS → kritik eşik → ihtiyaç/sipariş` |
| `SCN-005 protection_days` | `H` | Koruma talebi + hata dağılımı + SS + eşikler |
| `SCN-006 package_variant` | İkmal varyantı | Ham/yuvarlanmış miktar + yuvarlama fazlası |
| `SCN-007 stock_adjustment` | Kullanıcı senaryo stok litresi | Projeksiyon + risk + sipariş; gerçek snapshot değişmez |
| `SCN-008 return_normalization` | İade oranı varsayımı | Net talep + tahmin + stok projeksiyonu |
| `SCN-009 channel_mix` | Geleneksel/KA payı | Kanal tahminleri ayrı değişir, aile stoğunda birleşir |
| `SCN-010 inbound_delay` | ETA/gecikme | Şimdiki politikada `PASSIVE_BY_POLICY`; gerçek hesaba girmez |

## 14A. AI semantik ve yorum motoru kontrol matrisi

| ID | Durum | Grain/tür | Girdi | Kesin kural |
|---|---|---|---|---|
| `AIENG-001 backend_model_gateway` | `APPROVED_ACTIVE` | orchestration × provider attempt | server secret, approved model/provider policy | Tarayıcı anahtarı/doğrudan provider yok; timeout/retry/rotation/circuit-breaker idempotent, secret loglanmaz. |
| `AIENG-002 semantic_catalog_version` | `APPROVED_ACTIVE` | catalog key × version | Türkçe terms, bindings, forbidden legacy meanings, examples | Immutable DRAFT→VALIDATED→APPROVED_ACTIVE→RETIRED; onaysız/retired descriptor çözüm üretmez. |
| `AIENG-003 turkish_normalization` | `APPROVED_ACTIVE` | user utterance | Unicode, İ/I/ı/i, noktalama, ek/yazım ve kod politikası | Kavram varyantı deterministik; kimlik baştaki sıfır/precision kaybetmez. |
| `AIENG-004 semantic_query_plan` | `APPROVED_ACTIVE` | utterance × context × catalog × auth | domain, metric, entity, dimensions, filters, scope, period/comparison, kind, output/operation | Tipli immutable plan/hash; model serbest metric/formül/tool ekleyemez. |
| `AIENG-005 entity_resolution_guard` | `APPROVED_ACTIVE` | entity mention × authorized resolver | Paket 02/domain refs, candidates | İsim benzerliği kesin bağ değildir; yetkisiz aday/hata sızıntısı yoktur. |
| `AIENG-006 period_measure_semantics` | `APPROVED_ACTIVE` | metric intent × period phrase | descriptor period/unit/default policy | Sellout YYYY-MM, finansal tamamlanmış 3/6/12, sevkiyat bugün, stok latest ayrıdır; güvenli default görünür assumption'dır. |
| `AIENG-007 ambiguity_gate` | `APPROVED_ACTIVE` | candidate plans | metric/entity/period/scope/kind material differences | Birden çok maddi aday `AMBIGUOUS_BLOCKING`; model confidence tek başına sayı/tool çağrısı açmaz. |
| `AIENG-008 followup_context_scope` | `APPROVED_ACTIVE` | turn × prior response manifest | tenant/user/conversation, TTL, permission, restatement | Yalnız izinli context daraltılır; sessiz scope genişletme/cross-chat reuse yoktur. |
| `AIENG-009 tool_registry_version` | `APPROVED_ACTIVE` | tool key × version | schema, handler, class, capability, scope/result limits | Yalnız server-owned approved declaration; client/model endpoint/schema/capability ekleyemez. |
| `AIENG-010 tool_execution_firewall` | `APPROVED_ACTIVE` | plan × tool call × actor | input/output schema, auth, size/time policy | Input scope'a daralır, output sanitize edilir; data içindeki prompt instruction yürütülmez. |
| `AIENG-011 published_result_only` | `APPROVED_ACTIVE` | read tool result | Paket 13 publication/result envelope | Yalnız PUBLISHED exact result; client rows/Excel/prompt formülü ve staging/retired fallback yoktur. |
| `AIENG-012 orchestration_budget` | `APPROVED_ACTIVE` | orchestration run | max rounds/calls/concurrency/bytes/tokens | V1 4 round/8 call/2 parallel read; loop/fan-out/oversize reason code ile kesilir, mutation paralel değildir. |
| `AIENG-013 deterministic_analysis_digest` | `APPROVED_ACTIVE` | result manifest × analysis policy | direct, comparison, contributions+OTHER, anomaly/risk, coverage/counterevidence | Model öncesi exact digest; model eşik/yüzde/top-N hesaplamaz ve ters maddi bulguyu gizleyemez. |
| `AIENG-014 response_delivery_policy` | `APPROVED_ACTIVE` | query/result density/output intent | digest size, rows/dimensions/periods, requested formats | INLINE/INLINE_PLUS_VISUAL/REPORT_PACK; doğrudan cevap daima sohbette, format başına model çağrısı yok. |
| `AIENG-015 evidence_bound_claim` | `APPROVED_ACTIVE` | claim × result/evidence refs | typed claim schema, policy/model/prompt versions | Evidence gerektiren claim refsiz yayımlanmaz; entity/unit/period/state/result kind birebirdir. |
| `AIENG-016 numeric_fidelity_validator` | `APPROVED_ACTIVE` | response numeric mentions | exact/display result/component refs, locale/rounding policy | Her sayı kaynağa eşleşir; model yeni aritmetik yapamaz; required fidelity `%100`. |
| `AIENG-017 claim_kind_language_guard` | `APPROVED_ACTIVE` | FACT/INFERENCE/FORECAST/SCENARIO/RECOMMENDATION claim | result kind, horizon/assumption/caveat/target | Gerçek/çıkarım/tahmin/senaryo/öneri dili karışmaz; öneri uygulanmış işlem değildir. |
| `AIENG-018 causality_safety_gate` | `APPROVED_ACTIVE` | outcome claim | Package 12F association/experiment result | Causal dil yalnız geçerli CAUSAL_LIFT; diğerleri temporal/descriptive association, “AI tahsil etti” yok. |
| `AIENG-019 response_quality_gate` | `APPROVED_ACTIVE` | response/AI Focus claim set | materiality, counterevidence, coverage, forbidden claims | Sayı tekrarı/kanıtsız neden/öneri reddedilir; Focus max 3 bulgu/2 next check; validator fail-closed. |
| `AIENG-020 mutation_confirmation_protocol` | `APPROVED_ACTIVE` | draft/preview/confirmation/commit | preview hash/expiry, actor capability, expected versions, idempotency | Normal modele COMMIT yok; exact UI confirmation olmadan işlem yok; serbest “tamam” geçersiz. |
| `AIENG-021 privacy_prompt_injection_guard` | `APPROVED_ACTIVE` | prompt/context/tool output | allowlist fields, masking, untrusted data policy | VKN/TCKN/adres/banka/not/secret minimize; data talimat değildir; shell/SQL/storage access yok. |
| `AIENG-022 response_cache_restatement` | `APPROVED_ACTIVE` | response cache key × publication/context/auth versions | plan, result, catalog/tool/policy/prompt/model/locale | Cross-user cache yok; permission/restatement/version change stale; eski cevap overwrite edilmez. |
| `AIENG-023 deterministic_fallback` | `APPROVED_ACTIVE` | model/provider unavailable or validation failure | published direct result, digest, approved static phrases | Yeni hesap/claim uydurmaz; güvenli deterministic cevap veya açık `AI_NARRATIVE_UNAVAILABLE/AI_RESPONSE_BLOCKED`. |
| `AIENG-024 evaluation_release_gate` | `APPROVED_ACTIVE` | version set × anonymous evaluation suite | semantic/tool/result/claim/security/mutation/RLS fixtures | Kritik hata 0, numeric fidelity/provenance %100; deterministic CI kapısı, live eval yalnız smoke. |

## 14B. Kontrollü geçiş ve legacy retirement matrisi

| ID | Durum | Grain/tür | Girdi | Kesin kural |
|---|---|---|---|---|
| `CUT-001 capability_route_registry` | `APPROVED_ACTIVE` | environment × tenant/cohort × capability | route state/version, dependency graph | Global/client boolean değil server-authoritative capability pointer; upstream hazır olmadan downstream açılmaz. |
| `CUT-002 route_state_machine` | `APPROVED_ACTIVE` | capability route | legacy/shadow/compare/canary/read/write/retire states | Yalnız izinli immutable geçiş; aynı requestte legacy+v2 karışımı ve primary'de sessiz fallback yok. |
| `CUT-003 deterministic_rollout_cohort` | `APPROVED_ACTIVE` | tenant/user/role × rollout policy | stable hash/named membership, auth scope | Cohort requestler arasında sabit; RLS önce; internal→pilot→10/25/50/100 ve observation kapılı. |
| `CUT-004 kill_switch_freeze` | `APPROVED_ACTIVE` | capability × tenant × environment | critical signal, current route/writer | Yeni traffic/write freeze; veri/delete/downgrade yok; recovery yeni readiness+approval ister. |
| `CUT-005 legacy_inventory_classification` | `APPROVED_ACTIVE` | legacy route/file/store/job/tool/secret | static/runtime dependencies, replacement refs | KEEP_UX/REPLACE_SEMANTICS/MIGRATE/ARCHIVE/DISABLE/REMOVE/REFERENCE; owner/gate olmadan silme yok. |
| `CUT-006 migration_source_authority` | `APPROVED_ACTIVE` | source kind × scope × period | immutable raw/snapshot/event, approved contract | IndexedDB/client/export resmî kaynak değildir; kaynaksız veri LEGACY_UNVERIFIED, uydurma yok. |
| `CUT-007 migration_manifest_reconciliation` | `APPROVED_ACTIVE` | migration batch | hashes/counts/exact totals/identity/coverage/target refs | Dry-run→write→validate→publish; idempotent, quarantine dışarıda, eski source/result overwrite/delete yok. |
| `CUT-008 historical_backfill_cutoff` | `APPROVED_ACTIVE` | metric/source × historical period | effective/knowledge revisions, source availability | Future knowledge sızmaz; anlık stok geçmişi icat edilmez; restatement açıkça sürümlü. |
| `CUT-009 semantic_comparison_pair` | `APPROVED_ACTIVE` | legacy-v2 pair | same scope/entity/intent/period/filter/dimension/currency/cutoff | Exact raw/state/coverage refs karşılaştırılır; yuvarlanmış ekran veya farklı anlam sahte delta üretmez. |
| `CUT-010 comparison_difference_class` | `APPROVED_ACTIVE` | comparison difference | decision/matrix/test refs, coverage/grain/unit/kind | EXACT/DISPLAY/EXPECTED/SOURCE_COVERAGE/LEGACY_DEFECT/V2_DEFECT/NON_COMPARABLE/UNEXPLAINED; son ikisinden V2 defect/unexplained go'yu bloklar. |
| `CUT-011 expected_difference_allowlist` | `APPROVED_ACTIVE` | expected semantic change × version | exact metric/scope/equation/direction, reviewer | Wildcard fark kabulü yok; legacy eşitliği v2 doğruluk/reconciliation kanıtı değildir. |
| `CUT-012 readiness_manifest` | `APPROVED_ACTIVE` | capability × cohort × version set | package/deploy/migration/DQ/reconcile/security/SLO/cache/runbook refs | Immutable readiness hash; zorunlu check eksik veya input değişmişse go/approval yok. |
| `CUT-013 cutover_four_eyes_approval` | `APPROVED_ACTIVE` | route change preview | readiness hash, from/to, cohort, expiry, actor roles | Technical+domain; financial write/AI mutation ayrıca security; aynı aktör bypass edemez. |
| `CUT-014 canary_observation_gate` | `APPROVED_ACTIVE` | cohort × route/version × window | traffic, error/latency, mismatch, DQ/reconcile, security, support | Min 48 saat+iş döngüsü; yetersiz trafik INSUFFICIENT_SAMPLE; write öncesi 5 iş günü read stability. |
| `CUT-015 automatic_freeze_trigger` | `APPROVED_ACTIVE` | observation signal | leak, duplicate/missing event, reconcile/mismatch, unauthorized write, AI safety, SLO | Kritik olay derhal freeze; varsayılan %2/15dk error veya p95 SLO+2× baseline dalgayı durdurur. |
| `CUT-016 atomic_read_cutover` | `APPROVED_ACTIVE` | capability/cohort route change | pointer/version/cache namespace/min build/outbox | Tek transaction/CAS; eski client update-required; page/modal/API/export/AI aynı v2 manifestte. |
| `CUT-017 cross_surface_cutover_identity` | `APPROVED_ACTIVE` | session/response/artifact | route/run/publication/result/claim ids | Eski cache/cursor/claim/artifact yeni diye reuse edilmez; tarihsel artifact açık versionlı. |
| `CUT-018 single_writer_cutover` | `APPROVED_ACTIVE` | write capability × watermark | drain/freeze, legacy last write, v2 start, outbox/reconcile | Aynı anda tek resmî writer; client dual-write ve primary'de per-request legacy write fallback yok. |
| `CUT-019 write_cutover_smoke` | `APPROVED_ACTIVE` | first v2 mutation | preview/commit/read/result/outbox refs | Uçtan uca exact mutabakat geçmezse writes freeze; ikinci event veya eksik projection yok. |
| `CUT-020 rollback_without_data_loss` | `APPROVED_ACTIVE` | rollback preview/run | watermarks, post-cutover writes, divergence, cache/jobs, replay plan | V2 event/result silinmez; write geri dönüşü exact resync olmadan legacy writer açmaz; gerekirse read-only forward-fix. |
| `CUT-021 incident_recovery_gate` | `APPROVED_ACTIVE` | incident × affected capability | root cause, ids, correction/restatement, user notice, regression ref | Resolve/reopen yeni readiness ve approval ister; stale sonucu güncel göstermez. |
| `CUT-022 legacy_disable_gate` | `APPROVED_ACTIVE` | legacy capability | 30-day primary stability, full-month financial close, zero consumers/fallback | Read-only normal report/AI/write üretmez; deep link/job/tool/cache consumer kalırsa disable yok. |
| `CUT-023 legacy_retirement_retention` | `APPROVED_ACTIVE` | legacy item × retirement run | legal hold, backup restore, audit export, secret/dependency/storage lifecycle | Raw/audit/revision/event/result UI ile silinmez; fiziksel drop ayrı destructive migration/onaydır. |
| `CUT-024 production_execute_boundary` | `APPROVED_ACTIVE` | accepted package × production route request | step-up auth, preview, four-eyes, expected state, idempotency | Paket kod kabulü production cutover izni değildir; her capability auditli ayrı execute ister. |

## 15. AI sorgulama ve açıklama matrisi

AI sayı üretmeden önce metrik kaydını bu matristen çözer. Tanımsız veya bloke metrikte sayı uydurmaz.

AI hiçbir raporu yalnızca düz tablo, metrik listesi veya sayı tekrarı olarak sunamaz. Her rapor ve rapordaki her anlamlı alan için metrik tanımına bağlı bir `interpretation_policy` bulunur. AI, kullanıcının özellikle “yalnız ham veri” istemediği bütün durumlarda aşağıdaki analitik katmanları uygular:

1. **Sonuç:** Doğrulanmış sayı ve kapsam.
2. **Yorum:** Bu sonucun iş açısından ne ifade ettiği.
3. **Karşılaştırma:** Uygun olduğunda geçmiş dönem, geçen yıl, hedef, cari tempo veya benzer grup farkı.
4. **Katkı analizi:** Değişimi taşıyan ürün, aile, kanal, müşteri, temsilci, SSM, gün veya belge.
5. **Anomali ve risk:** Olağan dışı yoğunlaşma, iade, veri eksikliği, hedef/stok/finansal risk.
6. **Gelecek etkisi:** Mevcut eğilim sürerse tahmin, stok, hedef veya finansal sonuç üzerindeki olası etki.
7. **AI görüşü ve aksiyon:** Veriye dayalı önceliklendirilmiş öneri; beklenen fayda ve varsa yan etki.
8. **Güven ve alternatif açıklama:** Çıkarımın güven seviyesi, varsayımlar ve makul diğer açıklamalar.

### AI görüş üretme sınırları

- AI'ın “kendi görüşü”, metrik sonuçları ve tanımlı iş bağlamından üretilen analitik değerlendirmedir; doğrulanmamış sayı veya olay uydurma yetkisi değildir.
- `FACT`, `INFERENCE`, `FORECAST`, `SCENARIO` ve `RECOMMENDATION` ifadeleri cevap verisinde ayrı türlerle işaretlenir. Kullanıcı arayüzü bunları isterse farklı biçimde gösterebilir.
- Kanıtlanan hesap “gerçek”; veriye dayalı fakat kesin olmayan açıklama “çıkarım/olası etken”; geleceğe yönelik değer “tahmin”; önerilen davranış “AI görüşü/aksiyon” olarak sunulur.
- AI tek bir metrikte kör yorum yapmaz. Örneğin yüksek litreyi olumlu saymadan önce iade, müşteri/fatura yoğunlaşması, hedef, geçmiş tempo ve stok etkisine bakar.
- Önemsiz bütün alanları uzun uzun anlatmak yerine etki büyüklüğü, sapma, risk ve karar önemine göre bulguları sıralar. Yine de kullanıcı bir alanı sorduğunda o alan için yorum üretme yeteneği bulunur.
- Veri sonucu güçlü bir yorum desteklemiyorsa AI bunu açıkça söyler; zorunlu yorum şartını yapay bir neden uydurarak karşılamaz.
- Öneriler uygulanmış işlem sayılmaz. AI, önerinin gerekçesini, etkileyeceği metriği ve izlenmesi gereken sonucu belirtir.

Her rapor sonucu AI katmanına en az şu ek alanları sağlayacaktır:

`comparison_candidates, material_change_flags, contribution_dimensions, anomaly_flags, risk_flags, forecast_links, interpretation_policy_id, recommendation_policy_id, confidence_inputs`.

| Soru tipi | Zorunlu çözüm |
|---|---|
| “Ne kadar satıldı?” | Varsayılan `ACT-004 net_sales_litres`; dönem yoksa cari ay varsayımı ve açık tarih aralığı. Finansal ciro değildir. |
| “Ciro ne kadar?” | Yalnız `FIN-002`; metrik bloke ise kuralın tamamlanmadığını bildirir. Sellout TL'ye düşmez. |
| “FKNS kaç?” | Genel/kanal/ürün metriğini ayırır; pay, payda, oran, uygunluk ve dışlama nedenlerini verir. |
| “Stok kaç?” | Son aktif Malzemeler yükleme zamanı; varyant miktarları ve litreleri ayrı, aile toplamı ve ana kod eşdeğeri ayrıca. Ticari Stok açıkça istenmedikçe bayi depo stoğuna karıştırılmaz. |
| “Ticari stok nerede/ne kadar?” | `CST-*` üzerinden müşteride kalan litreyi müşteri, ürün, Master temsilci/SSM, kanal ve segmentte toplar; miktarı yalnız aynı ürün/varyant düzeyinde kullanır. Sevk Edilmiş/Toplam alanlarını ve finansal değerleri kullanmaz. |
| “Kaç günlük stok?” | `STK-009`; başlangıç litre, kanal talep katkısı, hedef eki, model sürümü, kesim ve ufuk açıklanır. |
| “Ne sipariş etmeliyim?” | Brüt talep, SS durumu, stok, net litre, ikmal varyantı ve yuvarlama adımları. Pending/blocked bileşenler saklanmaz. |
| “Neden arttı/azaldı?” | Ürün/aile, kanal, müşteri, belge, temsilci ve takvim katkılarını ayrıştırır; kanıt yoksa nedensellik değil ilişkili etken dili kullanır. |
| Geçmiş-bugün-gelecek | `actual`, `target`, `forecast`, `scenario` değer türlerini ve sürümlerini birbirine karıştırmadan yan yana verir. |

### Rapor türüne göre asgari yorum kapsamı

| Rapor/alan | AI'ın zorunlu değerlendirmesi |
|---|---|
| Sellout/temsilci performansı | Net litre, hedef farkı, tempo, ana ürün/kanal katkıları, iade etkisi, müşteri/fatura yayılımı ve dönem sonu görünümü. |
| FKNS | Yalnız oran değil pay/payda hareketi, alan/almayan müşteri kümeleri, kanal/ürün uygunluğu, oran değişiminin paydan mı paydadan mı geldiği ve aksiyon alınabilecek nokta grubu. |
| Ürün raporu | Aile ve paket varyantı katkısı, paket değişimi, müşteri/segment yayılımı, ani satışın yoğunlaşması, iade ve stok etkisi. |
| Stok raporu | Son aktif Malzemeler yükleme güncelliği, varyant/aile toplamı, talep katkıları, stok günü, tükenme/SS/kritik eşik, sipariş ihtiyacı ve belirsizlik. |
| Ticari Stok raporu | Son aktif Ticari Stok yüklemesi; müşteri/ürün/temsilci/SSM kalan litreleri, stoklu nokta ve kalem sayıları, yoğunlaşma, pasif/iptal nokta ve veri kalite istisnaları. Sevk Edilmiş/Toplam kaynak alanları hariç. |
| Hedef raporu | Gerçekleşme yüzdesinden önce mutlak litre farkı, ay içi beklenen tempo, ürün/kanal katkısı ve hedefe ulaşma olasılığı. |
| Finansal rapor | Kuralı onaylandıktan sonra bakiye, vade, tahsilat, yoğunlaşma, pasif/iptal borç etkisi, eğilim, risk ve önerilen takip önceliği. Sellout TL kullanılmaz. |
| SSM/şirket özeti | Alt yüzdelerin ortalaması yerine gerçek toplulaştırılmış sonuç, bağlı temsilcilerin katkısı, performans dağılımı, aykırı sonuçlar ve öncelikli yönetim alanları. |
| Müşteri/segment analizi | Hacim, ürün karması, alış sıklığı/FKNS, trend, yoğunlaşma, iade ve finansal metrikler mevcutsa bunların birlikte yorumu. |
| Tahmin/senaryo | Tahmin değeri, aralık/güven, temel varsayımlar, gerçekleşenden ayrımı, yukarı/aşağı riskler ve izlenecek erken sinyaller. |

## 16. Uygulama tablolarına dönüşüm

Bu matris en az aşağıdaki teknik yapılara çevrilmelidir:

- `metric_definitions`: kimlik, ad, iş anlamı, birim ve sahiplik.
- `metric_versions`: formül/hesaplayıcı, filtre, tarih alanı, null/negatif/yuvarlama politikası, geçerlilik ve onay.
- `metric_dependencies`: yönlü bağımlılık grafiği ve zorunlu/opsiyonel bağ.
- `metric_parameters`: genel, kanal, ürün ailesi veya organizasyon kapsamlı sürümlü parametre.
- `calculation_runs`: kesim, kaynak snapshot'ları, senaryo, kod/model sürümü ve çalışma durumu.
- `metric_results`: kesin değer, durum, boyutlar, kullanılan sürüm ve açıklama girdileri.
- `metric_exclusions`: dışlanan satır/müşteri ve neden kodu.
- `data_quality_issues`: kaynak/bağımlılık/uygunluk sorunları ve metrik etkisi.
- `manual_resolutions`: kullanıcı kararı, önceki/yeni değer, gerekçe, kanıt, geçerlilik ve geri alma/sürüm zinciri.
- `user_review_tasks`: belirsizlik adayları, önem/kritiklik, etkilenen metrikler, çözüm durumu ve sorumlu kullanıcı.
- `transaction_versions`: manuel ekleme/düzenleme/çıkarma/silme/geri alma sürümleri ve denetim izi.
- `manual_source_conflicts`: üçlü alan farkı, finansal etki, bekleyen kullanıcı kararı ve çözüm sürümü.
- `forecast_models`, `forecast_runs`, `forecast_daily_results`, `forecast_backtests`.
- `ai_metric_query_log`: soru, çözülen metrikler, filtreler, snapshot, sürümler ve cevap izi.
- `ai_interpretation_policies`: rapor/metrik bazında zorunlu karşılaştırma, katkı, risk ve öneri kuralları.
- `ai_analysis_results`: `FACT/INFERENCE/FORECAST/SCENARIO/RECOMMENDATION` türü, dayanak metrik sonuçları, güven ve önem sırası.

## 17. Kabul testleri

Her `APPROVED_ACTIVE` metrik için en az şu testler zorunludur:

1. Aynı kaynak snapshot'ı ve metrik sürümü aynı sonucu verir.
2. Eksik bağımlılık sıfıra dönüşmez.
3. Geçersiz müşteri/ürün/tarih kapsamı dışlama nedeni üretir.
4. Negatif hareket, iade ve iptal kendi politikasına göre davranır.
5. Çoklu ürün OR ve organizasyon toplaması benzersiz müşteri kümeleriyle çalışır; yüzde ortalaması yapmaz.
6. 6'lı/12'li varyantlar stok ekranında ayrı, stok gününde aile litre toplamında tek görünür.
7. Hesap katmanındaki kesin litre/koli eşdeğeri gösterim yuvarlamasından etkilenmez.
8. Geleneksel ve KA ayrı modellenir; yalnız ürün ailesi talebi/stok ihtiyacında birleşir.
9. Sellout TL hiçbir finansal metrik kaynağında yer almaz.
10. AI sonucu aynı `metric_results` kaydından gelir ve payda/filtre/sürüm/kesim açıklamasını yeniden üretebilir.
11. Her rapor için AI düz sayı tekrarının ötesinde en az bir iş anlamı değerlendirmesi üretir; yorum desteklenmiyorsa bunu veri kısıtı olarak açıklar.
12. AI görüşündeki her çıkarım ve öneri, dayandığı `metric_result_id` kayıtlarına izlenebilir.

Paket 08A bağımsız kabul kümesi ayrıca şunları doğrular:

13. Paket 01A olmadan geçici snapshot, Paket 08 olmadan geçerli resmî arşiv hazır sayılmaz; 08A sonucu `BLOCKED_DEPENDENCY`dir, boş/0 değildir.
14. Eşleşme kademeleri aynı girdide deterministiktir; exact belge no alan çatışması bileşik fallback veya fuzzy adayla kapatılmaz.
15. `106/106` gerçek fixture eşleşir; dağılım `99/5/2/0` cash/transfer/check/note, müşteri+tutar+tarih sapması ve ambiguity `0`dır.
16. Exact `%80` `RECONCILED_WITH_EXCEPTIONS`, `%79,99` `LOW_MATCH_REVIEW`; eşik tekil eşleşme kalitesini değiştirmez.
17. Invalid/duplicate/excluded/unsupported satırlar payda ve paya girmez, ayrı DQ kontrol denkleminde kaybolmaz.
18. Resmî devralma ve sonradan invalidation/reversion aynı ekonomik olayı hiçbir görünüm veya toplamda iki kez üretmez; eski run değişmez.
19. Tam snapshot kaybolması, kısmi snapshot, reappearance ve `REMOVED_BEFORE_TRANSFER` sentetik fixture'ları birbirinden ayrılır; hiçbirisi finansal hareket üretmez.
20. Manuel tekil/toplu karar preview→commit, RLS, stale version, source-change conflict, idempotency ve geri alma kurallarını sağlar.
21. Publish transaction rollback'i eski link/batch/kanonik görünüm/outbox bütünlüğünü korur; concurrent publish tek kazanan üretir.
22. ST, Sevkiyat/Fatura Kontrol ve AI tüketicileri yalnız kanonik revision/outbox kullanır; raw `UNION ALL`, siparişe keyfî dağıtım ve TEMP→finansal fallback yoktur.
23. API, UI, XLSX, PDF ve görsel aynı run/filtrede pay/payda, DQ, batch state, exception ve canonical total değerlerini birebir verir.

Paket 09 bağımsız kabul kümesi ayrıca şunları doğrular:

24. Exact tip router IADE/HIZMET/SATIN ALMA dışında hiçbir değeri finansal olaya dönüştürmez.
25. `1.325 = 886 IADE + 345 HIZMET + 94 SATIN ALMA`; 1.231 müşteri olayı ve 94 sıfır-etkili tedarikçi satırı kaynak denkleminde kaybolmaz.
26. IADE ve HIZMET ayrı alt sınıf, birlikte nakit dışı ekonomik tahsilattır; SATIN ALMA cari/tahsilat/FIFO/3-6-12 metriklerine girmez.
27. Exact 500 müşteri, Fatura Tarihi, pozitif exact tutar/currency ve source identity kapıları sağlanmadan cari azaltma oluşmaz.
28. Aynı dosya/örtüşen dosya/source key ikinci event üretmez; değişen içerik toplama/upsert değil revision conflict'tir.
29. Güvenli CREATED↔CANCELLED çifti iki olayı ve allocation etkisini kaldırır; eksik/çoklu EDOCUMENTNO adayı otomatik eşleşmez.
30. Geçerli IADE/HIZMET Paket 10 FIFO allocation'ına etkin Fatura Tarihiyle girer ve `NONCASH_RETURN_SERVICE` sınıfını korur.
31. IADE/HIZMET ile tam kapanan faturanın kapama günü ve kısmi allocation'ın tahsilat gerçekleşme günü 3/6/12 sonuçlarına girer; nakit-only sonuçtan ayrıdır.
32. Aylık ekonomik tahsilat ve tahsilat/fatura oranı IADE/HIZMET'i bir kez içerir; ciro, cash-like, Sellout, stok ve araç sonucu değişmez.
33. Batch kontrol denklemi, transaction rollback, concurrency, RLS, API/UI/export ve semantic descriptor aynı run/tutar/sınıf sonucunu verir.

Paket 10 bağımsız kabul kümesi ayrıca şunları doğrular:

34. Yalnız yayımlanmış tipli finansal event deftere girer; TEMP/Sellout/sipariş/SATIN ALMA/settlement ikinci etkisi ve conflict kayıtları dışarıdadır.
35. Aynı revision idempotent, aynı manifest deterministik; farklı currency sessiz birleşmez.
36. Satış/devir/virman lot anaparası bir kez oluşur ve FIFO aynı tarih eşitliklerinde kanonik sırayı korur.
37. Kısmi/tam/çoklu allocation, bir olayın çoklu lotu ve bir lotun çoklu olayı doğru parçalara ayırır.
38. Artan tahsilat dağıtılmamış alacak olur; sonraki faturaya geçmişe bilgi sızdırmadan `max(invoice,credit date)` ile uygulanır.
39. Defter, lot, allocation, azaltan olay, unallocated credit, aging ve virman kontrol denklikleri açıklanamayan fark `0` verir.
40. Çek/Senet kabulü allocation, settlement ikinci allocation değildir; IADE/HIZMET ekonomik hızda var, cash-only hızda yoktur.
41. İptal/revision/virman en erken tarihten immutable replay yapar; eski run korunur, stale publish ve cursor `409`dur.
42. Açık/kısmi/kapalı durum, close date/day ve allocation realization day aynı gün/null/negatif sınırlarında doğru davranır.
43. Aging sekiz standart dilimde bütün sınırları doğru sınıflar; bucket toplamı açık lota eşit, gelecek tarih DQ'dur.
44. 3/6/12 yalnız tamamlanmış takvim aylarıdır; fatura/tahsilat toplamı, toplamların oranı, ekonomik/cash-only günler, devir ve IADE/HIZMET katkısı doğru ayrılır.
45. Eksik ay sıfır olmaz; API/RLS/UI/export/AI aynı run, coverage, pay/payda, allocation ve aging sonucunu birebir verir.

Paket 10A bağımsız kabul kümesi ayrıca şunları doğrular:

46. Yalnız teslim kanıtlı/idempotent handoff normal adaydır; eksik fatura veya teslim tarafı ayrı istisna ve coverage durumu üretir.
47. Dual-key aynı tek fatura+exact müşteri/tutar/geçerlilik ister; çelişkide fallback ve otomatik finansal hüküm yoktur.
48. Single-key yalnız diğer key gerçekten boşken kontrollü çalışır; fuzzy müşteri/tutar/tarih otomatik link değildir.
49. Gerçek `126/87/73/4/25` ve `23/1/1` fixture profili sentetik istisnalardan ayrı kanıtlanır.
50. Prior stack aday lotu dışlar; current stack ve aday open/partial/closed sonucu aynı Paket 10 run'ına pinlidir.
51. D−1/D aged kanıt toplam tahsilat değil allocation'dır; IADE/HIZMET ve araç kabulü ekonomik allocation olsa da nakit peşin değildir.
52. D−1 resmî olay yalnız adaya gerçek ön kredi allocation'ı kadar peşin coverage üretir; eski lota giden ve dağıtılmamış kalan ayrıdır.
53. D−1 kontrol denklemi ayrık sınıflarda mutabıktır; aynı tutar iki kez sayılmaz ve açıklanamayan fark publish'i bloklar.
54. TEMP→official takeover, disappearance ve official invalidation aynı ekonomik bağlamı çift saymadan yeni immutable run üretir.
55. Araç riski, 29+ eski borç, allocation yokluğu ve yeni faturanın açıklığı yalnız tam coverage ile tanımlı severity üretir; eksik veri `BLOCKED_DATA`dır.
56. Acknowledge alarmı kapatmaz; link/workflow/financial-action preview→commit sürüm, idempotency, capability ve replay sınırını korur.
57. Liste/card/API/export/AI aynı control run, evidence, overall state, alt alarmlar, stack, split, peşin, araç ve coverage sonucunu verir.
58. Hiçbir Fatura Kontrol state'i veya kullanıcı flag'i sevkiyat, cari, allocation, kapama veya araç lifecycle'ını otomatik değiştirmez.

Paket 04B bağımsız kabul kümesi ayrıca şunları doğrular:

59. Aylık seri yalnız Faturalama Tarihi `YYYY-MM` ile kurulur; yıllar birleşmez, eksik ay sıfır olmaz.
60. Açık/Kapalı/Unclassified/Genel exact litre denklemi her ay ve dönem sağlanır; Master dışı kanal kullanılmaz.
61. Explicit ve standart kıyas türleri doğru/eş ayları seçer; Sellout'a finansal rolling 3/6/12 semantiği sızmaz.
62. Coverage/scope/metric version farkı kıyası bloke eder; base-zero yüzde uydurulmaz.
63. KPI, grouped bar, total trend, detay tablo ve toplam aynı monthly result ids ile birebir mutabıktır.
64. Mutlak/yüzde delta, kanal pay-puan değişimi ve top-N+DİĞER katkıları ham litrelerden doğru hesaplanır.
65. AI toplam→kanal→ay→katkı→iade/coverage anlatısını kanıtla kurar ve dış nedeni kanıtsız kesinleştirmez.
66. Örnek PDF düzeni iki sayfalık minimum yapıyı; kıyaslı rapor ek delta/katkı/coverage bölümlerini üretir.
67. Uzun dönem ay atlamaz; PDF/table pagination ve chart facet okunabilirliği korur.
68. PDF/XLSX/PNG/SVG/chat aynı manifest/claim setini kullanır; ikinci hesap veya AI analizi yapmaz.
69. RLS/cache/artifact hash authorization, source, metric, template ve renderer sürümlerini korur; eski artifact sessiz değişmez.
70. Render/open kalite kapıları ve API/UI/artifact/AI sayı birebirliği geçmeden rapor yayımlanmaz.

Paket 11 bağımsız kabul kümesi ayrıca şunları doğrular:

71. Exact manual type doğru Paket 07/08/09/10 adapter'ına gider; unknown/SATIN_ALMA müşteri finansal olayına dönüşmez.
72. Pozitif exact amount ve explicit type yönü belirler; negatif işaretten sınıf/yön türetilmez.
73. Validate→preview→confirmation→commit zorunludur; preview manifest bütün finansal/operasyonel etkileri ve undo'yu gösterir.
74. Immutable add/edit/exclude/soft-delete/restore revision'ları raw source ve eski run'ı overwrite etmez.
75. Allocation override customer/currency/time/amount/open-lot sınırlarını korur ve FIFO-vs-override replay etkisini kanıtlar.
76. Manual link ham key'leri değiştirmez; source revision değişiminde yeniden onay ister.
77. O/M/N üçlü diff alan durumlarını tipli exact üretir; N=O override'ı korur, N≠O pending conflict açar.
78. Pending new source ikinci ekonomik etki üretmez; last approved effective value ve PENDING_SOURCE_UPDATE açıklaması kullanılır.
79. Conflict kararları/field merge yeni revision ve domain validation üretir; inconsistent merge commit edilemez.
80. AUTO_ACCEPT_SOURCE/LOCK_MANUAL policy dar, sürümlü ve geri alınabilir; kritik invariant/security kapılarını aşamaz.
81. Bulk karar homogeneous scope/type/reason/field/policy ve explicit partial/all-or-nothing davranışını korur.
82. Commit revision/evidence/impact/replay/projection/outbox atomiktir; idempotency/concurrency/stale/auth-loss/rollback güvenlidir.
83. Dependency impact yalnız affected Paket 07–10A/12/14 zincirlerini earliest date ile idempotent tetikler; virman iki müşteriyi birlikte replay eder.
84. API/UI/RLS/evidence/audit aynı active revision, conflict, preview ve commit sonucunu fail-closed sunar.
85. AI exact unexpired preview confirmation olmadan commit yapmaz; manual/source/pending provenance ve KPI etkisini doğru açıklar.

Paket 12A bağımsız kabul kümesi ayrıca şunları doğrular:

86. Paket 10 tek ledger/FIFO sahibidir; 12A upstream ids ve exact değerleri yeniden sınıflandırmadan materialize eder.
87. Günlük cari, açık lot, dağıtılmamış alacak, Çek, Senet ve toplam risk denklemleri müşteri/org/şirket düzeyinde exact sağlanır.
88. Temporal lot/araç sorumluluğu ve virman yaş/net-sıfır sınırı geçmişe bilgi sızdırmadan korunur.
89. DSO günlük EOD pozitif açık alacak ve ticari satış paydasından aylık/3-6-12 yeniden hesaplanır; ortalama açık yaş veya aylık DSO ortalaması değildir.
90. CEI lot bazlı düzeltilmiş 29+ havuz ve eligible allocation ile hesaplanır; performans dışı çıkış/virman/düzeltme başarı sayılmaz.
91. IADE/HIZMET ekonomik hız/tahsilatta dahil, cash-only'de hariç; SATIN ALMA bütün finansal sonuçlarda sıfır katkılıdır.
92. Completed-month pencereleri gerçek takvim ayıdır; MTD/eksik ay ayrı partial/blocked coverage taşır.
93. Sınıflı event deltaları Çek/Senet kabul-settlement, noncash azaltım, devir, virman ve cancellation etkilerini ayrı tutup opening→closing köprüsünü kapatır.
94. Coverage sekiz boyutu ayrı status/evidence ile taşır; eksik değer 0 veya keyfî ortalama güven değildir.
95. Parasal/lot/allocation/instrument/virman/rollup ihlali `NOT_READY` ve publish blokajı; warning exact denklikleri bozamaz.
96. Aynı manifest/rule/code deterministik hash; stale publish, concurrency, idempotency ve rollback active run'ı güvenle korur.
97. Restatement yalnız earliest-date affected customer/two-sided transfer/org/period/metric zincirini yeniden çalıştırır; eski run değişmez.
98. Metric evidence envelope API/SQL/UI/AI'da run, pay/payda, kapsam, mode, coverage, exclusions ve drill-down birebirliğini sağlar.
99. RLS bütün position/lot/instrument/delta/contribution/reconciliation/coverage yüzeylerinde fail-closed'dur.
100. DSO–açık yaş, CEI–tahsilat/fatura ve ekonomik–cash-only semantik ayrımları AI/descriptor negatif testlerinden geçer.

Paket 12B bağımsız kabul kümesi ayrıca şunları doğrular:

101. Policy snapshot weights/bands/penalties/quantiles/rounding/gates/governor'ı run boyunca sabitler ve eski sonucu değiştirmez.
102. Null component 0 sayılmaz; `%60` original active weight ve en az iki component kapısı exact yeniden ağırlıklandırılır.
103. Health component formülleri aging/CEI/exposure/close/instrument raw pay/payda ve boundary fixture'larıyla doğru; DSO/status score'a eklenmez.
104. Independent risk flags score/band/confidence'dan ayrı evidence taşır ve otomatik aksiyon üretmez.
105. Master credit limit hiçbir input/fallback değildir; health→behavior→limit tek yönlüdür ve dependency cycle publish'i bloklar.
106. Need/capacity rolling 28-day P75/P25 quantile'ları tam coverage, doğru sınıf ve method/sample provenance ile hesaplanır.
107. Raw/rounded/governed/effective limit ile exposure/usage/headroom ayrıdır; mevcut exposure recommendation girdisi değildir.
108. `%25` governor, first/null limit, critical review ve 1.000 TRY HALF_UP sınırları exact çalışır; auto-apply yoktur.
109. Override preview/confirmation/version/validity/idempotency/stale/expiry kuralları active recommendation'ı ve audit'i korur.
110. Rep score CEI/pre29/due instrument/limit discipline ham bileşenlerini completed month'ta üretir; MTD/null ve satış/prim ayrıdır.
111. Temporal owner, reassignment, virman, unknown rep/SSM ve pasif/iptal 100 TRY period cohort kuralları sağlanır.
112. SSM sonucu temsilci skor ortalaması değil ham pay/payda/günlük alanların yeniden hesabıdır.
113. API/SQL/UI/AI component, contribution, limit method, flag, coverage, responsibility ve run sonuçlarında birebirdir; RLS fail-closed'dur.
114. Policy/upstream/hierarchy/instrument/override restatement yalnız affected scope/period'u immutable run ile değiştirir; stale/concurrency/rollback güvenlidir.
115. Score/limit/performance publication müşteri, sevkiyat, finansal event, effective override veya prim mutasyonu üretmez.

AI Odak Analiz çapraz kabul kümesi ayrıca şunları doğrular:

116. Focus context yoksa serbest AI alanı yok; compact digest modelsiz ve deterministiktir, mevcut koyu cam/akıcı yorum kabuğunda sunulur.
117. Liste açılışı satır başına model çağrısı yapmaz; full claim yalnız açık trigger ile üretilir.
118. Aynı context/run/policy/auth hash cache reuse; filtre/run/yetki değişimi stale üretir.
119. Claim'ler type/materiality/confidence/supporting ids/caveat taşır; kanıtsız sayı/neden/aksiyon reddedilir.
120. Status/domain severity model tarafından yeniden hesaplanmaz; blocked/clear semantik sınırı korunur.
121. Kart en çok üç finding/iki next check ve coverage; detay drill-down'da kalır.
122. Card/detail/chat/PDF/XLSX aynı analysis/claim/result ids ve sayıları kullanır.
123. RLS/cache yetkisiz müşteri/evidence/claim'i hiçbir yüzeyde sızdırmaz.
124. Sevkiyat focus bugünkü order state→cari/risk→payment/allocation→FIFO/aging→instrument→coverage sırasını korur.
125. Sipariş−ödeme farkı kalan/ödendi değildir; TEMP resmî tahsilat/peşin/kapama değildir.
126. Çek/Senet kabulü cash değildir; settlement ikinci cari tahsilat değildir.
127. Geçmiş/teslim edilmiş belge Paket 10A'ya yönlenir; bugünkü queue tarihsel rapora dönüşmez.
128. AI Focus doğrudan mutation yapmaz; aksiyon capability kontrollü workflow/preview'dır.
129. Empty/loading/error/stale/blocked/unauthorized ve erişilebilirlik durumları eski claim'i güncel göstermez; typewriter/dönüşüm reduced-motion, klavye, dokunmatik ve pause-on-focus kurallarına uyar.
130. Feature flag kapalı legacy ekran ve model çağrı sayısını değiştirmez.

Paket 12C bağımsız kabul kümesi ayrıca şunları doğrular:

131. Cohort cutoff gelecekteki event/dimension'ı dışlar; origin class ve ölçü grain'leri ayrıdır.
132. Concentration Top-N+OTHER ve HHI tek positive measure ile exact mutabıktır; negatif mahsup/sıfır hüküm yoktur.
133. Migration principal slices opening+in=closing+economic-close+out+non-performance denkliğini sağlar.
134. Virman/reassignment kapama değildir; şirket net 0, org hareketi görünürdür.
135. Vintage yalnız gözlemlenebilir 7/14/21/28/45/60/90 principal'ı paydaya alır; partial close amount bazlıdır.
136. Survival weighted KM, right censoring, competing exit, median ve risk set denklikleri exact fixture'da sağlanır.
137. Survival 30/10 yeterlilik ve customer→rep→channel→company fallback/null sınırını provenance ile uygular.
138. Aged burden flow FIN-014 lot refs ile exact köprü kurar; IADE/HIZMET/devir/transfer sınıfları korunur.
139. Behavior segment priority, 3-month thresholds, materiality ve KARMA_IZLEMELI fallback'i tek ana class üretir.
140. Segment Master/status/limit/sevkiyat değişikliği yapmaz ve evidence tags'i korur.
141. Peer benchmark aynı metric/version/unit/period/coverage ve min-10 hierarchy fallback'ıyla güvenli cohort kurar.
142. Peer quantiles/direction metadata deterministiktir; fark neden veya karar değildir; RLS minimum-group fail-closed'dur.
143. API/SQL/UI/AI amount/count, pay/payda, censoring/fallback, coverage, run ve drill-down'da birebirdir.
144. Restatement/idempotency/concurrency/rollback yalnız affected cohort/scope/period active result'ını immutable run ile değiştirir.
145. 12C AI Odak digest/claim en maddi üç kanıtı aynı result ids ile verir; survival/HHI/segment/peer anlamını çarpıtmaz.

Paket 12D bağımsız kabul kümesi ayrıca şunları doğrular:

146. As-of sonrası 13×7 günlük kovalar exact tarih sınırlarıyla kurulur; cutoff sonrası revision/hierarchy olayı sızmaz.
147. Economic collection, direct cash risk relief, noncash close, FORECAST ve SCENARIO ayrı kalır; IADE/HIZMET/araç kabulü nakit olmaz.
148. Existing-book açık invoice principal'ı competing-risk cause'larında bir kez yer alır; yalnız cash/transfer cause'u invoice cash forecast'a girer.
149. Açık Çek/Senet yalnız gerçek settlement dağılımında bulunur; kabul ve settlement iki kez nakit sayılmaz.
150. Existing ve extended kapsam ayrıdır; gelecek ticari invoice modeli yetersizse extended null, existing yayımlanabilir.
151. Commercial invoice forecast 26/52 hafta eligibility ve rolling-origin promotion kapısını exact uygular; 12B yalnız APPROVED P75 tüketir.
152. Deterministik 1.000 yol aynı run hash'inde aynı sonucu verir; P25≤P50≤P75 ve 4/13 hafta path-total quantile mutabakatı sağlanır.
153. Backtest her origin'in historical knowledge cutoff'unu kullanır; WAPE/bias zero actual'da null, MAE saklıdır.
154. Model promotion 26 origin, iki ana horizon %5 kazanç, horizon başına %10 non-inferiority ve %40–%80 interval coverage kapılarını birlikte ister.
155. Sinyal recent-3/prior-3, same-elapsed-day, exact threshold ve maddilik kurallarını uygular; küçük taban büyük yüzdesi alarm değildir.
156. Signal OPEN/ACKNOWLEDGED/RESOLVED zinciri immutable'dır; acknowledgement finansal fact/score/state değiştirmez.
157. Robust anomaly MAD/IQR/fallback minimum-history sırasını uygular; anomaly neden veya müşteri hükmü değildir.
158. Priority raw components CUME_DIST ve %30/%25/%20/%15/%10 ile hesaplanır; available weight <%60 null'dır.
159. Critical manual review puansız öne gelir; kalan queue deterministic score/material/customer sırasındadır ve otomatik temas/mutasyon yapmaz.
160. Her scenario immutable base result/ref ve versioned assumption taşır; şok sırası double counting üretmez, gerçek tablo değişmez.
161. Top1/5/10 exposure cutoff'ta sabitlenir; new-sales continue/stop ayrı sonuç, mevcut invoice silinmez.
162. Management loss 50/10 ve 180-day observable recovery kapısını uygular; yetersiz kalibrasyon yalnız açık assumption SCENARIO_ONLY/null üretir.
163. API/SQL/UI/AI weekly component, bands, backtest, signal, priority, scenario, coverage ve result ids birebirdir; currency karışmaz.
164. Restatement/idempotency/concurrency/rollback eski forecast/signal/scenarioyu overwrite etmez ve active publication'ı atomik korur.
165. 12D AI Odak akıcı görünümü korur; forecast'ı kesin ödeme, anomaly'yi neden, priority'yi karar veya scenario loss'u muhasebe karşılığı diye sunmaz.

Paket 08B Senet/bono yazdırma bağımsız kabul kümesi ayrıca şunları doğrular:

166. Tutar source kind/run/revision/result/currency ile pinlenir; kalan borç bağlam, sipariş/manual tutar öneridir ve stale source baskıyı bloklar.
167. Integer-kuruş 1–12 bölümünde parçalar pozitif ve exact toplamdır; `100/3` son parça farkını taşır.
168. Bütün vadeler dolu, issue date sonrası/eşit ve azalmayan sıradadır; issue override yetki/reason/policy ister.
169. Customer snapshot unvan/adres tekrarlarını önler; zorunlu debtor/business alan eksikliği yalnız watermark preview üretir.
170. Approved template TTK m.776 alanlarını açık taşır; ödeme yeri varsayılmaz, hukuk metni request/frontend tarafından değiştirilemez.
171. Rakam/yazı tutarı aynı minor unit'e parse olur; Türkçe sınırlar ve overflow güvenli davranır.
172. Group/note id/no/snapshot/hash immutable'dır; generated değişiklik yeni superseding revision üretir.
173. Print lifecycle'ın bütün durumları Paket 08 official note, cari, risk, FIFO, aging ve KPI'da sıfır etkilidir.
174. Original/reprint-copy/void ve print-request/explicit-confirm ayrımları audit actor/reason/sequence ile çalışır.
175. Printed-to-official link exact adaydır ama automatic acceptance değildir; Paket 08 source/lifecycle otoritesi korunur.
176. A5 landscape PDF ölçü, sayfa, embedded Türkçe font, grayscale kontrast ve uzun metin visual QA kapılarını geçer.
177. Preview/PDF aynı snapshot ve content hash'tir; idempotency/concurrency/renderer rollback ikinci/yarım artifact üretmez.
178. RLS/capabilities başka tenant/customer source, PDF, PII ve audit'i sızdırmaz; VKN/TCKN telemetry/AI'da yoktur.
179. Referans modal/bono karakteri klavye, mobil, screen reader ve print fallback ile korunur.
180. AI yalnız eligibility/source/status/preview açıklar; hukuk alanı değiştirmez, otomatik baskı yapmaz ve PRINT_CONFIRMED'ı resmî Senet saymaz.

Paket 12E rapor, grafik, drill-down ve artifact bağımsız kabul kümesi ayrıca şunları doğrular:

181. Approved definition/template sürümü immutable ve formülsüzdür; DRAFT/RETIRED çalışmaz, onay auditlidir.
182. Canonical filter/scope hash semantik eşdeğeri birleştirir; null/empty/ALL, Sellout ayı ve finansal 3/6/12 ayrımını korur.
183. Snapshot state machine, knowledge cutoff, idempotency ve atomic publication ikinci/yarım sonuç üretmez.
184. Manifest exact/display value, ids, versions, unit, state, reason, coverage, evidence, exclusions ve control totals'ı eksiksiz taşır.
185. Restatement eski snapshot/artifact'ı değiştirmez; exact diff ve stale/restated görünümü üretir.
186. Chart yalnız result binding'i render eder; deterministik sort/unit/axis ve zero/null/partial/blocked/forecast/scenario semantiği table fallback'te aynıdır.
187. Waterfall/stack/Pareto/top-N+diğer/detail bütün formatlarda domain control total'a exact mutabıktır.
188. Drill-down allowlist, snapshot pin, RLS, keyset cursor, unique tie-breaker ve visible truncation ile çalışır; serbest SQL/detail sızıntısı yoktur.
189. Export job format alt durumları, idempotency, retry, timeout, partial failure ve atomic publish kurallarını exact uygular.
190. Private artifact üretim/indirmede yeniden yetki, kısa link, güvenli ad, content hash, retention/legal hold ve audit taşır.
191. PDF bütün sayfa render QA'da A4, embed Türkçe font, bölüm/header/footer, taşma/kırpılma ve son boş sayfa kapılarını geçer.
192. XLSX zorunlu sekme/Table/filter/freeze/type/control-total kapılarını geçer; KPI formülle yeniden hesaplanmaz ve injection/macro/external link yoktur.
193. PNG en az 2× ve öz açıklamalı; SVG sanitize, scriptsiz/external-resource'suz ve kırpılmasızdır.
194. HTML/PDF/XLSX/PNG/SVG/chat aynı snapshot/manifest/result/claim ids, exact sayı, state ve coverage'ı kullanır; format başına hesap/model çağrısı yoktur.
195. `AI_FOCUS` mevcut koyu cam/akıcı/typewriter/geniş Analiz modalı karakterini touch/klavye/reduced-motion ile korur; eski formül ve doğrudan mutation taşımaz.
196. Paket 14 yokken deterministic digest ve sayısal artifact çalışır; yeni anlatı açık unavailable olur, serbest fallback uydurulmaz.
197. Temiz migration→seed→approve→snapshot→chart/drill→çoklu artifact→quality/download→restatement→RLS/cache/audit→rollback/reset zinciri 80 paket testini ve upstream regresyonu geçer.

Paket 12F aksiyon günlüğü, sonuç ölçümü ve güvenli atıf bağımsız kabul kümesi ayrıca şunları doğrular:

198. Verified recommendation presented/opened/converted/dismissed/expired hunisi bot/prefetch'i dışlar; conversion finansal başarı değildir.
199. Native case/activity lifecycle ve preview-confirm-version-idempotency, customer×currency'de tek aktif ölçüm vakasını concurrency altında korur.
200. Yalnız finance outcome bilinmeden kaydedilmiş PERFORMED faaliyet eligible anchor'dır; planned/retrospective kayıt başarı üretmez.
201. 7/14/30 Europe/Istanbul horizonları doğru, kümülatif ve maturity-aware'dir; immature zero/failure değildir.
202. Observed outcome yalnız canonical financial event/result ids'den economic/direct cash/noncash/instrument acceptance/settlement ayrımıyla gelir; kullanıcı tutarı kaynak değildir.
203. Exclusive case binding aynı event'i vaka, faaliyet, horizon veya finansal sınıflar arasında yanlış çift saymaz.
204. Opening+classified delta=closing exposure bridge yeni satış, iptal, transfer, manual/restatement ve araç riskini ayrı mutabık tutar.
205. Tipli promise integer minor/due/kind revision'ı ve FIFO event allocation'ı on-time/late/partial/broken/excess sonuçlarını exact üretir.
206. Adoption, completion, contact, promise ve observed relief pay/payda/coverage oranları adet-tutar ayrımı ve zero-denominator güvenliğiyle çalışır.
207. Owner, activity actor ve financial temporal owner ayrıdır; reassignment geçmiş başarıyı yazmaz ve belirsiz org coverage'da kalır.
208. Outcome snapshot immutable'dır; cancellation/reversal/manual/source restatement yeni diff/run ve deterministic replay üretir.
209. Randomize olmayan sonuç yalnız TEMPORAL/DESCRIPTIVE_ASSOCIATIONdır; UI/AI “sayesinde” veya “AI tahsil etti” diyemez.
210. Ön kayıtlı experiment deterministic stratified assignment, ITT, crossover, ≥30 unit/≥10 event/her kol ve ≥%90 coverage kapılarını uygular.
211. Causal lift aynı 30 günlük capped-relief/baseline metric ve 2.000 seeded bootstrap %95 interval ile; zero-cross INCONCLUSIVE, kalite eksiği CAUSAL_BLOCKED verir.
212. Temiz migration→exposure→case/activity/promise→canonical outcomes→7/14/30→restatement→experiment→12E/API/RLS/UI/AI→rollback/reset zinciri 80 paket testini ve no-mutation/upstream regresyonunu geçer.

Paket 13 merkezi metrik motoru bağımsız kabul kümesi ayrıca şunları doğrular:

213. Registry sürüm/state/approval/effective interval immutability ve backdated-restatement kuralını uygular.
214. Tipli grain/dimension/unit/currency/period sözleşmesi serbest veya uyumsuz sonucu fail-closed reddeder.
215. Sellout `YYYY-MM` ile finansal tamamlanmış 3/6/12 ay penceresi aynı tipe dönüşmez; eksik ay zero değildir.
216. Dependency graph self/dolaylı cycle'ı reddeder; aynı graph deterministic closure/topological plan üretir.
217. Minimal plan ortak dependency'yi bir kez çalıştırır ve bütün source/result/version/code girdilerini pinler.
218. Canonical request semantik eşdeğeri birleştirir; null/empty/ALL ve authorization scope'u ayırır.
219. Run idempotency/state/lease/fencing/concurrency eski worker veya çift result/publication üretmez.
220. Calculator exact decimal/integer ve pinli clock/random/input sözleşmesiyle aynı output hash'ini üretir.
221. MetricResultEnvelope exact raw/display, status, pay/payda/components, versions, coverage, reconciliation ve evidence'i eksiksiz taşır.
222. VALUE/ZERO/NULL/MISSING/PARTIAL/BLOCKED/IMMATURE/NON_COMPARABLE/BASE_ZERO bütün tüketicilerde ayrı kalır.
223. Contribution/control-total ve multidimensional coverage kapıları double count veya sahte sıfır üretmez.
224. Reconciliation yalnız sürümlü kaynak hassasiyeti toleransıyla geçer; açıklanamayan fark publish'i bloklar.
225. Publication manifest/results/outbox/CAS pointer atomiktir; partial/stale/failed yayın önceki active'i korur.
226. Aynı input/version hash farkı reproducibility failure üretir ve active publication olamaz.
227. Invalidation impact plan earliest date/entity/two-sided transfer/temporal org/period/consumer closure'ını sınırlar.
228. Replay yalnız etkilenen zinciri immutable ve idempotent yeniler; scope belirsizliği sessiz global replay değildir.
229. Restatement old/new result, exact delta, state/coverage/reconciliation diff'i gösterir; eski publication değişmez.
230. Backfill dry-run canlı pointer'ı değiştirmez; ayrı yetkili publish ve rate/scope guard ister.
231. RLS/capability/cache/telemetry cross-tenant/detail sızıntısını ve PII/secret loglamayı engeller.
232. Temiz registry→DAG→plan→run→quality→publish→invalidate/replay/restatement→API/RLS/cache/audit zinciri Paket 13'ün 80 bağımsız testini ve upstream/downstream sözleşmelerini geçer.

Paket 14 AI semantik ve yorum motoru bağımsız kabul kümesi ayrıca şunları doğrular:

233. Backend-only provider gateway client key/direct-call/hard-coded secret yollarını kapatır ve retry/rotation/circuit-breaker'ı idempotent uygular.
234. Approved Türkçe catalog normalization/forbidden-term/version lifecycle'ı metric ve kimlik anlamını deterministik çözer.
235. SemanticQueryPlan metric/entity/dimension/filter/scope/period/comparison/kind/output/operation ve auth/context sürümlerini tipli pinler.
236. Sellout ayları, finansal tamamlanmış 3/6/12, sevkiyat bugünü, latest stok ve vade adayları birbirine dönüşmez.
237. Yetkili entity resolver benzer adı kesin bağ yapmaz; yetkisiz aday veya başka müşteri verisi sızdırmaz.
238. Birden çok maddi aday ambiguity blokajı üretir; model confidence veya genel fallback sayı/tool çağrısı açmaz.
239. Follow-up context aynı user/conversation/TTL/permission/publication sınırında daralır; cross-chat veya sessiz scope genişlemesi yoktur.
240. Tool registry/firewall yalnız approved server schema+capability sunar; input scope'u daraltır ve output prompt injection'ı yürütmez.
241. Read araçları yalnız Paket 13 published result envelope'ı döndürür; client/Excel/prompt/staging formülü yoktur.
242. Orchestration round/call/concurrency/size bütçesi loop/fan-out'u ve tekrar yan etkisini deterministic reason ile keser.
243. Analysis digest direct/comparison/contribution+OTHER/anomaly/risk/coverage/counterevidence'i exact ve modelden önce üretir.
244. Delivery policy INLINE/INLINE_PLUS_VISUAL/REPORT_PACK seçerken doğrudan cevabı sohbette tutar ve format başına model çağırmaz.
245. Evidence-bound claim bütün entity/unit/period/state/kind/ref alanlarını taşır; refsiz kanıt iddiası yayımlanmaz.
246. Locale-aware numeric validator bütün sayıları exact/display result/component ref'e bağlar; sayı birebirliği `%100`dür.
247. FACT/INFERENCE/FORECAST/SCENARIO/RECOMMENDATION dili, varsayım/horizon/caveat ve uygulanmamış öneri sınırını korur.
248. Causal dil yalnız geçerli randomized CAUSAL_LIFT'te açılır; temporal/descriptive sonuç “sayesinde/AI tahsil etti” olmaz.
249. Quality validator kanıtsız neden/gelecek/müşteri hükmü/hukuk-muhasebe genişletmesi ve düz sayı tekrarını fail-closed reddeder.
250. AI Odak tek claim setiyle en fazla 3 bulgu/2 next check üretir ve mevcut akıcı panel/modal/typewriter erişilebilirliğini korur.
251. Mutation READ/DRAFT/PREVIEW/COMMIT sınırı ve exact UI confirmation hash/expiry/version/capability kapısı serbest sohbet onayını reddeder.
252. Prompt-injection/privacy minimizasyonu secret/PII/raw note/shell/SQL/storage erişimini model ve telemetry dışında tutar.
253. Cache auth/context/publication/catalog/tool/policy/prompt/model/locale ile ayrılır; restatement eski cevabı değiştirmez.
254. Provider veya validator başarısızlığında deterministic published result/digest çalışır; yeni anlatı açık unavailable/blocked olur, uydurma yoktur.
255. Deterministic eval semantic/tool/result/claim/rejection/RLS/mutation fixture'larını tekrar üretir; kritik hata 0 ve provenance %100 release kapısıdır.
256. Temiz gateway→catalog/plan→ambiguity/context→tool firewall→P13 result→digest→claim validator→fallback/cache→mutation confirmation→API/SSE/eval/RLS/audit zinciri 100 Paket 14 testini geçer ve Paket 15'i erken uygulamaz.

Paket 15 kontrollü geçiş ve legacy retirement bağımsız kabul kümesi ayrıca şunları doğrular:

257. Capability route registry server-authoritative dependency DAG ve immutable state machine ile client flag/sessiz fallback'i reddeder.
258. Deterministic cohort/RLS/observation policy internal→pilot→10/25/50/100 dalgalarını güvenli ve tekrar üretilebilir yürütür.
259. Kill switch kritik capability traffic/write'ını kapsamlı dondurur; data/delete/downgrade yapmaz.
260. Legacy inventory KEEP_UX ile REPLACE_SEMANTICS/MIGRATE/ARCHIVE/DISABLE/REMOVE sınıflarını owner/replacement/gate refs ile ayırır.
261. Migration yalnız immutable raw/source/event ve approved contract'tan gelir; client/IndexedDB/export veya kaynaksız sayı resmîleşmez.
262. Migration manifest hash/count/exact total/identity/coverage/quarantine/target refs ile idempotent ve atomik doğrulanır.
263. Historical backfill knowledge cutoff'u korur, anlık stok geçmişi icat etmez ve eski result/source'u overwrite etmez.
264. Semantic comparison aynı scope/entity/intent/period/filter/dimension/currency/cutoff exact refs'i eşleştirir.
265. Difference class expected/source/legacy-defect/v2-defect/non-comparable/unexplained ayrımını yapar; wildcard allowlist yoktur.
266. V2 defect veya unexplained difference readiness'i bloklar; legacy eşitliği v2 domain kapısının yerine geçmez.
267. Readiness manifest package/deploy/migration/DQ/reconciliation/security/SLO/cache/support/runbook bütünlüğünü pinler.
268. Four-eyes approval readiness hash/from-to/cohort/version/expiry'ye bağlıdır; financial write/AI mutation security onayı ister.
269. Canary min observation, iş döngüsü, sample yeterliliği ve write öncesi read stability kapısını geçmeden genişlemez.
270. Leak/duplicate-missing event/reconciliation/mismatch/unauthorized write/AI safety/SLO tetikleri destructive olmayan freeze üretir.
271. Atomic read cutover route/version/cache/min-client/outbox'ı CAS ile değiştirir; bütün yüzeyler aynı v2 manifestini kullanır.
272. Eski cache/cursor/claim/artifact yeni sonuç gibi reuse edilmez; tarihsel artifact version etiketiyle kalır.
273. Single-writer freeze/watermark/pointer akışı client dual-write ve primary legacy write fallback'ini engeller.
274. İlk v2 mutation preview→commit→read→metric/outbox smoke mutabakatı geçmezse writes dondurulur.
275. Rollback v2 event/result/audit'i silmez; exact resync olmadan legacy writer açılmaz ve gerektiğinde forward-fix uygulanır.
276. Incident resolve/reopen root cause/affected ids/restatement/notification/regression ve yeni readiness approval'ı ister.
277. Legacy 30 gün stabil v2 ve finansal tam ay kapanışı olmadan disabled; active consumer/fallback varken retired olamaz.
278. Retention/legal hold/backup restore/audit export/secret revoke/dependency/storage kapısı fiziksel silme ve retirement'ı kontrol eder.
279. Control plane step-up auth/RLS/CSRF/replay/four-eyes ile route/kill/rollback/retire işlemlerini fail-closed korur.
280. Temiz inventory→migration→comparison→readiness→shadow/canary→read/write cutover→rollback/incident→disable/retire zinciri 100 Paket 15 testini veri kaybı olmadan geçer; production execute ayrı onaydır.
