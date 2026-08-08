# Paket 00 — Legacy AI bağımlılık ve deprecation haritası

**Durum:** AI-00 karakterizasyon çıktısı. Bu belge mevcut davranışı kaydeder; hiçbir satırı yeni resmî hesap veya güvenlik kuralı ilan etmez.
**İnceleme tarihi:** 2026-08-05

## Mevcut çağrı zinciri

```text
Kullanıcı mesajı / ek
  -> aiIntentClassifier.classifyAiQueryIntent
  -> aiTools.getRelevantToolsForQuery
  -> aiToolDeclarations (Gemini function declaration)
  -> aiService.sendAiMessage (tarayıcı SDK veya fallback/proxy yolu)
  -> aiTools.executeAiTool
       -> read registry -> dynamic agent registry -> Excel registry -> mutation registry
       -> tanım üzerindeki legacy execute fallback
  -> customerService / customerQueries / customerAnalytics / IndexedDB
  -> araç sonucu -> AI metni / offline fallback / sohbet ve rapor bileşeni
```

`executeAiTool` mevcut tek yürütme noktasıdır. Bu sınır, okuma, ajan, Excel ve mutation registry sırasını koruma fikri bakımından karakterizasyon olarak değerlidir; hedefte yetki, RLS, preview/onay ve server-owned tool firewall Paket 14'te yeniden kurulur.

## Araç kataloğu snapshot'ı

2026-08-05'te `aiToolDeclarations.ts` içinde 47 model declaration bulunmaktadır. Model declaration'ı ile handler'ın aynı mekanizmada doğrulanmadığı durumlar sonraki güvenlik paketi için risk kaydıdır.

| Grup | Mevcut declaration / handler alanı | Hedef durumu |
|---|---|---|
| Keşif | `discoverMoreTools` | REVISE — Paket 14 server katalog allowlist'i |
| Şirket/finans okuma | `getGlobalFinancialSummary`, `getCurrentStatus`, `queryTransactions`, `getGlobalHighestTransactions`, `getMonthlyRiskAndRevenueReport`, `getCollectionBreakdown`, `getCollectionEffectivenessIndex`, `getPaymentMethodsBreakdown`, `getAgingBreakdown`, `getOverdueCustomersList`, `getFinancialHealthReport`, `getParetoConcentrationAnalysis`, `getDeepExecutiveAnalyticsOverview` | REVISE — Paket 12A–12D + 13/14 yayımlanmış metrik sonucu |
| Müşteri okuma | `searchCustomers`, `getCustomerDetails`, `getCustomerStatement`, `getCustomerCheques`, `getCustomerPaymentTrend`, `calculateCustomerDebtToCollectionRisk` | REVISE — Paket 02/08/10/12A + 14 |
| Temsilci/Sellout/FKNS okuma | `getSalesRepSummary`, `getMonthlyComparisonReport`, `getTopCustomersBySalesVolume`, `calculateSelloutProbability`, `getSalesFkns`, `getProductPenetration` | REVISE — Paket 04/05/12B/13/14 |
| Operasyon okuma | `getInvoiceControlReport`, `getShipmentTrackingReport` | REVISE — Paket 07A/07B/10A/14 |
| Mutation | `addManualInvoice`, `addManualCollection`, `addVirmanTransfer`, `deleteTransaction`, `bulkDeleteTransactions`, `addManualCheque`, `updateManualCheque`, `deleteManualCheque`, `purgeTestImportRecords` | REJECT as current mechanism; Paket 08–11/14 preview→exact confirmation→audit zinciri |
| Excel / yükleme | `reconcileChequesWithExcel`, `runExcelVerificationTest`, `importCustomerMaster`, `processCustomerMasterImport`, `mapAndImportExcel`, `advancedMapAndImportExcel`, `readUploadedExcelData` | REVISE — Paket 01+ sürümlü import, server yetkisi ve staging |
| Dinamik ajan | `defineSubagent`, `invokeSubagent` | REJECT as execution authority; Paket 14'te yalnız yetkili server iş akışı/yorum profili |

## Bağımlılık ve güvenlik envanteri

