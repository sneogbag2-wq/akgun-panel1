# Görev Manifestosu: TASK-20260807-0016-AI-ANALIZ-MOTORU

- **Görev Kimliği:** TASK-20260807-0016-AI-ANALIZ-MOTORU
- **Başlangıç Tarihi:** 2026-08-07 00:16
- **Talep:** AI-06 — Analiz ve Yorum Motoru (Analysis and Interpretation Engine)
- **Risk Puanı:** 6/10 (Orta-Yüksek)
  - Veritabanı etkisi: 0
  - Güvenlik ve yetki: 0
  - Kullanıcı/üretim etkisi: 4 (Yorumlama kalitesini doğrudan etkiler)
  - Kapsam: 3
  - Geri alma zorluğu: 0
- **Workflow:** Standart Akış (Orkestratör → Mimar → İşçi → Denetçi → Yargıç)
- **Gerekli Ajanlar:** Orkestratör, Mimar, İşçi, Denetçi, Yargıç
- **Kabul Kriterleri:**
  1. `aiAnalysisEngine.ts` dosyasının oluşturulması.
  2. Metrik sonuçlarını (`MetricResultEnvelope`) alıp, bunlardan önemlilik sırasına göre `AiAnalysisClaim` (FACT, INFERENCE, vb.) üreten fonksiyonların yazılması.
  3. "Dayanağı olmayan sayı/iddia reddedilir" kuralının kod ile (örneğin iddia üretirken zorunlu `supporting_metric_result_ids` kontrolü) garanti altına alınması.
  4. Testlerin yazılıp başarılı olması.

---

### [ORKESTRATÖR]
Görev sınıflandırıldı. Yapay zekanın serbest metin üretmesi yerine katı kurallı "iddia" (claim) üretmesini sağlayacak Analiz ve Yorum Motoru görevine başlandı. Mimar plan için çağrıldı.

---

### [MİMAR PLAN]
Mimar planı hazırlandı. `aiAnalysisEngine.ts` dosyası kurularak `generateClaims` ve `sortClaimsByMateriality` fonksiyonları eklenecek. İddiaların kanıt (evidence) barındırması (`supporting_metric_result_ids`) zorunlu tutulacak. Kanıtsız iddialar listeye alınmayacak (filtrelecek/reddedilecek).

---

### [DENETÇİ - PLAN DENETİMİ]
- **Karar:** ONAYLANDI
- **Gerekçe:** Plan, hedeflenen "AI'ın kanıtsız uydurma üretmesini engelleme" amacına doğrudan hizmet eden sıkı bir kural mekanizması öngörmektedir. İddia objelerindeki `supporting_metric_result_ids` kontrolü, veri güvenliğini sağlamak için yeterli ve uygundur.

---

### [İŞÇİ TESLİMATI]
- **Görev Kimliği:** TASK-20260807-0016-AI-ANALIZ-MOTORU
- **Durum:** DELIVERED
- **Yapılan Değişiklikler:**
  - `panel/src/services/aiAnalysisEngine.ts` dosyası oluşturuldu.
  - `generateClaims` fonksiyonunda, AI veya sistem tarafından üretilen iddiaların (proposedClaims) dayandığı metrik (supporting_metric_result_ids) yoksa doğrudan filtrelenmesi sağlandı (Hallucination Prevention).
  - Ek olarak, iddiada verilen metrik ID'lerinin gerçekten de sisteme sunulan geçerli zarflar (envelopes) listesinde bulunması şartı (Policy 2) eklendi.
  - İddiaları "HIGH > MEDIUM > LOW" hiyerarşisinde dizen `sortClaimsByMateriality` yazıldı.
  - `panel/src/services/__tests__/aiAnalysisEngine.test.ts` eklenerek mantık test edildi.
- **Çalıştırılan Komut:** `npx vitest run src/services/__tests__/aiAnalysisEngine.test.ts`
- **Test Sonucu:** 3 passed.
- **Kanıt:** [task-487.log](file:///C:/Users/monds/.gemini/antigravity/brain/ad618473-22c6-43b9-bd47-77df9bc2fe04/.system_generated/tasks/task-487.log)

---

### [DENETÇİ - TESLİMAT DENETİMİ]
- **Görev Kimliği:** TASK-20260807-0016-AI-ANALIZ-MOTORU
- **Karar:** ONAYLANDI (TAMAMLANDI)
- **Gerekçe:** İşçi Ajan, "yalnızca kanıta dayalı (evidence-bound) yorum üretimi" kuralını (Policy 1 ve Policy 2) sisteme kusursuz olarak entegre etmiştir. Kanıtsız halüsinasyon risklerini başarıyla test etmiş ve engelleyebilmiştir. Standartlar sağlanmıştır.

---

### [YARGIÇ - NİHAİ MÜHÜR]
- **Görev Kimliği:** TASK-20260807-0016-AI-ANALIZ-MOTORU
- **Karar:** MÜHÜRLENDİ (SEALED)
- **Gerekçe:** Yapılan son incelemede tip güvenliği (`undefined` / `null` referans hataları) ve iş mantığı (%100 kanıt dayatma mekanizması) hatasız bulunmuştur. Fonksiyonların korumacı yaklaşımı (defensive programming) yeterlidir. Teslimat başarıyla mühürlenmiştir.
