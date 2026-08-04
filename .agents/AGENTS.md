# AGENTS.md — panel-guncel Projesi için AI Kodlama Kuralları

> **Bu dosyayı her görev başında oku.** Gemini 3.1 Pro / Flash 3.6 (veya başka bir model) ile
> koda dokunmadan önce bu dosyanın tamamını, ilgiliyse `CODING_STANDARDS.md` ve
> `DOMAIN_GLOSSARY.md`'yi bağlama al. Kullandığın araç (Gemini CLI, Cursor, Windsurf, AI Studio
> vb.) `AGENTS.md`'yi otomatik okumuyorsa, içeriğini sistem promptuna yapıştır ya da dosyayı
> `GEMINI.md` / `.cursorrules` olarak da kopyala.

## 0. Neden bu dosya var?

Bu proje daha önce bir "Günlü Odak Analizi" denetiminden geçti (`rapor.md`,
`tarama-2-birlesik-genel-rapor.md`) ve modelin **odağı kaybettiği** birçok gerçek hata bulundu:
var olmayan alanlara referans, hesaplanıp hiç gösterilmeyen metrikler, aynı KPI için iki farklı
formül, sabit/mock değerler, yetkilendirmeyi atlayan güvenlik açıkları. Aşağıdaki kurallar bu
gerçek hatalardan türetildi — soyut tavsiye değil, bu kod tabanında **gerçekten olmuş** hata
kalıpları.

## 1. Proje Özeti

- **İş alanı:** Toptan alkollü içki bayisi için finansal yönetim / satış takip paneli.
- **Mevcut sayfalar** (`src/pages`): Dashboard, Cari Hesaplar (`CariPage`), Fatura Kontrol
  (`FaturaKontrolPage`), Sevkiyat Takip (`SevkiyatTakipPage`), Sellout Hedef
  (`SelloutHedefPage`), AI Rep Performance, AI Risk Analysis, AI Logistics, AI Chat,
  AI Analytics Hub.
- **Veri kaynağı (şu an):** Backend yok. Kullanıcı Excel dosyası yüklüyor →
  `src/parsers/` ham satırları tipli nesnelere çeviriyor → `src/calculations/` ve
  `src/services/` iş formüllerini uyguluyor → sayfalar hazır veriyi render ediyor.
- **AI entegrasyonu:** `@google/generative-ai` ile frontend'den doğrudan Gemini çağrılıyor;
  çoklu API key rotasyonu ve çevrimdışı fallback mekanizması var (`src/services/aiService.ts`).
- **Planlanan:** İleride Firebase (Firestore vb.) altyapısına geçiş — bkz. §7.

## 2. Teknoloji Yığını

React 19 · TypeScript 7 · Vite 8 · react-router-dom 7 · recharts · xlsx (SheetJS) ·
vitest + jsdom (test) · oxlint (lint, `react/rules-of-hooks: error`) ·
`@google/generative-ai` (Gemini)

## 3. Mimari Katmanlar — bu ayrımı koru

| Katman | Klasör | Sorumluluk |
|---|---|---|
| Parsers | `src/parsers` | Ham Excel satırlarını tipli nesnelere çevirir |
| Calculations | `src/calculations` | Saf fonksiyonlar, iş formülleri (cari, prim, sellout, aging) |
| Services | `src/services` | Calculations'ı birleştirir, sayfaya hazır veri üretir, AI entegrasyonu |
| Pages | `src/pages` | Services'ten veri çeker, KPI kartı + hover/advice metni render eder |
| Components | `src/components` | Paylaşılan UI (`ai/`, `common/`, `layout/`, `modals/`, `settings/`, `upload/`) |
| Types | `src/types` | Ortak arayüzler (`Customer`, `Transaction`, `ai.ts`) |

**Kural:** Bir hesaplama zaten `calculations/` veya `services/` içinde varsa, `pages/` içinde
onu tekrar yazma — import et. Yeni bir "sayfa yönlendirme" mantığı eklerken
`AiChatPanel.tsx` içindeki `subscribeHoverAnalyticsData` bloğuna bak; sayfa→fonksiyon
eşlemesi orada merkezi.

## 4. ALTIN KURALLAR — bu kod tabanında gerçekten yaşanan hatalar

