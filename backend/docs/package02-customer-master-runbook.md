# Paket 02 — Müşteri Master v2 yerel çalışma notu

Bu akış yalnız yerel Supabase/Docker ortamındadır. `supabase status` içinde URL'nin `127.0.0.1` veya `localhost` olmadığını görürseniz durun; reset veya seed çalıştırmayın.

```powershell
npx supabase start
npx supabase db reset --local
npx supabase test db --local supabase/tests/package01_ingestion_foundation_test.sql supabase/tests/package02_customer_master_test.sql
```

Paket 02, `CUSTOMER_MASTER` için yalnız tam snapshot yayınlar. Dosya `Müşteri`, `Müşteri Adı`, `Tabela Adı`, `Satış Temsilcisi Adı`, `Dist Satış Şefi Adı`, `Satış Kanalı Tanımı`, `Müşteri Hacim Segmenti` ve `Müşteri Durumu` başlıklarının tamamını taşımalıdır. Müşteri kodu Excel hücresinde metin olmalı ve doğrudan `500...` biçiminde gelmelidir; sayısal, bilimsel veya noktalı kodlar yayınlanmaz.

Backend varsayılan olarak kapalıdır. Yalnız yerel deneme terminalinde aşağıdaki değerle açılabilir:

```powershell
$env:CUSTOMER_MASTER_V2_ENABLED='true'
npm run dev
```

Canlı kullanıcı verisi veya gerçek Master satırı fixture'a/Git'e konulmaz. Parser, sadece beklenen ZIP/XLSX yapısını ve metin/sayı hücrelerini kabul eder; arşiv boyutu, entry sayısı ve açılmış XML boyutu sınırlandırılmıştır. Bilinmeyen arşiv özelliği fail-closed reddedilir.

Paket 15 kabul edilmeden panel, eski parser ve eski müşteri ekranı v2'ye yönlendirilmez. Kapatmak için yerel terminali durdurun ve gerekirse yalnız yerel ortamda `npx supabase stop` kullanın.
