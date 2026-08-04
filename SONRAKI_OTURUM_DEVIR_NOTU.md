# Sonraki Oturum Devir Notu — Veri Yeniden Tasarımı

## Başlangıç talimatı

Bu belge, yeni oturumdaki agent için çalışma bağlamıdır. Önce aşağıdaki
belgeleri sırayla oku; sonra kullanıcıdan yeni onay almadan uygulama kodu,
şema veya mevcut veri üzerinde değişiklik yapma.

1. `VERI_YENIDEN_TASARIM_ENVANTERI.md`
2. `VERI_YENIDEN_TASARIM_PLANI.md`
3. `CARI_YONETIMI_ASAMA_1_1_KAYNAK_SOZLESMESI.md`
4. `CARI_YONETIMI_ASAMA_1_2_MODEL_TASLAGI.md`
5. `CARI_YONETIMI_ASAMA_1_3_HESAPLAMA_VE_EKRAN_ETKISI.md`
6. `CARI_YONETIMI_ASAMA_1_4_TEKNIK_GECIS_TASLAGI.md`

## Nerede kalındı?

Cari Yönetimi modülünde ilk üç tasarım aşaması kullanıcı tarafından onaylandı;
uygulama öncesi teknik geçiş taslağı da hazırlandı:

- Aşama 1.1: kaynak sözleşmesi ve veri kalitesi
- Aşama 1.2: çekirdek olay modeli
- Aşama 1.3: hesaplama, ekran etkisi ve manuel işlem davranışı
- Aşama 1.4: teknik geçiş, IndexedDB ve mutabakat taslağı (onay bekliyor)

Henüz **hiçbir uygulama kodu, veritabanı şeması, parser veya mevcut kayıt
değiştirilmedi**. Bir sonraki doğal adım, kullanıcı onayıyla Aşama 1.4'ün
uygulanmasıdır; doğrudan kodlamak değildir.

## Onaylanmış cari kaynakları

| Dosya | Rol | Durum |
|---|---|---|
| `EXCEL/export (9).xlsx` | Müşteri ana verisi, temsilci, saha satış müdürü | Aktif |
| `EXCEL/Satış_(Veri_Yazma)_Listesi_03082026_232509.xlsx` | Satış faturaları | Aktif |
| `EXCEL/Nakit_Tahsilat_Listesi_03082026_232551.xlsx` | Nakit/kart tahsilatları | Aktif |
| `EXCEL/Havale_Tahsilatı_Listesi_03082026_232648.xlsx` | Havale tahsilatları | Aktif |
| `EXCEL/Çek_Tahsilatı_Listesi_03082026_232611.xlsx` | Çek portföyü | Aktif |
| `EXCEL/Senet_Tahsilatı_Listesi_03082026_232632.xlsx` | Senet portföyü | Aktif |
| `EXCEL/Satın_Alma_(Veri_Yazma)_Listesi_03082026_232531.xlsx` | HIZMET/IADE alacak düşüşleri | Aktif |
| `CEK.xlsx` | Genişletilmiş çek eşleştirme kaynağı | İncelendi; havale eşleştirmesinde kullanılır |
| `SENET.xlsx` | Genişletilmiş senet kaynağı | İncelendi; senet portföyü için sonraki yükleme tasarımına dahil edilecek |
| `Havale.xlsx` | Genişletilmiş havale eşleştirme kaynağı | İncelendi; havale eşleştirmesinde kullanılır |

Cari kapsamı dışında tutulan dosyalar:

- `EXCEL/Belgeler (9).xlsx`: sipariş/sevkiyat modülünde ele alınacak.
- `EXCEL/export (10).xlsx`: sipariş/sevkiyat modülünde ele alınacak.
- `EXCEL/Sellout Raporu (5).xlsx`: sellout modülünde ele alınacak.

## Kesin iş kuralları

### Kimlik, tarih ve kapsam

- Müşteri bağ anahtarı: `Cari Kodu 2` / `Cari Kodu2`; metindir, baştaki
  sıfırlar korunur.
- Bu alan boşsa kayıt zincir mağazadır ve cari kapsamı dışındadır. `Cari Kodu`
  geri dönüş anahtarı olarak dahi kullanılmaz.
- Veriler ISO tarih olarak saklanacak, ekranda `DD/MM/YYYY` gösterilecek.
- Fatura vade tarihi kullanılmayacak.
- Yaşlandırma/fatura yaşı, fatura tarihinden sonra geçen günle hesaplanacak.
- İşlem Excel'lerindeki temsilci ve tahsilatçı bilgileri kullanılmayacak;
  temsilci ve saha satış müdürü yalnızca `export (9).xlsx` ana verisinden
  gelecek.
- `Aktarıldı`, `Aktarılamadı` ve `Durum_` finansal modele alınmayacak.

### Satın alma, tahsilat ve çek/senet

- Otomatik satın alma kaynağında `HIZMET` ve `IADE`: müşteri alacak düşüşü.
- Otomatik `SATIN ALMA`: tedarikçi/Efes bağlamı; cari kapsamı dışında.
- Çek/senet teslim alındığında cari bakiyeyi düşürür ve aynı anda açık riskte
  kalır.
