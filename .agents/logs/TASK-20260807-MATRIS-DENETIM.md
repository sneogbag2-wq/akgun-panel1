# SISTEM_HESAPLAMA_MATRISI Uyumluluk ve Eksiksizlik Denetim Raporu

**Tarih:** 2026-08-07  
**Gözden Geçiren Rol:** Denetçi & Finansal Tutarlılık Denetçisi  
**Karar:** REDDEDİLDİ / EKSİK (Formül Sapmaları ve Eksik Metrikler Tespit Edildi)  

---

## 0. Ön Kontrol Beyanı

```
ROL: Denetçi (Finansal Tutarlılık Denetçisi Uzman Alt-Denetimi ile)
TARANAN KURAL VE KATALOG DOSYALARI:
  - .agents/rules/kontrol-hatti-rule-01.md
  - .agents/rules/kontrol-hatti-rule-02.md
  - SISTEM_HESAPLAMA_MATRISI.md
  - STOK_METRIK_KATALOGU.md
  - FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md
  - VERITABANI_YENIDEN_TASARIM_KARARLARI.md
  - SOZLUK.md
BAĞIMSIZLIK NOTU: Aynı oturum içinde farklı rol olarak çalışılıyor — rol ayrımı yalnızca prosedüreldir, bağlam düzeyinde değildir.
TETİKLEYEN HESAP/MODÜL: SISTEM_HESAPLAMA_MATRISI.md
KURAL ÇELİŞKİSİ: Yok
```

---

## 1. Denetim Özeti ve Karar

**DURUM:** **REDDEDİLDİ / EKSİK**

Kullanıcının *"SISTEM_HESAPLAMA_MATRISI kontrol edin herşey eksiksiz uygulanmış mı tek bir farklı formül istemiyorum"* talebi üzerine yapılan kapsamlı bağımsız kod incelemesinde:
1. `SISTEM_HESAPLAMA_MATRISI.md` dokümanında tanımlanan 200'ü aşkın metrik ve formülden backend kod tabanına yalnızca ~10-15 adet metrik için basitleştirilmiş fonksiyonlar yazılmıştır. Metriklerin %90'ından fazlası henüz koda dökülmemiştir.
2. Kod dökülen kritik servislerde (`fknsService.js`, `forecastService.js`, `financialReadService.js`), matriste onaylanan kesin iş kuralları ve matematiksel bağıntılar yerine **tamamen farklı alternatif formüller ve isimlendirmeler** kullanıldığı tespit edilmiştir.

`kontrol-hatti-rule-01.md` Madde 6 (Bağımsız Denetim İstisnası) ve `kontrol-hatti-rule-02.md` Madde 9 (Varsayılan Durum Kuralı) gereğince, tespit edilen sapma ve eksiklikler nedeniyle teslimat/mevcut durum **REDDEDİLDİ** olarak kayda geçirilmiştir.

---

## 2. Somut Sapma ve İhlal Tablosu

| Metrik Kodu | Matristeki Onaylı Tanım (`SISTEM_HESAPLAMA_MATRISI.md`) | Kodda Uygulanan Formül / Durum | İhlal Türü / Etki |
|---|---|---|---|
| `FKNS-001` | Dönem kesiminde evrendeki benzersiz uygun aktif müşteri sayısı (`denominator_general`). | `(activeDays / expectedDays) * 100` (`calculateCoverage`) | **Yanlış Formül & İsim Sapması**: Müşteri sayısı yerine gün oranına dönüştürülmüş. |
| `FKNS-002` | En az 1 geçerli pozitif faturalama belgesi olan müşteri sayısı (`numerator_invoice`). | `(uniqueBuyers / totalTargetCustomers) * 100` (`calculatePointPenetration`) | **Yanlış Formül**: Müşteri adedi yerine nokta penetrasyon yüzdesine dönüştürülmüş. |
| `FKNS-003` | Genel FKNS Oranı (`100 * FKNS-002 / FKNS-001`). | `totalInvoices / uniqueBuyers` (`calculateFrequency`) | **Yanlış Formül**: FKNS oranı yerine fatura sıklığı (Frequency) formülü yazılmış. |
| `SS-001` | Koruma süresi günü $H$ (`protection_horizon_days`). Tedarik süresi (`LeadTime`) `PASSIVE_BY_POLICY`'dir. | `(maxDailySales * maxLeadTime) - (avgDailySales * avgLeadTime)` | **Farklı Formül**: Pasif ilan edilmiş `LeadTime` değişkenleri kullanılarak klasik teksbook formülü dökülmüş. |
| `ORD-001` | `net_order_litres = max(0, gross_need - stock_position)`. | `(forecastDemand * avgLeadTime) + safetyStock - currentStock` | **Farklı Formül**: Matris formülü yerine Reorder Point mantığı kodlanmış. |
| `FIN-014` | 29+ alacak havuzu (`adjusted_aged_receivable_pool`) mutabakatlı CEI endeksi (`100 * eligible_aged_settlement / pool`). | `totalCollected / totalReceivable * 100` (`lot.age_days >= 29`) | **Eksik Mantık**: Virman, açılış, geri dönen alacak ve havuz mutabakat kapıları uygulanmamış. |
| `FIN-015` | 5 bileşenli Sağlık Skoru (`aging %35`, `CEI %25`, `exposure %20`, `close behavior %10`, `instrument %10`). | `(cei_score * 0.4) + (dso_score * 0.3) + (payment_trend * 0.3)` | **Yasak İhlali**: Matriste *"DSO context'tir, score component değildir"* kuralı çiğnenerek DSO skora bileşen yapılmış ve ağırlıklar değiştirilmiş. |
| `FIN-016` | Quantile tabanlı faaliyet ihtiyacı (%75 P) ve nakit kapasitesi (%25 P) ile governor sınırlaması. | Dışarıdan ham parametre alıp doğrudan `min(operatingNeed, cashCapacity) * behaviorFactor` yuvarlıyor. | **Eksik Motor**: Quantile ve governor kuralları kodda uygulanmamış. |
| Metriklerin %90+'ı | `PRD-`, `ACT-`, `EVT-`, `TGT-`, `FCST-002+`, `STK-`, `CST-`, `COLL-`, `NOTEPRINT-`, `ORDOP-`, `FCTL-`, `MET-` vb. | Kodda tanımları/hesaplayıcıları yok. | **Eksik Kapsam**: Sistem matrisindeki 200+ kural uygulanmamış. |

---

## 3. Önerilen Düzeltme Yolu

`kontrol-hatti-rule-01.md` Madde 4 ve Madde 6 gereği Denetçi kodu kendisi düzeltmez. Düzeltme için İşçi Ajan'a verilmek üzere şu adımlar görevleştirilmelidir:
1. `fknsService.js`, `forecastService.js` ve `financialReadService.js` dosyalarındaki ad-hoc formüller temizlenmeli, `SISTEM_HESAPLAMA_MATRISI.md` dokümanındaki birebir formüller ve `metric_id` tanımları uygulanmalıdır.
2. Pasif/taslak olarak etiketlenen değişkenler (`LeadTime` gibi) aktif hesaplama motorlarına sızdırılmamalıdır.
3. Eksik metrikler için modüler hesaplayıcılar (`metricEngineService`) devreye sokulmalı ve test paketi matris referanslarıyla yeniden doğrulanmalıdır.
