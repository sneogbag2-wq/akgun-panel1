# CODING_STANDARDS.md — panel-guncel Kod Stili ve Konvansiyonları

Bu dosya `AGENTS.md`'yi tamamlar; oradaki Altın Kurallar "ne yapma"yı, bu dosya "nasıl yaz"ı
anlatır.

## TypeScript

- Strict tip kullan. `any`, sadece ham/dinamik veri sınırında kabul edilir (örn. Excel'den
  gelen ham satır) — `calculations/` ve `services/` katmanında `any` kullanma.
- Yeni alan eklerken var olan interface'i genişlet (`src/types/customer.ts`,
  `src/types/transaction.ts`) — paralel/kopya bir interface açma.
- **İsimlendirme:** senkron hesaplama fonksiyonları `...Sync` son ekiyle biter
  (örn. `calculateDashboardFocusAnalysisSync`, `getMonthlySalesRepPerformanceSync`,
  `calculateCariHesapFocusAnalysisSync`). Yeni bir hesaplama fonksiyonu eklerken bu
  konvansiyonu koru; asenkron bir versiyon eklersen `Async` son eki kullan, ikisini
  karıştırma.
- Tekrarlayan "boş nesne" literal'leri varsa (örn. rapor.md'deki `makeEmptyRep()` örneği)
  yardımcı bir factory fonksiyonuna çıkar, aynı şemayı 3 farklı yerde elle tekrar yazma.

## React

- Hook kuralları oxlint ile zorunlu (`.oxlintrc.json` → `react/rules-of-hooks: "error"`).
  Koşullu/döngü içinde hook çağırma.
- Pahalı hesaplamalar `useMemo` ile sarılır — `DashboardPage.tsx`'teki `riskTotal`,
  `repTotalDebt`, `paretoPct` deseni referans alınabilir.
- `pages/` bileşenleri iş mantığı **içermez**; `services/`'ten hazır veri çeker ve render
  eder. Bir sayfada satır satır hesaplama/if-else zinciri görüyorsan, muhtemelen
  `calculations/` veya `services/`'e taşınması gerekiyordur.
- Yeni bir KPI hover kartı eklerken, "hangi sayfa → hangi analiz fonksiyonu" eşlemesini
  `AiChatPanel.tsx` içindeki `subscribeHoverAnalyticsData` bloğuna ekle; sayfa içine ayrı
  bir yönlendirme mantığı yazma.

## Test (vitest)

- `calculations/` veya `parsers/` altına yeni fonksiyon eklerken ilgili `__tests__`
  klasörüne en az: (1) mutlu yol, (2) sınır durumu (0, negatif, boş dizi/`undefined`
  girdi) testi ekle.
- Sıfıra bölme, boş dizi ve `undefined` alan senaryolarını özellikle test et — bu proje
  tarihsel olarak tam bu noktalarda hata üretti (bkz. `AGENTS.md` §4, madde 1 ve 8).
- Değişiklik sonrası `npm run test` (veya `vitest run`) çalıştır, sonucu görev özetine yaz.

## Lint & Format

- `npm run lint` (oxlint) hatasız geçmeli.
- Para birimi: her zaman `formatCurrency` (`src/utils/formatters.ts`) kullan; manuel
  `.toFixed()` + string birleştirme ile TL yazma.
- Tarih: `dateUtils.ts` içindeki `formatDate`/ilgili yardımcıları kullan.
- Excel dosya adı/kolon eşleme değişikliklerinde `src/config/fileTypes.ts` ve
  `src/parsers/columnMappings.ts` merkezi kalsın; sayfa/servis içine ayrı bir eşleme
  tablosu gömme.

## AI Servis Katmanı (`aiService.ts`, `aiTools.ts`, `aiContext.ts`)

- API key'leri asla hardcode etme; sadece `import.meta.env.VITE_GEMINI_API_KEY*` üzerinden
  oku (mevcut çoklu key + rotasyon mantığını koru, `getApiKeys()`).
- Yeni bir AI "tool" eklerken hem `aiTools.ts`'e fonksiyonu ekle hem `aiContext.ts`'teki
  system prompt/tool tanımını güncelle — ikisi senkron olmalı, biri unutulursa model
  aracı "görür" ama çağıramaz ya da tam tersi.
- Yazma/silme yapan yeni bir tool eklerken `AGENTS.md` §5'teki güvenlik kurallarına uy
  (admin kontrolü + açık kullanıcı onayı, tüm giriş noktalarında tutarlı).
- Model adı/sürümü hardcode edilecekse tek bir merkezi sabitte tut, birden fazla dosyada
  tekrar etme (ileride model güncellemesi tek yerden yapılabilsin).

## Commit / Değişiklik Özeti (öneri)

- Küçük, tek amaçlı değişiklikler yap.
- Değişiklik özetinde şunlar olsun: hangi dosya(lar) değişti, hangi Altın Kural/bulgu
  gerekçe oldu, `tsc`/`test`/`lint` doğrulama sonucu (öncesi → sonrası hata sayısı gibi).