- Çek/senet risk toplamı yalnızca `PAID` olmayan açık enstrümanlardan oluşur.
- Havale `Hesap No` ile çek `Çek Hesap No` alanı eşleşmektedir. `Çek No` ile
  eşleşme yoktur.
- Tek başına hesap numarası güvenli değildir. Otomatik `PAID` eşleşmesi için
  aynı hesap no + aynı `Cari Kodu 2` + aynı tutar tek aday üretmelidir.
- İncelenen veri setinde 27 hesap no içeren havalenin 16'sı bu üç koşulla tekil
  eşleşir; belirsiz/eşleşmeyen kayıtlar inceleme kuyruğuna alınmalıdır.
- Eşleşen havale `balance_effect = 0` olur; çek/senet `PAID` olur ve riskten
  düşer. Böylece cari bakiye ikinci kez düşmez.
- Eşleşmeyen havale normal tahsilattır ve `balance_effect = -tutar`dır.

### Ters işlem ve silme

- Belge numarası kaynak türünden bağımsız küresel olarak tekildir.
- Her yüklemede, gelen ve mevcut kayıtların tamamı belge numarasıyla taranır.
- `Kayıt Tipi = CANCELLED` olan bir belge bulunursa, aynı belge numaralı tüm
  karşılıklar doğrudan silinir; arşivlenmez.
- Bu silme sonradan gelen `CANCELLED` kaydının daha önce yüklenen belgeyi de
  kaldırmasını kapsar.
- Silme sonrası bakiye, açık faturalar, fatura yaşı, çek/senet riski, ekstre ve
  raporlar yeniden hesaplanır.

### Manuel işlemler

- Manuel işlemler aktarılan işlemlerden finansal olarak farksızdır.
- Manuel satış faturası: `+tutar`.
- Manuel satın alma faturası: müşteri alacak düşüşü, `-tutar`.
- Manuel tahsilat: `-tutar`.
- Manuel çek/senet: `-tutar` ve açık risk.
- Virman: iki bağlı satır oluşturur; kaynak cari `-tutar`, hedef cari `+tutar`.
- Ekleme, düzenleme ve silme yalnızca manuel işlemlerde desteklenir.
- `entry_origin = MANUAL` ve `source_system = MANUAL_ENTRY` yalnız denetim
  içindir; hesaplamayı değiştirmez.
- Manuel belge numaraları da küresel tekillik kuralına uyar.

## Onaylanmış hedef model

`customers`, `customer_assignments`, `sales_invoices`,
`customer_credit_events`, `collections`, `payment_instruments`,
`source_raw_records` ve türetilmiş finansal görünümler.

Türetilmiş görünümler:

- `customer_financial_position`
- `customer_statement_lines`
- `customer_open_invoices`
- `customer_aging`
- `customer_instrument_risk`

Detaylı alan sözleşmeleri Aşama 1.2 belgesindedir.

## Bir sonraki oturumda önerilen çalışma sırası

1. Kullanıcıdan Aşama 1.4'ün uygulanması için açık izin al.
2. Uygulama öncesi teknik tasarımı sun:
   - Mevcut IndexedDB depolarından yeni olay tablolarına geçiş,
   - yükleme sırası ve sürekli `CANCELLED` taraması,
   - belge numarası küresel indeksi,
   - çek hesap no + müşteri + tutar eşleştirme kuyruğu,
   - manuel işlem ve virman kullanıcı akışları,
   - geri dönüş/mutabakat planı.
3. Onaydan sonra önce veri katmanı ve testler, ardından parser/yükleme, sonra
   hesaplamalar, son olarak ekranlar/AI geçişini uygula.
4. Her alt uygulama adımından önce kullanıcıya etkisini ve doğrulama ölçütünü
   sun; onay olmadan hayata geçirme.

## Mevcut kodda dikkat edilecek noktalar

- Uygulama `panel/` altında React/TypeScript'tir; veriler tarayıcı içi
  IndexedDB'de `archiveService.ts` ile saklanır.
- Mevcut finansal hesaplar `panel/src/calculations/cariCalculations.ts`
  içindedir. Yeni modelde ekranların ayrı ayrı hesap yapması engellenmelidir.
- Mevcut tek-dosyalı iptal filtresi `panel/src/calculations/cancelledFilter.ts`
  içindedir. Bu filtre küresel, kalıcı ve her yüklemede çalışan taramaya
  dönüştürülecektir.
- Yükleme hattı `panel/src/services/uploadService.ts`, parserlar
  `panel/src/parsers/`, depolama ise `panel/src/services/archiveService.ts` ve
  `panel/src/services/customerService.ts` içindedir.
- Mevcut kodda kişisel/vergi alanları yaygındır. Yeni cari çekirdeğine bunları
  taşımama ve en az ayrıcalık ilkesi korunmalıdır.

## Henüz karar verilmemiş / uygulamada doğrulanacak konular

- Çek hesap no + müşteri + tutar ile tekil olmayan 11 havale kaydı için inceleme
  kuyruğunun ekranı ve kullanıcının onay/ret akışı.
- Kredi kartı kaynağının kesin dosya adı ve alan eşlemesi; iş kuralı mevcut
  olsa da dosya ayrıca görünür değil.
- Normal aktif ham kaynak arşivinin fiziksel saklama biçimi. Ters işlem
  grupları kesin olarak arşivlenmeyecek/silinecek.
