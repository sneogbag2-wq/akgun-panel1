# DOMAIN_GLOSSARY.md — İş Terimleri ve Doğru Formül Sözlüğü

Bu sözlük, toptan alkollü içki dağıtım sektörü terimlerini ve bu projede **doğru kabul
edilen** formülleri listeler. Amaç: AI'nin bir terimi/formülü kendi yorumuyla yeniden
icat etmesini önlemek. Yeni bir terimle karşılaşırsan, varsayımda bulunma — kodda nasıl
kullanıldığını `grep` ile incele ya da kullanıcıya sor, sonra buraya ekle.

## Finansal / Cari Terimler

| Terim | Anlamı |
|---|---|
| **Cari / Cari Hesap** | Müşterinin (bayi, market, otel vb.) şirkete olan güncel borç-alacak durumu. |
| **Bakiye** | Cari hesabın net borç tutarı. |
| **Vade** | Faturanın ödenmesi gereken süre. |
| **Ortalama Vade** | Açık işlemlerin tutar-ağırlıklı ortalama gün sayısı — `getAgingBuckets()` ile hesaplanır, tek tek fatura vadelerinin basit ortalaması **değildir**. |
| **Aging / Yaşlandırma Analizi** | Açık alacakların gün dilimlerine (0-30, 30-60, 60-90, 90+) dağılımı. |
| **Tahsilat** | Müşteriden yapılan ödeme. |
| **Çek/Senet** | Vadeli ödeme aracı; tahsil edilmemiş olanlar risk olarak izlenir (`chequeRiskAmount`). Durum alanı `'TAHSİL EDİLDİ'` olmayanlar risk hesabına dahil edilir. |
| **Net Alacak** | Toplam bakiyeden tahsil edilmiş/mahsup edilmiş tutarlar düşüldükten sonra kalan gerçek alacak. |

## Satış / Sevkiyat Terimleri

| Terim | Anlamı |
|---|---|
| **Sellout** | Bayiden nihai satış noktasına (market, otel, restoran vb.) yapılan satış. "Sell-in" (üreticiden bayiye) ile **karıştırılmamalı**. |
| **Sellout Hedef** | Belirlenen sellout satış hedefine göre gerçekleşme oranı. |
| **Prim** | Satış temsilcisi/bayi performans primi; hesap mantığı `src/calculations/primCalculations.ts`. |
| **Sevkiyat** | Sipariş/ürün teslimat süreci; takip `SevkiyatTakipPage`. |
| **SSM** | `Customer.ssmName` alanı — projede saha/bölge ilişkili bir tanımlayıcı olarak kullanılıyor; **kesin açılımı kod içinde net değil**. Varsayım yapıp iş mantığı kurma; gerekiyorsa kullanıcıya sor. |

## KPI Formülleri (bu projedeki TEK doğru kaynak)

| KPI | Doğru Formül | Kaynak |
|---|---|---|
| **CEI (Tahsilat Etkinlik İndeksi)** | `tahsilat / (tahsilat + net_alacak) * 100` | `src/calculations/cariCalculations.ts` → `calculateCEI()` |
| **Pareto %** | `topN_borç_toplamı / toplam_borç * 100` | `DashboardPage.tsx` — `paretoPct` deseni |
| **Risky30k %** | `riskTotal / repTotalDebt * 100` (0'a bölme korumalı) | `DashboardPage.tsx` |
| **Tahsilat Performansı** | `monthCollections / monthSales * 100` (satış 0 & tahsilat > 0 ise %100, ikisi de 0 ise %0) | `customerService.ts` → `getMonthlySalesRepPerformanceSync()` |

> ⚠️ **Uyarı:** Geçmişte aynı sayfada CEI için **iki farklı formül** aynı anda kullanılmış ve
> iki farklı sonuç göstermişti (`tahsilat/satış` — net alacağı hiç saymayan, yanlış olan
> ile yukarıdaki doğru formül). Bu türden bir tekrar yaşanmasın: CEI/Pareto/risk gibi bir
> metrik gerekiyorsa **her zaman** yukarıdaki kaynak fonksiyonu import et, satır içinde
> yeniden hesaplama.

## Öncelik Sınıflandırması (proje denetim raporlarında kullanılan format)

| Kod | Anlamı |
|---|---|
| **P0** | Derhal — güvenlik açığı, veri bütünlüğü riski |
| **P1** | Kritik — yanlış finansal hesap/karar desteği |
| **P2** | İkincil — raporlama kapsamı, onay akışı, tutarlılık |
| **P3** | Ürün kalitesi — açıklanabilirlik, UX, küçük doğruluk iyileştirmeleri |

Yeni bulunan bir sorunu raporlarken bu sınıflandırmayı kullan (bkz. `AGENTS.md` §6).