| Mevcut bileşen / kanıt | Etiket | Hedef paket | Geçiş riski ve karar |
|---|---|---|---|
| `aiIntentClassifier.ts`: Türkçe normalizasyon ve deterministik üst niyet | KEEP | 00 karakterizasyon, 14 | Üst niyet regresyonu korunabilir; metrik/varlık/dönem çözümü için tek başına yeterli değildir. |
| `aiToolDeclarations.ts`: modele gönderilen araç şemaları | REVISE | 14 | İstemci beyanı yerine server-owned, versioned, capability filtresinden geçmiş araç şeması gerekir. |
| `aiTools.ts`: `executeAiTool`, mutation listesi ve registry sırası | REVISE | 14 | Tek yürütme sınırı fikri korunur; istemci yetkisi, serbest fallback ve legacy handler'lar hedefe taşınmaz. |
| `aiReadToolRegistry.ts`, `aiAnalyticsReadToolRegistry.ts`, `aiCustomerReadToolRegistry.ts` | REVISE | 13, 14 | Araçlar mevcut `customerService/customerAnalytics` formüllerini çağırır; hedef yalnız P13 yayımlı `MetricResultEnvelope` okur. |
| `aiMutationToolRegistry.ts`, `transactionMutations.ts`, `archiveService.ts` | REJECT | 08–11, 14 | Fiziksel silme ve istemci tarafı commit/kayıt değiştirme resmî işlem yolu olamaz. |
| `aiExcelImportRegistry.ts`, `rawExcelCache` | REVISE | 01, 14 | İstemci belleği resmi kaynak değildir; upload/staging/publish server tarafında auditable olmalıdır. |
| `aiAgentRegistry.ts` ve `localStorage` dinamik ajanlar | REJECT | 14 | Kullanıcı tanımlı prompt, yetki izolasyonu ve audit sağlamaz. |
| `aiService.ts`: `GoogleGenerativeAI`, `getApiKeys`, `VITE_GEMINI_API_KEY*` | REJECT | 14 / AI-02 | Tarayıcı anahtarı ve doğrudan provider çağrısı kapatılacak; Paket 00 yalnız envanter tutar. |
| `aiFallback/providers/gemini.ts` ve `aiFallback/config.ts` | REVISE | 14 / AI-02 | Tek backend gateway, rate limit, timeout, rotation ve idempotent retry gerekir. |
| `aiContext.ts`: sistem promptunda mevcut formül/yönlendirme metni | REJECT as official logic | 12A–12D, 14 | Formül, sabit eşik, müşteri hükmü ve zorunlu risk/aksiyon metni prompttan resmî sonuç üretemez. |
| `aiDiagnostics.ts`, evaluation scenario/testleri | KEEP / REVISE | 00, 14 | Anonim tanı ve regresyon yaklaşımı korunur; provenance, RLS, yanlış dönem/müşteri ve claim güvenliği eklenir. |
| Sohbet paneli, typewriter/modal anlatım görünümü | KEEP_UX | 12E, 14 | Görsel/akıcı karakter korunur; eski formül veya istemci mutation mantığı korunmaz. |

## Açık deprecation kayıtları

1. **Tarayıcı anahtarı ve doğrudan Gemini çağrısı:** `aiService.ts`, canlı değerlendirme ve fallback yapılandırmasındaki `VITE_GEMINI_API_KEY*` kullanımı. Paket 14 AI-02'de backend-only gateway ile kaldırılacak; Paket 00 bu yolu değiştirmez.
2. **Prompt içinde hesap ve zorunlu yorum:** `aiContext.ts` içindeki eski CEI/health/DSO/risk eşikleri, otomatik sevk/risk tavsiyesi ve her yanıtta zorunlu risk/aksiyon metni. Paket 12/14'te kanıta bağlı claim sözleşmesine geçilecek.
3. **Kalıcı silme/upsert:** `archiveService.ts`, `transactionMutations.ts`, mutation registry. Paket 01/07/08/11'de immutable source, tombstone ve kontrollü işlem zinciriyle değiştirilecek.
4. **İstemci verisinden resmî AI hesabı:** registry'lerin `customerService`, `customerQueries`, `customerAnalytics` üzerinden sonuç üretmesi. Paket 13/14'te yalnız yayımlanmış sonuç zarfı tüketilecek.
5. **Dinamik ajanı gerçek yetki gibi sunma:** `aiAgentRegistry.ts`. Paket 14'e kadar yeni yetki/commit yolu eklenmez.

## Paket 00 kontrol sınırı

Paket 00 AI davranışını yeniden yazmaz, provider çağrısını backend'e taşımaz, hiçbir declaration/handler silmez ve yeni formül üretmez. Eklenen `domain_v2_foundation` flag'i varsayılan `false` kalır; legacy AI zincirine import edilmez. Bu envanter, sonraki paketin hangi davranışı `KEEP`, `REVISE`, `REJECT` veya `ADD` olarak ele alacağını denetlenebilir kılar.
