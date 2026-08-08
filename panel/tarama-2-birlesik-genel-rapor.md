# Kapsamlı Tarama #2 — Birleşik Genel Bulgular Raporu

**Durum:** Düzeltme tamamlandı — P0 (B12, B13), P1 (B1, B6, B7), P2 (B8, B9, B10, B14, B15) ve P3 (B2, B3, B4, B5, B11) dahil raporlanan **15 bulgunun tamamı** uygulandı.  
**Kapsam:** İlk plan/bulgular belgesi ile devam sayfa-servis taraması ve AI servis/araç katmanı taraması birleştirilmiştir.  
**Kaynak belgeler:**

- `tarama-2-plan-ve-bulgular.md` — B1–B6
- `tarama-2-devam-bulgular.md` — B7–B11
- `tarama-2-ai-service-ve-tools-bulgular.md` — B12–B15

## Yönetici özeti

Toplam **15 bulgu** tespit edildi: **5 kritik**, ikinci düzey düzeltme paketinde ele alınacak **5 bulgu** ve ürün kalitesi/açıklanabilirlik kapsamında ele alınacak **5 bulgu**. En acil riskler iki kümede toplanır:

1. **Yanlış finansal karar desteği:** Ödeme vadesi alanı üç ekranda hiç var olmayan bir isimle okunuyor; müşteri bazlı finansal sağlık/CEI istekleri şirket geneli veri döndürüyor; risk tablosunda yaşlandırma tutarları yanlış aralığa yazılıyor.
2. **AI üzerinden veri güvenliği ve bütünlüğü:** LLM'nin ürettiği JavaScript çalıştırılıyor; çevrimdışı fallback yönetici yetkisini atlayarak müşteri verisi yazabiliyor; yönetici açıkken model, açık ikinci onay olmadan yazma/silme araçlarını çalıştırabiliyor.

### Öncelik özeti

| Öncelik | Bulgular | Önerilen aksiyon | Durum |
|---|---|---|---|
| P0 — derhal | B12, B13 | Dinamik kod yürütmeyi kapatın; fallback'teki doğrudan aktarımı kaldırın. | ✅ Tamamlandı |
| P1 — ilk düzeltme paketi | B1, B6, B7 | Var olmayan alanı düzeltin; müşteri sorgusunu bütün hesaplara uygulayın. | ✅ Tamamlandı (B1, B6, B7) |
| P2 — ikinci paket | B8, B9, B10, B14, B15 | Raporlama kapsamlarını ve onay akışını düzeltin. | ✅ Tamamlandı |
| P3 — ürün kalitesi | B2, B3, B4, B5, B11 | Açıklanabilirlik, görünürlük ve küçük UX doğruluk iyileştirmeleri yapın. | ✅ Tamamlandı |

---

## Referans şema: `getCustomerPaymentTrendSync()`

Bu şemada **`averagePaymentDays` diye bir alan yoktur**. Ödeme günü okunacaksa bağlama göre `actualPaymentDays.raw3M` veya `averageDays12M` kullanılmalıdır.

```ts
{
  customerName, signName, customerId,
  contractualVade: string,
  actualPaymentDays: {
    days3M, days6M, days12M: string,
    raw3M, raw6M, raw12M: number
  },
  averageDays12M: number,
  preferredMethod: string | 'Veri Yok',
  methodPercentages: { nakit, havale, krediKarti },
  trendDirection: 'SLOWING' | 'IMPROVING' | 'STABLE',
  riskInsight: string
}
```

---

## 🔴 B1 — Modal başlığında var olmayan `averagePaymentDays` alanı okunuyor

**Dosya:** `src/components/modals/CustomerHeaderAIInsight.tsx`, satır 17  
**Kanıt:** `const avgDays = trend?.averagePaymentDays || 0;`

`getCustomerPaymentTrendSync()` bu alanı üretmez. Bu yüzden modalın INVOICES ve STATEMENT sekmelerindeki ödeme hızı metinleri ya **0 gün** gösterir ya da gerçek ödeme günü yerine genel bir ifade kullanır.

**Düzeltme:** `trend?.actualPaymentDays?.raw3M` kullanın. B6 ile aynı sürümde düzeltin.

**✅ UYGULANDI:** `src/components/modals/CustomerHeaderAIInsight.tsx` satır 17'de `avgDays` artık `trend?.actualPaymentDays?.raw3M || 0` ile hesaplanıyor. Değişiklik `avgDays` değişkeninin kullanıldığı üç metin bloğunu da (INVOICES ve STATEMENT sekmeleri) otomatik olarak düzeltiyor, çünkü hepsi aynı değişkeni okuyor.

---

## 🟡 B2 — Temsilci prim notunun nedenleri AI metninde açıklanmıyor

**Dosya:** `src/pages/AiRepPerformancePage.tsx`, satır 192–197  
**Kaynak:** `calculateRepPrim()` → `pT`, `pY`, `pC`, `pR`, `riskCezasi`, `netHedef`.

Tooltip yalnızca toplam puan, prim ve harf notuna göre sabit cümleler üretir. Puanı oluşturan tahsilat, yaşlandırma, cari azaltma, ciro ve risk cezası bileşenleri kullanıcıya gösterilmez.

**Düzeltme:** En zayıf bileşeni ve varsa `riskCezasi` etkisini dinamik açıklayın.

**✅ UYGULANDI:** `src/pages/AiRepPerformancePage.tsx` → sabit harf notu ternary'si kaldırıldı; yeni `buildRepPrimExplanation()` yardımcı fonksiyonu, `pT`/`pY`/`pC`/`pR` bileşenlerinin her birinin ağırlıklı puan kaybını (`(100 - puan) * ağırlık/100`) hesaplayıp en çok kayba yol açan bileşeni ("en zayıf bileşen") dinamik olarak metne yazıyor. `riskCezasi > 0` ise ayrı bir cümleyle bu etki de açıklanıyor. Bileşenlerin tamamı hedefe yakınsa (kayıp < 1 puan) olumlu, genel bir cümleye düşülüyor. Ayrıca eski metindeki, `PrimSonuc` tipinde hiç var olmayan `primResult.ayBasiBakiye` alanına yapılan hatalı referans (her zaman `undefined` döndüren) da bu değişiklikle ortadan kalktı.
**Doğrulama:** Bu ortamda `node_modules` bulunmadığından tam `npx tsc --noEmit` çalıştırılamadı; TypeScript `transpileModule` ile dosyanın tamamında sözdizimi kontrolü yapıldı — **0 hata**.

---

## 🟡 B3 — CFO saha kartında hesaplanmış temsilci risk seviyesi görünmüyor

