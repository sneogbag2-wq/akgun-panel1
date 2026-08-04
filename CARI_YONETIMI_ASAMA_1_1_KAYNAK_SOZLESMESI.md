# Cari Yönetimi — Aşama 1.1: Kaynak Sözleşmesi

**Durum:** Taslak; onay bekliyor.  
**Kapsam:** Yalnızca cari yönetimi için onaylanan yedi Excel kaynağı.  
**Bu belge bir uygulama veya migrasyon değildir.**

## 1. Kaynak kapsamı ve arşiv durumu

| Dosya | Satır | Hedef olay | Arşivleme statüsü |
|---|---:|---|---|
| `export (9).xlsx` | 3.602 | Müşteri ana verisi | Aktif kaynak + ham kaynak arşivi |
| `Satış_(Veri_Yazma)_Listesi_03082026_232509.xlsx` | 4.423 | Satış faturası / borç | Aktif kaynak + ham kaynak arşivi |
| `Nakit_Tahsilat_Listesi_03082026_232551.xlsx` | 3.815 | Nakit/kart tahsilatı | Aktif kaynak + ham kaynak arşivi |
| `Havale_Tahsilatı_Listesi_03082026_232648.xlsx` | 396 | Banka tahsilatı | Aktif kaynak + ham kaynak arşivi |
| `Çek_Tahsilatı_Listesi_03082026_232611.xlsx` | 25 | Çek varlığı / risk | Aktif kaynak + ham kaynak arşivi |
| `Senet_Tahsilatı_Listesi_03082026_232632.xlsx` | 8 | Senet varlığı / risk | Aktif kaynak + ham kaynak arşivi |
| `Satın_Alma_(Veri_Yazma)_Listesi_03082026_232531.xlsx` | 1.325 | Alacak düşüşü | Aktif kaynak + ham kaynak arşivi |

Toplam aktif kaynak hacmi: **13.594 satır**.

`Belgeler (9).xlsx` cari kapsamına alınmaz; sipariş/sevkiyat modülü için
saklanır. `export (10).xlsx` ve `Sellout Raporu (5).xlsx` de aynı şekilde
ilgili sonraki modüllerde kullanılacaktır.

## 2. Onay için önerilen ortak kurallar

| Konu | Önerilen kural | Kanıt / gerekçe |
|---|---|---|
| Müşteri anahtarı | `external_customer_id`: kırpılmış metin; baştaki sıfırlar korunur. | Satışta `Cari Kodu 2` 4.291/4.423, tahsilatlarda ve çek/senette tamamen doludur. |
| Kapsam dışı kayıt | `Cari Kodu 2` / `Cari Kodu2` boşsa kayıt işlenmez. | Bunlar zincir mağaza kayıtlarıdır; cari yönetimi kapsamı dışındadır. |
| Kaynak önceliği | Ana veri: `Müşteri`; satış/tahsilat/çek/senet: `Cari Kodu 2`; alacak düşüşü: `Cari Kodu2`. | `Cari Kodu` güvenilir bağ anahtarı değildir ve geri dönüş için dahi kullanılmaz. |
| Tarih | Veri katmanında ISO `YYYY-MM-DD`; kullanıcı arayüzünde `DD/MM/YYYY`. | Excel hücrelerinin `7/31/26` görünümü kaynak biçiminden gelir; ISO saklama ile anlam sabit kalır. |
| Para | `decimal(18,2)` + `currency_code`; kaynak işlem ve belge para birimi ayrı izlenir. | Tahsilat ve çek/senet kaynaklarında para birimi alanları tam doludur; belge para birimi örnekte `TRY`dir. |
| Aktarım durumu | `Aktarıldı`, `Aktarılamadı` ve havaledeki `Durum_` alanı cari iş modeline alınmaz. | Kullanıcı kararı; yalnızca ham kaynak arşivinde kalır. |
| Ters işlem filtresi | Belge numarası kaynak türünden bağımsız küresel olarak tekildir. Aynı belge numaralı kayıtlardan herhangi biri `Kayıt Tipi = CANCELLED` ise tüm belge grubu doğrudan atılır. | Kullanıcı kararı; farklı kaynakta aynı belge no yalnızca ters kayıt ilişkisini gösterir. |
| Sürekli ters işlem taraması | Her dosya yüklemesinde, yeni kayıtlar mevcut kayıt havuzuyla belge numarası üzerinden yeniden taranır. Sonradan gelen `CANCELLED` kaydı, önceden yüklenmiş aynı belge ve ters kayıt karşılığını siler. | Kullanıcı kararı. |
| Alacak düşüşü | Yalnızca `HIZMET` ve `IADE` türleri müşteri alacak düşüşü olarak işlenir. `SATIN ALMA`, tedarikçi/Efes bağlamıdır ve kapsam dışıdır. | Kullanıcı kararı. |
| Temsilci | İşlem dosyalarındaki temsilci/tahsilatçı alanları iş modeline alınmaz; müşteri eşleştirmesi `export (9).xlsx` ana verisindeki temsilci ve saha satış müdürü üzerinden yapılır. | Kullanıcı kararı. |
| Çek/senet | Portföy/risk varlığıdır; tutarı cari bakiyeyi düşürür ve aynı zamanda riskte kalır. | Kullanıcı kararı. |
| Havale–çek/senet eşleştirmesi | Gönderilecek ayrı eşleştirme Excel'i tek yetkili kaynak olacaktır. Eşleşen havale cari bakiyeyi yeniden düşürmez; enstrüman `PAID` olur ve riskten çıkar. | Kullanıcı kararı; havale açıklaması kullanılmaz. |

