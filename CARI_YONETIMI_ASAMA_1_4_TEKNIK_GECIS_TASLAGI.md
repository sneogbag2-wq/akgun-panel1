# Cari Yönetimi — Aşama 1.4: Teknik Geçiş Taslağı

**Durum:** Taslak; uygulama onayı bekliyor.  
**Amaç:** Onaylı cari olay modelini, mevcut veriyi kaybetmeden uygulamaya alma planı.

## 1. Mevcut teknik durum

- İstemci tarafı IndexedDB veritabanı: `dap_v1_idb`, sürüm 7.
- Mevcut depolar ekran odaklıdır: `customers`, `satis`, `collections`,
  `purchase`, `credit_notes`, `cheques` vb.
- Mevcut iptal filtresi yalnız yüklenen dosya içinde çalışır; küresel ve kalıcı
  belge numarası taraması yoktur.
- `customerService.ts` içinde depolama, hesaplama ve ekran sorguları birlikte
  bulunur.

## 2. Geçiş ilkesi

İlk uygulama eski depoları silmez veya değiştirmez. IndexedDB sürümü artırılır
ve yeni olay depoları eklenir. Kaynak Excel dosyaları yeni kurallarla yeniden
yüklenir; eski ve yeni sonuçlar mutabakat raporunda karşılaştırılır. Kullanıcı
onayı olmadan eski depolar kaldırılmaz veya ekranlar tamamen yeni veriye
çevrilmez.

## 3. Yeni depolama katmanı

| Depo | Anahtar | İçerik |
|---|---|---|
| `customers_v2` | `id` | Kanonik müşteri ana verisi |
| `customer_assignments_v2` | `id` | Temsilci ve saha satış müdürü atamaları |
| `sales_invoices_v2` | `id` | Satış faturaları |
| `customer_credit_events_v2` | `id` | HIZMET / IADE ve manuel satın alma alacak düşüşleri |
| `collections_v2` | `id` | Nakit, kart, havale ve manuel tahsilatlar |
| `payment_instruments_v2` | `id` | Çek/senet, `PAID` eşleştirmesi ve risk |
| `manual_operations_v2` | `id` | Manuel işlem denetim kaydı ve virman bağları |
| `document_index_v2` | `document_number` | Küresel belge tekilliği ve `CANCELLED` taraması |
| `reconciliation_queue_v2` | `id` | Belirsiz havale–çek eşleşmeleri |
| `source_raw_records_v2` | `id` | Normal aktif kaynak satırlarının sınırlı ham arşivi |

`CANCELLED` belge ve ters kayıt karşılığı bu depolara yazılmaz; sonradan
geldiğinde mevcut karşılıklar da tüm depolardan silinir.

## 4. Her yüklemede atomik işlem sırası

Tek bir dosya yüklemesi aşağıdaki işlemleri tek IndexedDB yazma işlemi içinde
yapmalıdır. Hata olursa hiçbir kısmi kayıt kalmamalıdır.

1. Excel okunur, sütunları doğrulanır ve kanonik olaya dönüştürülür.
2. `Cari Kodu 2` / `Cari Kodu2` boş zincir mağaza kayıtları elenir.
3. Otomatik SATIN ALMA kayıtları elenir; sadece HIZMET/IADE alınır.
4. Yeni ve mevcut `document_index_v2` birlikte taranır.
5. `Kayıt Tipi = CANCELLED` olan her belge numarası için ilgili olay, indeks,
   normal ham kayıt ve varsa havale–çek eşleşmesi silinir.
6. Kalan belgeler küresel tekillik denetiminden geçer ve olay depolarına yazılır.
7. Havale `Hesap No` ↔ çek `Çek Hesap No` + müşteri + tutar eşleştirmesi yapılır:
   tek aday `PAID`, çoklu/uyuşmayan aday `reconciliation_queue_v2`.
8. Depo değişikliği tamamlanır, hesaplama önbellekleri geçersiz kılınır ve
   türetilmiş görünümler yeniden hesaplanır.

## 5. Manuel işlem akışı

Manuel kayıtlar Excel parserını atlayarak aynı olay depolarına yazılır:

- satış faturası, satın alma faturası, tahsilat ve çek/senet;
- iki bağlı satırla virman;
- yalnızca manuel kayıtlarda düzenleme/silme;
- `source_system = MANUAL_ENTRY`, `entry_origin = MANUAL` denetim alanları;
- global belge numarası tekillik denetimi ve tam yeniden hesaplama.

Bu alanlar finansal davranışı değiştirmez; aktarılmış kayıtla aynı bakiye ve
ekstre etkisini üretir.

## 6. Uygulama sırası

1. Yeni TypeScript kanonik tipleri ve IndexedDB sürüm yükseltmesi.
2. Olay deposu/repository katmanı, belge indeksi ve atomik yükleme işlemi.
3. Parserların yeni dönüşümleri; zincir, SATIN ALMA ve CANCELLED kuralları.
4. Havale–çek eşleştirme ve inceleme kuyruğu.
5. Tek hesaplama motoru: bakiye, fatura yaşı, açık fatura, ekstre, risk.
6. Manuel işlem ve virman servisleri.
7. Cari ekranı, sonra Dashboard/Fatura Kontrol/Sevkiyat/AI geçişi.
8. Eski-yeni mutabakat; kullanıcı onayından sonra eski depoların kaldırılma
   kararının ayrıca alınması.

## 7. Mutabakat ve kabul ölçütleri

- Kaynak satır sayıları: kabul, kapsam dışı zincir, SATIN ALMA, CANCELLED ve
  belirsiz eşleşme sayıları ayrı raporlanır.
- Her müşteride eski/yeni bakiye farkı ve nedeni raporlanır.
- Çek/senet: açık portföy ve `PAID` toplamı ayrı raporlanır.
- 16 tekil havale–çek eşleşmesi `PAID` olmalı; belirsiz/eşleşmeyenler kuyruğa
  düşmelidir.
- Sonradan gelen CANCELLED dosyası, önceden yüklü belgeyi bütün etkileriyle
  kaldırmalıdır.
- Manuel satış, satın alma, tahsilat ve virman için birim testleri zorunludur.

## 8. Uygulamadan önce kullanıcı onayı gerektiren konular

1. Yeni IndexedDB depolarının eklenmesi ve eski depoların geçici olarak
   korunması.
2. Kaynak Excel dosyalarının yeni modele yeniden yüklenmesi.
3. Belirsiz 11 havale–çek eşleşmesi için inceleme kuyruğunun oluşturulması.
4. Mutabakat tamamlanana kadar ekranların eski ve yeni finansal sonuçlarını
   karşılaştırmalı çalıştırması.