**Dosya:** `src/pages/SevkiyatTakipPage.tsx`, satır 473–515  
**Kaynak:** `getMonthlySalesRepPerformanceSync().repList[].riskLevel`.

Kart ham riskli müşteri sayısını gösterir ama `Düşük/Orta/Yüksek Risk` etiketini kullanmaz. Aynı alan başka temsilci ekranında rozet olarak zaten kullanılmaktadır.

**Düzeltme:** Kartta tutarlı renk/rozet deseniyle `repData.riskLevel` gösterin.

**✅ UYGULANDI:** `src/pages/SevkiyatTakipPage.tsx` → "RİSKLİ CARİ" satırına, `AiRepPerformancePage.tsx`'te zaten kullanılan renk/rozet deseniyle (Yüksek/Kritik Risk → kırmızı `#FB7B85`, Orta Risk → sarı `#F6BB4D`, Düşük Risk → yeşil `#3DDC9A`) birebir aynı eşiklerle bir `repData.riskLevel` rozeti eklendi. Rozet yalnızca `riskLevel` alanı doluysa render ediliyor; başka bir görsel/metin değişmedi.
**Doğrulama:** Bu ortamda `node_modules` bulunmadığından tam `npx tsc --noEmit` çalıştırılamadı; TypeScript `transpileModule` ile dosyanın tamamında sözdizimi kontrolü yapıldı — **0 hata**.

---

## 🟢 B4 — Cari hesap odak analizi ödeme trendi sinyalini kullanmıyor

**Dosya:** `src/services/customerService.ts`, `calculateCariHesapFocusAnalysisSync`

Fonksiyon yalnızca `trend.preferredMethod` bilgisini metne taşır; `trendDirection` ve hazır `riskInsight` değerlendirmede kullanılmaz. Özellikle yavaşlayan ödeme trendi için uyarı kaybolur.

**Düzeltme:** `SLOWING` durumunda `report3` içine ayrı bir aksiyon uyarısı ekleyin.

**✅ UYGULANDI:** `src/services/customerService.ts` → `calculateCariHesapFocusAnalysisSync()` içinde `report3` üretildikten sonra artık `trend.trendDirection === 'SLOWING'` kontrolü yapılıyor; bu durumda mevcut vade aşımı/sağlıklı mesajının altına, `trend.riskInsight` metnini de içeren ayrı bir "⚠️ Ödeme Hızı Yavaşlıyor" aksiyon uyarısı ekleniyor. Böylece güncel bakiye/yaşlandırma henüz sağlıklı görünse bile (60 gün üzeri gecikme yoksa) yavaşlayan ödeme trendi artık sessizce kaybolmuyor. `trendDirection`, ayrıca gözlemlenebilirlik için dönüş nesnesindeki `metrics` alanına da eklendi (`metrics.trendDirection`). `IMPROVING`/`STABLE` durumlarında davranış değişmedi — ekstra uyarı eklenmiyor, gereksiz gürültü oluşmuyor.
**Doğrulama:** Bu ortamda `node_modules`/`tsconfig.json` bulunmadığından tam `npx tsc --noEmit` çalıştırılamadı; TypeScript `transpileModule` ile dosyanın tamamında sözdizimi kontrolü yapıldı — **0 hata**.

---

## 🟢 B5 — Yapılandırılmış `metrics` nesnesi müşteri analiz gövdesinde render edilmiyor

**Dosya:** `src/components/modals/CustomerAnalysisBody.tsx`

Odak analizleri `metrics` döndürür; bileşen yalnızca serbest metin olan `report1/2/3` alanlarını render eder. Sayılar metin içinde geçtiği için bu bir veri kaybı değil, önceliği düşük bir sunum/tasarım notudur.

**Düzeltme:** Gerekli görülürse skoru, ödeme profilini ve gölge limiti küçük metrik kartlarıyla gösterin.

**✅ UYGULANDI:** `src/components/modals/CustomerAnalysisBody.tsx` → Yeni bir `FOCUS_METRIC_META` eşlemesi eklendi; bu eşleme, çağrılan odak analiz fonksiyonuna göre değişen `metrics` şeklini (sevkiyat: `reliabilityScore`/`paymentProfile`/`shadowLimit`, dashboard: `riskLevel`/`riskScore`/`balance`, cari-hesaplar: `averageTermDays`/`overdueAmount`) okunabilir etiket + biçime çeviriyor. Insight kartının üstüne, yalnızca gelen `metrics` içinde mevcut olan alanları gösteren küçük rozet kartları eklendi; risk/skor alanları için yeşil/sarı/kırmızı ton (aynı eşik mantığı: ≥70 iyi, 40-69 orta, <40 kötü — risk için ters yönde) uygulanıyor. Başka panellerde zaten gösterilen `preferredMethod` ve `trendDirection` alanları bilinçli olarak dışarıda bırakıldı (tekrar önlemek için).
**Doğrulama:** Bu ortamda `node_modules` bulunmadığından tam `npx tsc --noEmit` çalıştırılamadı; TypeScript `transpileModule` ile dosyanın tamamında sözdizimi kontrolü yapıldı — **0 hata**.

---

## 🔴 B6 — Müşteri AI balonunda aynı var olmayan alan iki noktada kullanılıyor

**Dosya:** `src/components/ai/CustomerAiBubble.tsx`, satır 65 ve 172

`paymentTrend?.averagePaymentDays || 0` iki yerde okunur. Sonuç olarak “Gerçekleşen Vade” kutusu her zaman **0 Gün** gösterir; ayrıca ödeme günü eşiğine dayalı yüksek/orta risk dalları hiç tetiklenmez ve ödeme hızı cümlesi eklenmez.

**Düzeltme:** B1 ile tutarlı biçimde iki kullanımı da `paymentTrend?.actualPaymentDays?.raw3M` ile değiştirin. Aktif olmayan `CustomerAiBubble.backup.tsx` ayrıca temizlenecekse ayrı kapsam kararı alınmalıdır.

**✅ UYGULANDI:** `src/components/ai/CustomerAiBubble.tsx` satır 65 (`realizedDays`) ve satır 172 ("Gerçekleşen Vade" kutusu) aynı `paymentTrend?.actualPaymentDays?.raw3M || 0` ifadesiyle güncellendi. Bu sayede yüksek/orta risk dalları (`isHighRisk`, `isMediumRisk`) artık gerçek ödeme günü verisiyle tetikleniyor ve "Gerçekleşen Vade" kutusu gerçek değeri gösteriyor. `CustomerAiBubble.backup.tsx` kapsam dışı bırakıldı, dokunulmadı — ayrı karar bekliyor.

---

## 🔴 B7 — Müşteri finansal sağlık raporu, şirket geneli hesaplarla üretiliyor