1. **Var olmayan alana asla referans verme.** `x.alanAdi` okumadan önce, o objeyi üreten
   fonksiyonun gerçek dönüş tipini oku veya `grep -rn "alanAdi"` ile projede gerçekten
   set edildiğini doğrula. *(Gerçek örnek: `repData.collectionPerformance`,
   `totalOverdue28`, `averagePaymentDays` gibi alanlar hiç üretilmeden okunmuş, ekranda
   "undefined gün" / "%undefined" çıkmış.)*
2. **Hesapladığın değeri mutlaka kullan.** Bir metriği hesaplayıp return objesine koyup
   hiçbir `advice`/`subtitle`/UI metninde kullanmıyorsan, ya kullan ya hiç hesaplama.
   *(Gerçek örnek: `chequeRiskAmount` hesaplanmış ama hiçbir risk mesajında geçmiyordu.)*
3. **Bir KPI için tek doğruluk kaynağı (single source of truth).** Aynı metrik (CEI,
   Pareto %, risk skoru, ortalama vade...) projede iki farklı yerde iki farklı formülle
   hesaplanmasın. Zaten `calculations/`'da tanımlıysa import et, sıfırdan yazma.
   *(Gerçek örnek: aynı sayfada iki farklı CEI formülü, iki farklı sonuç gösteriyordu.)*
4. **Sabit/mock/placeholder sayı yasak.** `%95` gibi elle yazılmış bir oran gördüğünde
   ya da yazacağın zaman, mutlaka gerçek veriden hesapla. Placeholder gerekiyorsa açıkça
   `// TODO:` ile işaretle, sessizce sabit bırakma.
5. **Filtre/kapsam her yerde tutarlı uygulanmalı.** Müşteri veya temsilci bazlı bir sorgu
   yazıyorsan, o filtrenin fonksiyonun **tüm** dönüş değerlerine uygulandığını doğrula.
   *(Gerçek örnek: müşteri özelinde sorulan bir CEI/finansal sağlık sorusu şirket geneli
   veri döndürüyordu çünkü filtre bir yerde unutulmuştu.)*
6. **Kullanılmayan/çözülemeyen import bırakma.** İmport ettiğin her şeyi gerçekten çağır;
   çağırmayacaksan import etme. `tsc --noEmit` ile doğrula.
7. **Görev kapsamını genişletme.** Sadece istenen değişikliği yap; ilgisiz refactor,
   dosya yeniden adlandırma, stil değişikliği yapma. Kapsam dışı bir sorun fark edersen
   düzeltme — sadece "Not: X dosyasında da benzer bir sorun var, ayrı görev" diye rapor et.
8. **Sıfıra bölme koruması zorunlu.** `a / b` yazıyorsan `b > 0 ? a / b : 0` (ya da işin
   mantığına uygun varsayılan) kullan. Para formatlama için var olan `formatCurrency`
   (`src/utils/formatters.ts`) ve tarih için `dateUtils.ts` yardımcılarını kullan.
9. **Türkçe iş terimlerini `DOMAIN_GLOSSARY.md`'ye göre kullan.** "Cari", "Vade",
   "Sellout", "Prim", "Çek/Senet" gibi terimleri kendi yorumunla yeniden tanımlama.
10. **Her değişiklikten sonra doğrula ve sonucu raporla.** `npx tsc --noEmit`,
    `npm run test`, `npm run lint` çalıştırılmadan görev "tamam" denmesin. Bu projenin
    kendi denetim raporlarındaki format örnek alınabilir: *"16 → 16 hata, hepsi önceden
    var olan/modül dışı"* gibi öncesi/sonrası kıyası yaz.

## 5. AI Araç Katmanı Güvenliği (`aiService.ts`, `aiTools.ts`, `aiContext.ts`) — YÜKSEK ÖNCELİK

Bu proje geçmişte AI araç katmanında **P0 (derhal)** seviyesinde güvenlik bulguları içerdi
(dinamik kod yürütme, yetkilendirme atlama). Bu alanda çalışırken ekstra dikkatli ol:

- **LLM çıktısını asla sandbox'sız çalıştırma.** `src/services/aiTools.ts` içinde
  `advancedMapAndImportExcel` aracı hâlâ `new Function('row', args.jsFunctionBody)` ile
  modelin ürettiği JS kodunu satır satır çalıştırıyor. Bu araca dokunuyorsan: yetkilendirme
  kontrolünü (`isAdminAuthenticated()`) asla kaldırma/zayıflatma, kapsamı genişletme,
  yeni bir "dinamik kod çalıştır" aracı **ekleme**. Mevcut riskli noktayı azaltmak
  istenirse bu ayrı, açıkça onaylanmış bir güvenlik görevi olmalı — yan görev olarak yapılmaz.
- **Yazma/silme araçları her giriş noktasında aynı yetkilendirmeden geçmeli.** Online mod,
  çevrimdışı fallback (`aiFallback/`) — hepsi aynı admin kontrolünü uygulamalı. Bir
  fallback/hata yolu ekliyorsan, o yolun admin kontrolünü atlamadığını özellikle test et.
  *(Geçmişte çevrimdışı fallback, admin kontrolünü atlayarak müşteri verisi yazabiliyordu.)*
  ✅ **Kritik dinamik kod yürütme riski `new Function('row', args.jsFunctionBody)` satırı
  hâlâ kodda mevcut** — kaldırılmadı, sadece admin kontrolü altına alındı. Bunu bilerek
  çalış, "zaten düzeltilmiş" varsayma.
- **Yazma/silme aracı çağrılmadan önce açık kullanıcı onayı olmalı.** Model kendi başına
  (ikinci bir onay diyaloğu olmadan) veri yazan/silen bir aracı tetiklememeli.

## 6. Görev Protokolü — her kodlama görevinde bu sırayla ilerle

1. **Anla:** İstenen değişikliği tek cümleyle özetle; belirsizse varsayımını açıkça yaz.
2. **Ara:** İlgili alan/fonksiyon/komponent zaten var mı? `grep -rn` ile ara. Varsa
   kullan/genişlet — sıfırdan yazma (bkz. Altın Kural 3).
3. **Konumla:** Doğru katmanı seç (§3).
4. **Uygula:** Minimal, odaklı değişiklik yap. §4'teki 10 kuralı bir kontrol listesi gibi
   kullan; §5 alanına dokunuyorsan ekstra dikkat et.
5. **Doğrula:** `tsc --noEmit`, `vitest run`, `oxlint` çalıştır; yeni hata eklenmediğini
   teyit et.
6. **Raporla:** Bu proje P0 (derhal/güvenlik) → P1 (kritik/yanlış hesap) → P2 (ikincil) →
   P3 (kalite/UX) öncelik sınıflandırmasını kullanıyor (bkz. mevcut denetim raporları).
   Bulduğun/düzelttiğin sorunları bu formatla, hangi dosya/satır, kanıt, düzeltme,
   doğrulama şeklinde özetle.

## 7. Firebase Geçişi — şimdiden dikkat edilecekler

Proje şu an backend'siz. İleride Firestore/Firebase Auth'a geçilecek. Bunu kolaylaştırmak için:

- `services/` katmanındaki fonksiyonları veri kaynağından mümkün olduğunca bağımsız tut
  (zaten parse edilmiş veriyi parametre olarak alsın, Excel'e özgü varsayım yapmasın) —
  böylece girdi ileride Firestore'dan gelince `calculations/`/`services/` değişmeden kalabilir.
- `localStorage`'ı geçici cache/ayar için kullanmaya devam et, ama kalıcı iş verisi
  (satış, cari, sevkiyat kayıtları) için "gerçek veritabanı" gibi davranma.
- Şimdiden Firebase SDK'sı ekleme/kurma — bu ayrı, planlı bir görev olacak; "belki lazım
  olur" diyerek önden bağımlılık ekleme (Altın Kural 7 — kapsam genişletme yasağı).

## 8. Hızlı Referans — Klasör Haritası

```
src/
  parsers/        # Excel → tipli veri
  calculations/    # Saf iş formülleri
  services/        # Calculations birleştirme + AI entegrasyonu
  pages/           # Sayfa bileşenleri (iş mantığı YOK)
  components/ai/   # AiChatPanel, hover analytics yönlendirme
  components/modals/
  types/           # Customer, Transaction, ai.ts
  utils/           # formatCurrency, dateUtils, exportUtils...
```

İlgili diğer dosyalar: `CODING_STANDARDS.md` (kod stili, isimlendirme, test kuralları),
`DOMAIN_GLOSSARY.md` (Türkçe iş terimleri ve doğru formüller).
