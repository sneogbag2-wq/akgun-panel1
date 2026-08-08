# Paket 00 — Anonim test fixture politikası

## Amaç

Test ve karakterizasyon verisi yapısal davranışı doğrulamalı; gerçek müşteri, ürün, belge, tahsilat, Excel satırı veya erişim sırrını Git'e taşımamalıdır. Bu politika Paket 00'da ve sonraki tüm paketlerde zorunludur.

## Kesin yasaklar

- Gerçek Excel dosyasından satır, başlık+değer kombinasyonu, müşteri/ürün adı, belge numarası, tutar, temsilci veya tarih kopyalanmaz.
- `.env`, API anahtarı, Supabase project ref, kullanıcı verisi, dosya hash'i veya ekran görüntüsündeki hassas veri fixture'a, markdown'a ya da test hata çıktısına yazılmaz.
- Gerçek dosya Git fixture'ı, snapshot'ı veya seed'i olmaz. Gerçek veri yalnız kullanıcının yerel ortamında, Git dışı ve geçici doğrulama için kullanılabilir.
- Anonim örnek ile gerçek kişiyi/kurumu çağrıştıracak ad, marka, yer, belge dizisi veya tutar dizisi oluşturulmaz.

## İzinli sentetik özellikler

- `500...` biçimli müşteri kimliği, başında sıfır bulunan belge, 15+ haneli metin kimliği ve yapay ürün kodu.
- Negatif tutar, iki ondalıklı TRY metni, çok büyük sayısal metin ve 1 tabanlı satır numarası gibi biçimsel sınır değerleri.
- Açıkça sentetik `anon-*`, `ANONIM_*`, `P00-*` adları, sabit UTC tarihleri ve kurgu hata kodları.

`src/test/fixtures/anonymousDomainFixtures.ts` temel factory'dir. Aynı testte farklı veri gerekiyorsa factory sonucu kopyalanıp yalnız sentetik alanlar değiştirilir; fixture'a gerçek kaynak eklenmez.

## Karakterizasyon testi yöntemi

1. Mevcut davranışı küçük sentetik girdilerle ölç ve test adında paket/karar kimliğini belirt (`P00-*`, ileride ilgili metric/rule id).
2. Test, mevcut sonucun **doğru iş kuralı** olduğunu değil, değişikliğin etkisini görünür kıldığını açıkça ifade etsin.
3. Yeni onaylı hesap kuralı gerekirse önce ilgili paket sözleşmesi, sonra ayrı sentetik fixture ve kabul testi yazılsın.
4. Kaynak verideki bir tutarsızlık ancak anonimleştirilmiş minimal örnek ve hangi kabul kuralını sınadığı açıklamasıyla temsil edilsin.

## İnceleme kapısı

Her yeni fixture veya test verisi için gözden geçiren şunları doğrular:

- Değerler gerçek kaynakla birebir ya da yeniden tanımlanabilir şekilde eşleşmiyor mu?
- Test, farklı gerçek müşteri/ürün adlarını veya gizli anahtarları hata mesajında dökmüyor mu?
- Kimlik metin olarak tutuluyor; domain para hesapları `Money` ile mi yapılıyor?
- İlgili test, onaylı paket sınırını aşmadan yalnız karakterizasyon/sözleşme davranışını mı kapsıyor?