**Dosya:** `src/services/customerService.ts`, satır 2406–2477  
**Çağıran:** `src/services/aiTools.ts`, `getFinancialHealthReport`.

`query` ile müşteri bulunur ve sonuç müşteri adına etiketlenir; fakat satış, tahsilat, iade, yaşlandırma, net alacak, CEI ve sağlık skoru `mockSalesInvoices`, `mockCollections`, `mockCreditNotes` dizilerinin tamamıyla hesaplanır. Ödeme trendi müşteri bazlı, Pareto da seçilen müşteri listesiyle hesaplandığı için aynı çıktıda üç farklı kapsam karışır.

**Düzeltme:** Sorgu eşleştiğinde üç hareket dizisini aynı `customerId` kümesiyle filtreleyin; bütün hesapları bu filtreli kaynaklarla kurun. Eşleşme yoksa şirket geneli fallback yerine açık hata/boş sonuç döndürün.

**✅ UYGULANDI:** `src/services/customerService.ts` → `getFinancialHealthReportSync()` artık sorgu eşleştiğinde `mockSalesInvoices`/`mockCollections`/`mockCreditNotes` dizilerini eşleşen `customerId` kümesine (`targetIds`) göre filtreliyor (`scopedInvoices`, `scopedCollections`, `scopedCreditNotes`) ve toplam satış/tahsilat/net alacak, aging dağılımı, overdue oranı, sağlık skoru, CEI ve Pareto yoğunlaşması hesaplarının tamamı bu filtreli kaynaklardan üretiliyor. Vade dilimi müşteri sayıları da (`currentCustCount`/`days30CustCount`/`days60PlusCustCount`) artık `mockCustomers` yerine yalnızca `targetCustomers` üzerinden sayılıyor. Sorgu verilip hiçbir müşteri eşleşmezse fonksiyon artık sessizce şirket geneline düşmüyor; `error: true` ve boş/sıfır alanlar içeren açık bir sonuç döndürüyor.

---

## 🟠 B8 — Risk sayfası yaşlandırma tutarlarını yanlış satırlarda gösteriyor

**Dosya:** `src/pages/AiRiskAnalysisPage.tsx`, satır 346–370

Gerçek sepet eşlemesi şöyledir: `days30` = 31–60 gün, `days60` = 61–90 gün, `days90 + over90` = 91+ gün. Sayfa ise 31–60 gün satırında `days30` müşteri sayısını fakat `days60` tutarını gösterir. 61–90+ satırı da 61+ müşteri sayısına karşılık yalnızca 91+ tutarını gösterir.

**Düzeltme:** İkinci satırda `days30`; üçüncü satırda `days60 + days90Plus` kullanın veya üçüncü satırı 91+ olarak yeniden adlandırıp müşteri sayısını buna göre üretin.

**✅ UYGULANDI:** `src/pages/AiRiskAnalysisPage.tsx` içinde 31-60 gün satırı artık `finHealthData.agingDistribution.days60` yerine kendi dilimi olan `days30` tutarını gösteriyor; 61-90+ gün satırı ise yalnızca `days90Plus` yerine `days60 + days90Plus` toplamını gösteriyor (satır etiketiyle tutarlı). Veri kaynağı (`getFinancialHealthReportSync` → `agingDistribution`) zaten doğruydu; sorun yalnızca sayfadaki alan eşlemesindeydi.

---

## 🟠 B9 — Temsilci sellout tahmini şirket geneli geçmiş eğrisini kullanıyor

**Dosyalar:** `src/pages/SelloutHedefPage.tsx`, satır 76–102; `src/calculations/selloutCalculations.ts`, satır 242–331

Temsilci tam adla seçildiğinde cari ay hedefi ve gerçekleşeni temsilciye aittir; ancak `historicalRecords` bütün şirketten filtrelenmeden alınır. Kısmi isim filtresinde temsilci kartları filtrelenirken tahmin şirket geneline düşer.

**Düzeltme:** Şirket/SSM/temsilci kapsamını açık bir parametre olarak yönetin ve cari ay ile geçmiş kayıtları aynı filtreyle üretin. Kısmi filtrede tekil kapsam oluşmadan tahmini göstermeyin.

**✅ UYGULANDI:** `src/calculations/selloutCalculations.ts` → `calculateAdvancedSelloutForecast()` içinde artık kapsam (`scopeKind`: `COMPANY` / `SSM` / `REP`) açık şekilde belirlenip cari ay verisiyle (`targetEntity`) birlikte saklanıyor. `historicalRecords` (geçmiş ay kayıtları) daha önce her zaman şirket genelinden alınırken, artık `scopeKind !== 'COMPANY'` olduğunda Customer Master üzerinden (`getAllCustomersForReportingSync`) müşteri→temsilci/SSM eşlemesi kurulup aynı kapsamla filtreleniyor. Bir temsilci veya SSM eşleşmesi bulunamazsa (kısmi/tekil olmayan filtre) kapsam sessizce şirket geneline düşürülmez; `targetEntity` zaten `performance.companyTotal` olarak kalır ve `scopeKind` `COMPANY` olarak işaretlenir, böylece filtresiz (önceki) davranış yalnızca gerçekten şirket geneli görüntülenirken uygulanır.

---

## 🟠 B10 — CEI aracının `query` parametresi işlevsiz

**Dosya:** `src/services/customerService.ts`, satır 2515–2541  
**Çağıran:** `src/services/aiTools.ts`, `getCollectionEffectivenessIndex`.

Fonksiyon `query` parametresini alır ama hiç kullanmaz; her çağrıda şirket geneli özet ve grafik verisiyle CEI hesaplar. Müşteri adıyla çağrıldığında geçerli fakat yanlış bağlamlı bir sayı döner.

**Düzeltme:** Parametreyi kaldırıp aracı açıkça şirket geneli yapın veya B7 ile aynı kapsam filtrelemesini uygulayın.

**✅ UYGULANDI:** `src/services/customerService.ts` → `getCollectionEffectivenessIndexSync()` artık B7 ile aynı desenle çalışıyor: `query` doluysa `searchCustomersSync` ile eşleşen müşteriler bulunur, satış/tahsilat/alacak dekontu dizileri eşleşen `customerId` kümesine göre filtrelenir (`scopedInvoices`/`scopedCollections`/`scopedCreditNotes`) ve CEI ile tahsilat yöntemi kırılımı (`paymentMethodBreakdown`) bu filtreli kaynaklardan hesaplanır. Sorgu verilip eşleşme bulunamazsa artık şirket geneline sessiz fallback yerine `error: true` içeren açık sonuç döner. Sorgu boşsa davranış öncekiyle aynı (şirket geneli `getDashboardChartDataSync` kırılımı).

---