## 3. Kaynakların kanonik alan eşlemesi

| Olay | Zorunlu alanlar | Koşullu / olay görünümü | Çekirdekten ayrılacak alanlar |
|---|---|---|---|
| Müşteri | `Müşteri`, `Müşteri Adı`, `Müşteri Durumu` | Tabela adı, kanal, grup, segment, il/ilçe, açılış/kapanış, temsilci | Telefon, e-posta, vergi/TC, açık adres; yalnızca erişim kontrollü ayrı alanda veya ham arşivde |
| Satış faturası | Fatura No, Fatura Tarihi, Cari Kodu 2, Satış Tutarı, Fatura Durum | E-belge no, sipariş/irsaliye, fatura tipi | Vade tarihi, işlem temsilcisi, telefon, vergi, il/ilçe, plaka ve sürücü |
| Nakit tahsilat | Belge Numarası, Fatura Tarihi, Cari Kodu 2, Tutar, para birimi | Kasa, açıklama | Aktarım durumu, tahsilatçı/temsilci, kimlik, telefon, vergi, il/ilçe |
| Havale tahsilat | Belge Numarası, Fatura Tarihi, Cari Kodu 2, Tutar, para birimi | Banka kodu/adı, hesap referansı, açıklama | Aktarım durumu, işlem temsilcisi, kimlik, telefon, vergi, il/ilçe |
| Alacak düşüşü | Fatura No, Fatura Tarihi, Cari Kodu2, Tutar, Tip | E-belge, irsaliye/sipariş | `SATIN ALMA` türü, bayi bilgisi, işlem temsilcisi |
| Çek/senet | Belge Numarası, Çek/Senet No, Cari Kodu 2, Fatura Tarihi, Vade Tarihi, Tutar, para birimi, Durum | Banka, hesap referansı, açıklama | Kimlik, telefon, vergi, adres |

## 4. Veri kalitesi bulguları

- Müşteri ana verisi 3.602 satır içerir; envantere göre 1.819 farklı müşteri
  değeri vardır. Tekrarlı satırlar tarihsel sürüm, kanal veya atama olabilir;
  şimdilik kayıpsız tutulmalıdır.
- Satışta 132 satırda `Cari Kodu 2` yoktur. Bunlar zincir mağaza kabul edilir
  ve cari yönetimi kapsamı dışında bırakılır.
- Satış, satın alma, nakit, havale, çek, senet ve kredi kartı kaynaklarında
  ters işlem filtresi ayrıştırma/toplama öncesi uygulanır. Kaynak satırları
  ve ters kayıt karşılıkları arşivlenmez; hedef iş tablolarına yazılmaz.
- `Cari Kodu` alanının değerleri (`Z001`, `2222`, `0` gibi) müşteri anahtarı
  olarak kullanılamaz.
- Satış dosyasındaki Depo Kodu, Vergi Toplamı, Toplam İndirim, İş Yeri,
  Fabrika, Bölüm, Ambar ve Oluşturma Tarihi bu örnekte boştur; çekirdek şemaya
  alınmaz.
- Çek kaynağında banka adı yalnızca 3/25 satırda; senet kaynağında banka alanı
  yoktur. Banka bilgisi zorunlu değildir.

## 5. Aşama 1.2'ye geçiş öncesi onay noktaları

Bu kararlar onaylandı. Aşama 1.2'de fiziksel şema uygulanmayacak; önce
onaya sunulacak çekirdek cari model taslağı hazırlanacaktır.
