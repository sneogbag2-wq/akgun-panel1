# Veri Yeniden Tasarım Planı

## Çalışma ilkesi

Tasarım modül modül ilerler. Her modülde önce tasarım, kaynak eşlemesi,
etki analizi ve kabul ölçütleri hazırlanır. Kullanıcı onayı olmadan şema,
kod, yükleme akışı veya mevcut veriler değiştirilmez.

## Modül 1 — Cari Yönetimi

### Amaç

Müşteri, cari borç/alacak, tahsilat, alacak düşüşü ve çek/senet riskini
olay-temelli ve izlenebilir bir modele taşımak.

### Onaylanmış kaynak kapsamı

| Kaynak dosya | Cari rolü | Arşivleme statüsü |
|---|---|---|
| `export (9).xlsx` | Müşteri ana verisi | Aktif kaynak + ham kaynak arşivi |
| `Satış_(Veri_Yazma)_Listesi_03082026_232509.xlsx` | Satış faturaları / cari borç | Aktif kaynak + ham kaynak arşivi |
| `Nakit_Tahsilat_Listesi_03082026_232551.xlsx` | Tahsilat / borç düşüşü | Aktif kaynak + ham kaynak arşivi |
| `Havale_Tahsilatı_Listesi_03082026_232648.xlsx` | Tahsilat / borç düşüşü | Aktif kaynak + ham kaynak arşivi |
| `Çek_Tahsilatı_Listesi_03082026_232611.xlsx` | Çek portföyü ve risk | Aktif kaynak + ham kaynak arşivi |
| `Senet_Tahsilatı_Listesi_03082026_232632.xlsx` | Senet portföyü ve risk | Aktif kaynak + ham kaynak arşivi |
| `Satın_Alma_(Veri_Yazma)_Listesi_03082026_232531.xlsx` | Cari alacak düşüşü: iade/hizmet/dekont | Aktif kaynak + ham kaynak arşivi |
| `Belgeler (9).xlsx` | Cari kapsamı dışı; sipariş/sevkiyat modülünde ele alınacak | Saklanacak; cari yüklemesine alınmayacak |
| `export (10).xlsx` | Sipariş/sevkiyat modülünde ele alınacak | Saklanacak; ilgili modülün aktif kaynağı |
| `Sellout Raporu (5).xlsx` | Sellout modülünde ele alınacak | Saklanacak; ilgili modülün aktif kaynağı |

Ham kaynak arşivi; dosya adı, kaynak satırı, yükleme zamanı ve içerik özetiyle
erişimi sınırlı saklanan özgün kaynak kaydıdır. Ham veri, iş tablolarına
kopyalanmaz.

### Aşama 1.1 — Kaynak sözleşmesi ve veri kalitesi (tamamlandı; onay bekliyor)

1. Yedi aktif dosyanın gerçek sütunlarını, tiplerini ve doluluklarını çıkarmak.
2. Müşteri anahtarı, tarih, para/birim ve durum dönüşüm kurallarını yazmak.
3. Kaynak-bazlı tekillik ve arşiv anahtarlarını tanımlamak.
4. Cari hesaplamasına girmeyen veya hassas alanları ayırmak.

**Çıktı:** `CARI_YONETIMI_ASAMA_1_1_KAYNAK_SOZLESMESI.md` — onaylanabilir alan
sözlüğü, dönüşüm kuralları ve açık karar listesi.
**Bu aşamada:** Kod veya veri migrasyonu yapılmaz.

### Aşama 1.2 — Çekirdek cari modeli (onaylandı; uygulama bekliyor)

`CARI_YONETIMI_ASAMA_1_2_MODEL_TASLAGI.md` hazırlandı. Onaydan sonra
uygulama şeması, yükleme dönüşümleri ve doğrulama testleri tasarlanır.

### Aşama 1.3 — Hesaplama ve ekran etkisi (onaylandı; uygulama bekliyor)

`CARI_YONETIMI_ASAMA_1_3_HESAPLAMA_VE_EKRAN_ETKISI.md` hazırlandı. Bakiye,
fatura yaşı, açık fatura, risk ve ekstre kuralları ile ekran etkileri tasarlandı.

### Aşama 1.4 — Uygulama ve mutabakat (teknik taslak tamamlandı; onay bekliyor)

`CARI_YONETIMI_ASAMA_1_4_TEKNIK_GECIS_TASLAGI.md` hazırlandı. Onay sonrası
uygulama, yükleme/migrasyon, eski-yeni bakiye mutabakatı ve kabul testleri
tamamlanır.

## Sonraki modüller

1. Sipariş ve sevkiyat (`Belgeler (9).xlsx`, `export (10).xlsx`)
2. Sellout ve ürün performansı (`Sellout Raporu (5).xlsx`)
3. Dashboard, raporlama ve AI sorgu katmanı
4. Uçtan uca mutabakat, arşiv erişimi ve veri kalitesi izleme