## 🟡 B11 — “Gelecek Vade Dağılımı” geçmiş ayları seçebiliyor

**Dosya:** `src/components/modals/ChequeSenetBody.tsx`, satır 93–111 ve 381–391

`upcomingMonthBreakdown`, PORTFÖY durumundaki tüm vadeleri ay bazında toplar ve en erken üç ayı seçer; `dueDate >= bugün` filtresi yoktur. Gecikmiş evraklar “Gelecek Vade Dağılımı” şeridini doldurabilir.

**Düzeltme:** Gelecek şerit için bugünden önceki vadeleri filtreleyin; gecikmişler için ayrı bir dağılım gösterin.

**✅ UYGULANDI:** `src/components/modals/ChequeSenetBody.tsx` → `upcomingMonthBreakdown` hesaplamasına, gruplamadan önce `date < todayStart` (bugünün başlangıcı) kontrolü eklendi; bu sayede gecikmiş vadeler artık "Gelecek Vade Dağılımı" şeridine hiç girmiyor. Aynı dosyada yeni bir `overdueBreakdown` (`count`, `sum`) hesaplaması eklendi ve bu, şeridin hemen üstünde ayrı, kırmızı vurgulu bir "Gecikmiş Vadeler" özeti olarak render ediliyor (yalnızca `count > 0` iken görünür). Böylece gecikmiş evraklar sessizce kaybolmuyor, ayrı ve belirgin şekilde işaretleniyor. Kullanılan uyarı ikonu, dosyada zaten tanımlı olan `#i-alert` sembolüne bağlandı (yeni bir sembol eklenmedi).\n**Doğrulama:** Bu ortamda `node_modules` bulunmadığından tam `npx tsc --noEmit` çalıştırılamadı; TypeScript `transpileModule` ile dosyanın tamamında sözdizimi kontrolü yapıldı — **0 hata**.

---

## 🔴 B12 — LLM üretimli JavaScript sandbox olmadan çalıştırılıyor

**Tanım:** `src/services/aiTools.ts`, satır 611–620  
**Çalıştırma:** `src/services/customerService.ts`, satır 2791–2837  
**İkinci yol:** `advancedMapAndImportExcel`, `src/services/aiTools.ts`, satır 1753–1824.

`executeDynamicAnalyticsQuery` modeli `jsFunctionBody` üretmeye davet eder; metin doğrudan `new Function(...)` ile çalıştırılır. Araç her sorgunun çekirdek araç setindedir. `"use strict"` sandbox değildir; üretilen kod global ortama erişebilir ve fonksiyona verilen finansal veri kopyalarını beklenmeyen biçimde modele döndürebilir. Excel gelişmiş eşleme yolu da model kodunu çalıştırıp kalıcı yazma yapar.

**Düzeltme:** LLM tool yüzeyinden dinamik kod çalıştırmayı kaldırın. İzinli sorgu/filtre DSL'i veya önceden tanımlı analizler kullanın; zorunlu bir dönüştürme varsa izinli AST yorumlayıcısı ve ayrı, ağsız sandbox uygulayın.

**✅ UYGULANDI:** `executeDynamicAnalyticsQuerySync` (`customerService.ts`) içindeki `new Function(...)` çağrısı tamamen kaldırıldı; fonksiyon artık kod çalıştırmadan güvenlik nedeniyle devre dışı bırakıldığını bildiren bir hata sonucu döner. Tool tanımı `aiTools.ts`'deki LLM araç listesinden ve çekirdek araç setinden (`coreToolNames`) çıkarıldı; model artık bu aracı göremez veya seçemez. Dispatcher'daki `case` ifadesi, no-op fonksiyonu çağırdığı için zararsızdır ve geriye dönük uyumluluk amacıyla korunmuştur.

---

## 🔴 B13 — Çevrimdışı fallback müşteri master aktarımında yönetici kontrolünü atlıyor

**Dosya:** `src/services/aiService.ts`, satır 778–810

API anahtarı yoksa veya model çağrıları başarısızsa `handleOfflineFallback()` çalışır. Mesajda `cari`, `master`, `ekle` veya `excel` geçip önbellekte Excel varsa fallback doğrudan `archiveCustomers(parsed.records)` çağırır. Bu dalda `isAdminAuthenticated()` ve kullanıcı onayı yoktur; normal `executeAiTool` aktarım yolunda ise yönetici kontrolü vardır.

**Düzeltme:** Fallback doğrudan arşiv yazmamalıdır. Aktarım yalnızca yetki denetimli araç yolundan ve kullanıcı onayından sonra yapılmalıdır.

**✅ UYGULANDI:** `aiService.ts`'deki çevrimdışı fallback bloğu artık `archiveCustomers(...)` çağrısından önce `isAdminAuthenticated()` kontrolü yapıyor (normal `executeAiTool` yolundaki `MUTATING_TOOLS` denetimiyle aynı fonksiyon). Yönetici oturumu açık değilse yazma işlemi hiç yapılmaz; kullanıcıya Admin girişi gerektiği bildirilir. Not: Bu, ikinci düzey P2 paketindeki B14 (işlem bazlı kullanıcı onayı ve sıralı uygulama) ile aynı kapsam değildir — B13 yalnızca yetkisiz erişimi kapatır, B14 ayrıca ele alınacaktır.

---

## 🟠 B14 — AI mutasyonları açık kullanıcı onayı olmadan ve paralel uygulanıyor

**Araç seçimi:** `src/services/aiTools.ts`, satır 815–881  
**Yürütme:** `src/services/aiService.ts`, satır 257–285.

Geniş anahtar kelimeler (`ekle`, `yükle`, `sil`, `düzelt`, `aktar` vb.) yazma/silme araçlarını modele açar. Yönetici oturumu açık olduğunda modelin function call'ları taslak/onay olmadan `Promise.all` ile paralel çalıştırılır. Yetki kontrolü vardır fakat işlem bazlı kullanıcı rızası ve yazma sırası yoktur.

**Düzeltme:** `plan → etkilenecek kayıt özeti → açık kullanıcı onayı → sıralı uygulama` akışını kullanın. Okumaları paralel, yazmaları sıralı çalıştırın.

