# Paket 04 — Sellout v2 yerel doğrulama

Bu paket yalnız `SELLOUT_TRADITIONAL` kaynağını, `Faturalama Tarihi` ile takvim ayını ve litre metriklerini işler. `Net`, `Brüt`, iskonto, kaynak kanal ve temsilci alanları provenance'dır; finansal metrik değildir.

1. Docker Desktop çalışırken kökte `npx.cmd --yes supabase db reset --local` çalıştırın.
2. `npx.cmd --yes supabase test db --local supabase/tests/package04_sellout_test.sql` ile SQL kabulünü çalıştırın.
3. `backend` altında `node --test src/modules/sellout/__tests__/*.test.js` çalıştırın.
4. Sunucu flag'i yalnız `SELLOUT_EVENTS_V2_ENABLED=true` ile açılır. Kapalı durumda eski parser, IndexedDB, hedef ekranı ve raporlar değişmez.

Kaynak dosyası ayrı, güvenli import saklama alanına yüklenir. Gerçek kaynak satırlarını fixture, log veya Git'e koymayın. İstek kapsamı `coverageFrom`, `coverageTo`, `coverageConfirmation=true` taşır; onaysız kapsam yayımlanmaz. Aylık API yalnız `YYYY-MM` kabul eder; `3/6/12` finansal dönemdir ve Sellout filtresi değildir.