**✅ UYGULANDI:**
- `src/services/aiTools.ts` → Daha önce yalnızca `executeAiTool()` içinde yerel bir sabit olan yazma/silme araç listesi, modül seviyesinde `export const MUTATING_TOOLS` olarak dışa açıldı; `aiService.ts` artık aynı tek listeyi okuyor (iki ayrı kopyanın birbirinden sapması riski ortadan kalktı). Ayrıca her mutasyon aracı için etkilenecek kaydı özetleyen (müşteri adı/ID, tutar, tarih vb.) yeni bir `describeMutatingToolCall()` yardımcı fonksiyonu eklendi.
- `src/services/aiService.ts` → `sendAiMessage()` içindeki araç yürütme döngüsü, gelen function call'ları her turda okuma ve yazma olarak ikiye ayıracak şekilde yeniden yazıldı:
  - **Okumalar** (rapor/sorgu araçları) öncekiyle aynı şekilde `Promise.all` ile **paralel** çalıştırılır.
  - **Yazmalar** (`MUTATING_TOOLS`) artık bu döngüde **hiç çalıştırılmaz**. Bunun yerine her biri, `describeMutatingToolCall()` ile üretilen kayıt özetiyle birlikte yeni `pendingMutations` listesine eklenir; modele "bu işlem henüz uygulanmadı, kullanıcı onayı gerekiyor" içerikli bir `functionResponse` döndürülür ve döngü, otomatik tekrar denemeyi önlemek için o turda durdurulur (`break`).
  - `sendAiMessage()`'ın dönüş değeri artık `{ text, toolCalls, pendingMutations }` şeklinde; `pendingMutations` doluysa arayüz katmanı, kullanıcıya her işlemin özetini gösterip açık onay almadan hiçbir şey uygulanmadığını bilir.
  - Yeni dışa açık `executeConfirmedMutations(confirmedMutations)` fonksiyonu eklendi. Bu fonksiyon, yalnızca kullanıcı onayından SONRA çağrılmalıdır ve verilen mutasyonları `Promise.all` ile değil, `for...of` içinde `await` ile **tek tek, sıralı** olarak `executeAiTool()` üzerinden uygular — böylece art arda gelen sil/ekle veya bir virmanın kaynak/hedef adımları beklenmedik sırayla çakışmaz. Gerçek yürütme yine `executeAiTool()` üzerinden geçtiği için mevcut `isAdminAuthenticated()` yetki denetimi (B13 ile aynı gate) korunur; onay akışı buna **ek** bir katmandır, yerine geçmez.
- **Kapsam notu:** Bu pakette teslim edilen dosyalarda (`aiService.ts`, `aiTools.ts`) sohbet arayüzünü çizen bileşen (`AiChatPanel.tsx`) bulunmuyor; dolayısıyla `pendingMutations` listesini kullanıcıya gösterip "Onayla" butonuna basıldığında `executeConfirmedMutations()`'ı çağıracak UI teli bu görevin kapsamı dışında bırakıldı. Servis katmanı artık onay olmadan hiçbir yazma yapmayacak şekilde güvenli tarafta; UI entegrasyonu ayrı bir görev olarak işaretlenmeli.
- **Doğrulama:** Bu ortamda proje `node_modules`/`tsconfig.json` bulunmadığından (yalnızca ilgili kaynak dosyaları teslim edildi) tam `npx tsc --noEmit` derlemesi bu oturumda çalıştırılamadı. Bunun yerine TypeScript derleyicisinin `transpileModule` API'siyle her iki dosyada da salt sözdizimi/ayrıştırma kontrolü yapıldı: **0 tanı hatası** (aiService.ts ve aiTools.ts). Tip düzeyinde tam doğrulama, dosyalar tam depoya geri konduğunda `npx tsc --noEmit` ile yapılmalıdır.

---

## 🟡 B15 — Çevrimdışı ekstre yanıtında tarih filtresi yanlış uygulanıyor

**Dosya:** `src/services/aiService.ts`, satır 427–492  
**Araç dönüşümü:** `src/services/aiTools.ts`, satır 1125–1169.

Araç, son işlemlerin tarihini kullanıcıya yönelik biçime (`29.07.2026`) dönüştürür. Fallback ise bu dizgeyi ISO aralığıyla (`2026-07-01`) doğrudan karşılaştırır; karşılaştırma kronolojik değildir. Ayrıca yanıt “Filtrelenen Dönem” derken satış ve tahsilat özetini tüm zamanlar için gösterir.

**Düzeltme:** Araç çıktısında `rawDate` alanını koruyun; filtreyi bu alanda uygulayın. En doğrusu, aralığı araç argümanı yapıp satırları ve özetleri aynı sorguda hesaplamaktır.

**✅ UYGULANDI (kısmen — birinci öneri uygulandı, ikinci "en doğrusu" öneri kapsam dışı bırakıldı):**
- `src/services/aiTools.ts` → `getCustomerStatement` case'inde, `recentTransactions` map'ine
  görüntüleme amaçlı formatlanmış `date` alanının yanına, karşılaştırma için ISO
  (`YYYY-MM-DD`) `rawDate` alanı eklendi. Kaynak zaten `safeIsoDate()` çıktısı olduğundan
  ek bir parse/dönüşüm gerekmedi, sadece formatlanmadan önce saklandı.
- `src/services/aiService.ts` → `handleOfflineFallback` içindeki tarih filtresi artık
  formatlanmış `t.date` yerine `t.rawDate` üzerinden, iki ISO string'i doğrudan
  kıyaslayarak çalışıyor (önceki hâliyle "29 Tem 2026" gibi bir metin "2026-07-01" ile
  lekografik olarak kıyaslanıyordu — kronolojik açıdan anlamsızdı).
- Aynı fonksiyondaki "Filtrelenen Dönem" etiketi, altındaki özet göstergelerin (bakiye,
  toplam satış/tahsilat, vade) filtrelenmediğini açıkça belirtecek şekilde yeniden
  yazıldı ("Not: Aşağıdaki işlem tablosu ... filtrelenmiştir. Özet göstergeler ...
  tüm zamanları kapsar.") — böylece kullanıcıya yanıltıcı bir "filtrelendi" izlenimi
  verilmiyor.
- **Kapsam dışı bırakılan kısım:** Raporun "en doğrusu" dediği çözüm — tarih aralığını
  `getCustomerStatement` aracının kendisine argüman yapıp özet göstergeleri de aynı
  aralıkta hesaplamak — bu görevde uygulanmadı. Bu, tool şemasını (`aiTools.ts`,
  `aiContext.ts`) ve servis katmanını (`getCustomerStatementSync`) etkileyen daha büyük,
  ayrı bir mimari değişiklik; görev kapsamını genişletmemek için ayrı bir görev olarak
  bırakıldı.
- **Doğrulama:** `npx tsc --noEmit` → değişiklik öncesi/sonrası **100 → 100 hata**
  (hepsi önceden var olan, bu dosyalarla ilgisiz — örn. `ImportMeta.env` tip tanımı,
  CSS side-effect import uyarıları). `npx oxlint` → 127 uyarı, 0 hata, değiştirilen
  satırlarda yeni uyarı yok. `npx vitest run` → 16 dosya, 82 test, hepsi geçti
  (`aiTools.test.ts` dahil).

---

## Doğrulanan alanlar ve sınırlar

- `AiChatPanel.tsx` kalan bölümü, `CariPage.tsx`, `CustomerStatementBody.tsx`, çek/senet CRUD şeması; incelenen canlı alan kullanımlarında yeni bir dönüş-şeması uyuşmazlığı göstermedi.
- `getMonthlyComparisonSync`, `getMonthlyRiskAndRevenueReportSync`, `getTopCustomersBySalesVolumeSync`, `getCustomerChequesSync`, `getInvoiceControlReportSync`, `getOverdueCustomersListSync`, `calculateCustomerDebtToCollectionRiskSync`, `getDeepExecutiveAnalyticsOverviewSync` ve `calculateRepHoverAnalyticsSync` için incelenen çağıranlarda yeni alan adı uyuşmazlığı bulunmadı.
- `calculateSelloutProbability`, `getSalesFkns` ve `getProductPenetration` araçları ayrı `case` olmadan dispatcher'ın varsayılan `execute` dalından çalışır; bu üçü için kopuk dispatcher bulgusu yoktur.
- Tarama statik ve salt-okunurdur. Parser/yükleme/arşiv katmanının tamamı, tüm test senaryoları ve gerçek veriyle uçtan uca davranış testi bu belgenin kapsamı dışındadır.

## Değişiklik günlüğü

### Paket 1 — P0 (tamamlandı)

- **B12:** `src/services/customerService.ts` → `executeDynamicAnalyticsQuerySync` içindeki `new Function(...)` kaldırıldı, fonksiyon no-op/güvenli hata döndürür hale getirildi. `src/services/aiTools.ts` → tool tanımı ve `coreToolNames` girişleri kaldırıldı.
- **B13:** `src/services/aiService.ts` → `isAdminAuthenticated()` import edildi; çevrimdışı fallback aktarım bloğu artık yönetici kontrolü yapmadan `archiveCustomers(...)` çağırmıyor.
- **Not:** Değişiklikler statik olarak uygulandı ve elle doğrulandı. Bu ortamda ağ erişimi kapalı olduğu için `npm install` / `npx tsc --noEmit` / test paketi bu oturumda çalıştırılamadı — düzeltmeler yerel geliştirme ortamında derleme ve test adımıyla doğrulanmalıdır.

### Paket 2 — P1 (B1, B6, B7 tamamlandı)

- **B1:** `src/components/modals/CustomerHeaderAIInsight.tsx` → satır 17'deki `trend?.averagePaymentDays` → `trend?.actualPaymentDays?.raw3M` olarak değiştirildi.
- **B6:** `src/components/ai/CustomerAiBubble.tsx` → satır 65 ve 172'deki `paymentTrend?.averagePaymentDays` kullanımlarının ikisi de `paymentTrend?.actualPaymentDays?.raw3M` olarak değiştirildi. `CustomerAiBubble.backup.tsx` bilinçli olarak kapsam dışı bırakıldı (aktif kullanılmıyor, ayrı karar bekliyor).
- **Doğrulama (B1, B6):** Bu oturumda ağ erişimi açık olduğu için `npm install` çalıştırıldı ve `npx tsc --noEmit` ile gerçek derleme karşılaştırması yapıldı: düzeltme öncesi 103 tip hatası → düzeltme sonrası 100 tip hatası (tam olarak 3 hata azaldı, yeni hata eklenmedi). `node_modules` paylaşılan zip'ten çıkarıldı.
- **B7:** `src/services/customerService.ts` → `getFinancialHealthReportSync()` sorgu eşleştiğinde satış/tahsilat/alacak dekontu dizilerini eşleşen `customerId` kümesiyle filtreleyecek şekilde yeniden yazıldı (`scopedInvoices`/`scopedCollections`/`scopedCreditNotes`); tüm türetilmiş metrikler (net alacak, aging, overdue oranı, sağlık skoru, CEI, Pareto, vade dilimi müşteri sayıları) bu filtreli kaynaklardan hesaplanıyor. Sorgu eşleşmezse artık şirket geneline sessiz fallback yerine `error: true` içeren açık sonuç dönüyor.
- **Doğrulama (B7):** `npx tsc --noEmit` yeniden çalıştırıldı: 100 tip hatası (B1/B6 sonrası ile aynı sayı — yeni hata eklenmedi). Değişikliğe yakın satırlarda görülen `colsByCust`/`credsByCust` "possibly null" uyarıları, `buildMapsIfNeeded()!` non-null assertion deseninin dosyadaki diğer 6 çağrı noktasında da (satır 628, 895, 1319, 2662, 3266, 3570) zaten var olan, bu değişiklikten bağımsız pre-existing bir TS kısıtlamasıdır.

### Paket 3 — P2 devam ediyor (B8, B10 tamamlandı)

- **B8:** `src/pages/AiRiskAnalysisPage.tsx` → Vade dilimi tablosunda 31-60 gün satırının tutar hücresi `agingDistribution.days60` → `agingDistribution.days30` olarak değiştirildi; 61-90+ gün satırının tutar hücresi `agingDistribution.days90Plus` → `agingDistribution.days60 + agingDistribution.days90Plus` olarak değiştirildi. Müşteri sayısı hücreleri (`days30CustCount`, `days60PlusCustCount`) zaten doğruydu, değiştirilmedi.
- **B10:** `src/services/customerService.ts` → `getCollectionEffectivenessIndexSync()` yeniden yazıldı. Artık `query` parametresi B7'deki `getFinancialHealthReportSync` ile aynı desenle kullanılıyor: sorgu eşleşen müşteri(ler) varsa satış/tahsilat/alacak dekontu dizileri `customerId` kümesine göre filtrelenip CEI, tutarlar ve tahsilat yöntemi kırılımı bu filtreli kaynaklardan hesaplanıyor; eşleşme yoksa `error: true` içeren açık sonuç dönüyor; sorgu boşsa (şirket geneli çağrı) davranış eskisiyle aynı.
- **Doğrulama (B8, B10):** `npx tsc --noEmit` çalıştırıldı: 100 tip hatası (önceki paket sonrasıyla aynı sayı — yeni hata eklenmedi).
- **Not:** B9, B14 ve B15 bu pakette henüz ele alınmadı; sırada.

### Paket 4 — P2 devam ediyor (B9 tamamlandı)

- **B9:** `src/calculations/selloutCalculations.ts` → `calculateAdvancedSelloutForecast()` fonksiyonuna açık bir `scopeKind` (`COMPANY`/`SSM`/`REP`) belirleme adımı eklendi; `historicalRecords` artık `targetEntity` ile aynı kapsamda filtreleniyor (Customer Master eşlemesiyle). Böylece bir temsilci veya SSM seçildiğinde ay içi mevsimsellik eğrisi (`historicalSeasonalityRatio`, `lateMonthSpikeRatio`) yalnızca o temsilcinin/SSM'nin geçmiş verisinden hesaplanıyor; önceden şirket geneline düşen `weightedForecast` artık doğru kapsamda üretiliyor. `src/pages/SelloutHedefPage.tsx` içindeki çağıran kod (satır 76–102) değişmedi; kapsam mantığı tamamen hesaplama fonksiyonunun içine taşındı, arayüz sözleşmesi (imza, dönüş tipi) korundu.
- **Doğrulama (B9):** `npx tsc --noEmit -p tsconfig.json` çalıştırıldı; değişikliğe özgü yeni bir tip hatası oluşmadı (yalnızca ortamda önceden var olan, `vitest` tip tanımlarının kurulu olmamasından kaynaklanan test-dosyası uyarısı görüldü, bu değişiklikten bağımsız).

### Paket 5 — P2 tamamlandı (B14 tamamlandı)

- **B14:** `src/services/aiTools.ts` → yazma/silme araç listesi `export const MUTATING_TOOLS` olarak dışa açıldı; kayıt özeti üreten `describeMutatingToolCall()` eklendi. `src/services/aiService.ts` → `sendAiMessage()`'daki araç döngüsü okuma/yazma olarak ikiye ayrıldı: okumalar öncekiyle aynı şekilde paralel çalışır, yazmalar hiç çalıştırılmadan `pendingMutations` listesine (kayıt özetiyle birlikte) eklenip modele "onay bekliyor" yanıtı döndürülür ve döngü durur. Yeni `executeConfirmedMutations()` fonksiyonu, yalnızca kullanıcı onayından sonra çağrılacak şekilde, mutasyonları paralel değil tek tek (sıralı) uygular. `isAdminAuthenticated()` yetki denetimi korunur; onay akışı buna ek bir katmandır.
- **Kapsam notu (B14):** Onay listesini kullanıcıya gösterip "Onayla" ile `executeConfirmedMutations()`'ı tetikleyecek sohbet arayüzü bileşeni (`AiChatPanel.tsx`) bu paketin kapsamındaki dosyalar arasında değildi; servis katmanı güvenli tarafta bırakıldı, UI teli ayrı görev olarak açık.
- **Doğrulama (B14):** Bu ortamda proje `node_modules`/`tsconfig.json` içermediğinden tam `npx tsc --noEmit` çalıştırılamadı; TypeScript `transpileModule` ile her iki dosyada sözdizimi kontrolü yapıldı — **0 hata**. Tam tip doğrulaması dosyalar depoya geri konduğunda yapılmalıdır.

### Paket 6 — P3 devam ediyor (B4 tamamlandı)

- **B4:** `src/services/customerService.ts` → `calculateCariHesapFocusAnalysisSync()` içinde `report3` üretildikten sonra `trend.trendDirection === 'SLOWING'` kontrolü eklendi; bu durumda `trend.riskInsight` metnini içeren ayrı bir "⚠️ Ödeme Hızı Yavaşlıyor" aksiyon uyarısı `report3`'ün altına ekleniyor. Böylece güncel bakiye/yaşlandırma sağlıklı görünse bile yavaşlayan ödeme trendi artık kaybolmuyor. `trendDirection`, gözlemlenebilirlik için dönüş nesnesinin `metrics` alanına da eklendi. `IMPROVING`/`STABLE` durumlarında çıktı değişmedi.
- **Kapsam notu:** P3'teki diğer bulgular (**B2** → `AiRepPerformancePage.tsx`, **B3** → `SevkiyatTakipPage.tsx`, **B5** → `CustomerAnalysisBody.tsx`, **B11** → `ChequeSenetBody.tsx`) bu paketteki dosyalar arasında **bulunmuyor**; bu oturumda yalnızca elde mevcut olan `customerService.ts` dosyasını etkileyen B4 uygulanabildi. Diğerleri, ilgili dosyalar sağlandığında ayrı paketler olarak ele alınmalı.
- **Doğrulama (B4):** `node_modules`/`tsconfig.json` bu ortamda yok; TypeScript `transpileModule` ile `customerService.ts` dosyasının tamamında sözdizimi kontrolü yapıldı — **0 hata**.

### Paket 7 — P3 devam ediyor (B11 tamamlandı)

- **B11:** `src/components/modals/ChequeSenetBody.tsx` → `upcomingMonthBreakdown` hesaplamasına bugünün başlangıcından (`todayStart`) önceki vadeleri dışlayan bir filtre eklendi; "Gelecek Vade Dağılımı" şeridi artık yalnızca gerçekten gelecekteki PORTFOY vadelerini gösteriyor. Gecikmiş PORTFOY vadeler için ayrı bir `overdueBreakdown` (adet + tutar) hesaplaması eklendi ve şeridin üstünde kırmızı vurgulu, yalnızca gecikmiş kayıt varsa görünen bir "Gecikmiş Vadeler" özeti olarak render edildi.
- **Kapsam notu:** P3'teki kalan bulgular (**B2** → `AiRepPerformancePage.tsx`, **B3** → `SevkiyatTakipPage.tsx`, **B5** → `CustomerAnalysisBody.tsx`) bu paket kapsamında ele alınmadı; sırada.
- **Doğrulama (B11):** `node_modules`/`tsconfig.json` bu ortamda yok (yalnızca değişen dosya elde mevcut); TypeScript `transpileModule` ile dosyanın tamamında sözdizimi kontrolü yapıldı — **0 hata**. Tam tip/derleme doğrulaması ve ilgili birim testleri, dosya tam depoya geri konduğunda `npx tsc --noEmit` ve `npx vitest run` ile yapılmalıdır.

### Paket 8 — P3 devam ediyor (B3 tamamlandı)

- **B3:** `src/pages/SevkiyatTakipPage.tsx` → CFO saha kartındaki "RİSKLİ CARİ" satırına, `AiRepPerformancePage.tsx`'teki mevcut rozet deseniyle (aynı renk eşikleri: Yüksek/Kritik Risk kırmızı, Orta Risk sarı, Düşük Risk yeşil) `repData.riskLevel` etiketi eklendi. Ham riskli müşteri sayısının yanına, hesaplanmış risk seviyesi artık görünür durumda.
- **Kapsam notu:** P3'teki kalan bulgular (**B2** → `AiRepPerformancePage.tsx`, **B5** → `CustomerAnalysisBody.tsx`) bu paket kapsamında ele alınmadı; sırada.
- **Doğrulama (B3):** `node_modules`/`tsconfig.json` bu ortamda yok; TypeScript `transpileModule` ile dosyanın tamamında sözdizimi kontrolü yapıldı — **0 hata**. Tam tip/derleme doğrulaması, dosya tam depoya geri konduğunda `npx tsc --noEmit` ile yapılmalıdır.

### Paket 9 — P3 devam ediyor (B2 tamamlandı)

- **B2:** `src/pages/AiRepPerformancePage.tsx` → Prim tooltip'indeki sabit harf-notu ternary'si kaldırıldı; yeni `buildRepPrimExplanation()` yardımcı fonksiyonu `pT`/`pY`/`pC`/`pR` bileşenlerinin ağırlıklı puan kaybını hesaplayıp en zayıf bileşeni dinamik olarak açıklıyor, `riskCezasi > 0` olduğunda ayrı bir cümleyle bu etkiyi de belirtiyor. Yan etki: metinde hiç var olmayan `primResult.ayBasiBakiye` alanına yapılan hatalı referans da (her zaman `undefined` dönen) bu değişiklikle temizlendi.
- **Kapsam notu:** P3'teki kalan bulgu (**B5** → `CustomerAnalysisBody.tsx`) bu paket kapsamında ele alınmadı; sırada.
- **Doğrulama (B2):** `node_modules`/`tsconfig.json` bu ortamda yok; TypeScript `transpileModule` ile dosyanın tamamında sözdizimi kontrolü yapıldı — **0 hata**. Tam tip/derleme doğrulaması, dosya tam depoya geri konduğunda `npx tsc --noEmit` ile yapılmalıdır.

### Paket 10 — P3 tamamlandı (B5 tamamlandı) — Tarama #2 kapandı

- **B5:** `src/components/modals/CustomerAnalysisBody.tsx` → Yeni `FOCUS_METRIC_META` eşlemesi eklendi; üç odak analiz fonksiyonunun (`calculateSevkiyatAnalysisSync`, `calculateDashboardFocusAnalysisSync`, `calculateCariHesapFocusAnalysisSync`) farklı `metrics` şekillerinin tamamını okunabilir etiket + biçimle küçük rozet kartlarına çeviriyor; risk/skor alanları için yeşil/sarı/kırmızı ton uygulanıyor. Insight kartının üstüne, yalnızca gelen `metrics`'te mevcut olan alanları gösteren bir rozet satırı eklendi. Başka panellerde zaten gösterilen `preferredMethod`/`trendDirection` bilinçli olarak dışarıda bırakıldı.
- **Kapsam notu:** Bu paketle birlikte P3'teki tüm bulgular (B2, B3, B4, B5, B11) ve dolayısıyla raporun **15 bulgusunun tamamı** tamamlandı.
- **Doğrulama (B5):** `node_modules`/`tsconfig.json` bu ortamda yok; TypeScript `transpileModule` ile dosyanın tamamında sözdizimi kontrolü yapıldı — **0 hata**. Tam tip/derleme doğrulaması ve ilgili birim/entegrasyon testleri, dosyalar tam depoya geri konduğunda `npx tsc --noEmit` ve `npx vitest run` ile yapılmalıdır — bu, statik/salt-okunur ortamda uygulanan tüm P3 paketleri (6-10) için geçerli genel bir açık maddedir.

## Önerilen uygulama sırası

1. ✅ **B12 ve B13 (tamamlandı):** Dinamik kod yürütmesi ve yetkisiz fallback aktarımı devre dışı bırakıldı.
2. ✅ **B1 ve B6 (tamamlandı):** Üç canlı `averagePaymentDays` kullanımı tek hedef alanla (`actualPaymentDays.raw3M`) düzeltildi. Not: 0 gün/risk dalı regresyon testi eklenmesi hâlâ öneri olarak açık.
3. ✅ **B7 (tamamlandı):** Müşteri finansal sağlık/CEI raporu artık sorgu eşleştiğinde tek `customerId` kümesiyle tutarlı filtreleniyor.
4. ✅ **B8 (tamamlandı):** Risk sayfası yaşlandırma tablosundaki satır/tutar uyuşmazlığı düzeltildi.
5. ✅ **B10 (tamamlandı):** CEI aracı artık `query` parametresini kullanarak doğru kapsamda hesap yapıyor.
6. ✅ **B9 (tamamlandı):** Temsilci/SSM sellout tahmini artık geçmiş mevsimsellik eğrisini de aynı kapsamda (şirket geneli değil) hesaplıyor.
7. ✅ **B14 (tamamlandı):** Yazma/silme araçları artık ayrı onay listesine düşüyor (`pendingMutations`) ve yalnızca `executeConfirmedMutations()` ile, kullanıcı onayından sonra, sıralı uygulanıyor. UI teli (onay ekranı) ayrı görev olarak açık.
8. ✅ **B15 (tamamlandı, kısmen):** Çevrimdışı ekstre tarih filtresi artık `rawDate` (ISO) üzerinden kronolojik kıyaslanıyor; "Filtrelenen Dönem" etiketi yanıltıcı olmayacak şekilde yeniden yazıldı. Aralığı `getCustomerStatement` aracının kendisine argüman yapan daha büyük mimari değişiklik kapsam dışı bırakıldı.
9. ✅ **B4 (tamamlandı):** Cari hesap odak analizi artık `trendDirection`/`riskInsight` sinyalini kullanıyor; SLOWING durumunda ayrı aksiyon uyarısı ekleniyor.
10. ✅ **B11 (tamamlandı):** "Gelecek Vade Dağılımı" şeridi artık yalnızca bugünden sonraki vadeleri gösteriyor; gecikmiş PORTFOY vadeler ayrı, belirgin bir "Gecikmiş Vadeler" özetinde toplanıyor.
11. ✅ **B3 (tamamlandı):** CFO saha kartındaki "RİSKLİ CARİ" satırına, temsilci ekranındaki mevcut rozet deseniyle tutarlı bir `riskLevel` rozeti eklendi.
12. ✅ **B2 (tamamlandı):** Temsilci prim tooltip'i artık en zayıf bileşeni ve varsa risk cezası etkisini dinamik olarak açıklıyor.
13. ✅ **B5 (tamamlandı):** Odak analizlerinin `metrics` nesnesi artık küçük, renkli rozet kartlarıyla görünür — hangi sayfadan açıldığına göre değişen üç farklı `metrics` şekli de kapsanıyor.
14. **Sonraki adım:** Statik/salt-okunur ortamda uygulanan tüm paketler (özellikle `node_modules` olmadan doğrulanan Paket 6-10), kod tam depoya geri konduğunda `npx tsc --noEmit`, `npx oxlint` ve `npx vitest run` ile eksiksiz derleme/test doğrulamasından geçirilmelidir.
