# Görev Manifestosu: TASK-20260806-2357-AI-PROMPT-SABLONU

- **Görev Kimliği:** TASK-20260806-2357-AI-PROMPT-SABLONU
- **Başlangıç Tarihi:** 2026-08-06 23:57
- **Talep:** AI-04 — Prompt şablonu standardizasyonu
- **Risk Puanı:** 2/10 (Düşük)
  - Veritabanı etkisi: 0
  - Güvenlik ve yetki: 0
  - Kullanıcı/üretim etkisi: 1
  - Kapsam: 1
  - Geri alma zorluğu: 0
- **Workflow:** Hafif Akış (Orkestratör → Mimar → İşçi → Denetçi)
- **Gerekli Ajanlar:** Orkestratör, Mimar, İşçi, Denetçi
- **Kabul Kriterleri:**
  1. `buildSystemPrompt` içerisinde rol tabanlı varyasyonların (Raporlama, Veri Çıkarım, Hata Ayıklama) ayrıştırılması.
  2. Promptların `SemanticQueryPlan` ve `AiAnalysisClaim` kısıtlamalarına uymaya zorlanması (JSON formatında dönerken bu şemalara uyum).
  3. Projenin başarıyla derlenmesi ve testlerin geçmesi.

---

### [ORKESTRATÖR]
Görev sınıflandırıldı ve hafif akış başlatıldı. Mimar taslağı hazırlıyor.

---

### [MİMAR PLAN]
Mimar planı hazırlandı. `aiContext.ts` içindeki `buildSystemPrompt` parametreli hale getirilip, role-based ("CFO", "EXTRACT", "REPORT", vb.) yönergelerle donatılacak.

---

### [DENETÇİ - PLAN DENETİMİ]
- **Karar:** ONAYLANDI
- **Gerekçe:** Plan, `AI-04` hedefi olan prompt şablonu varyasyonlarını modülerleştirmeyi güvenli bir şekilde sağlar. `buildSystemPrompt`'un varsayılan değerleri korunduğu için regresyon riski çok düşüktür.

---

### [İŞÇİ TESLİMATI]
- **Görev Kimliği:** TASK-20260806-2357-AI-PROMPT-SABLONU
- **Durum:** DELIVERED
- **Yapılan Değişiklikler:**
  - `panel/src/services/aiContext.ts` güncellendi. `AiRoleType` tipi eklendi.
  - `buildSystemPrompt(role)` olarak parametrik hale getirildi. EXTRACT ve REPORT rollerine özel, KESİN JSON kural blokları eklendi.
  - `panel/src/services/__tests__/aiContext.test.ts` yazılarak role göre prompt metninin doğru renderlandığı test edildi.
- **Çalıştırılan Komut:** `npx vitest run src/services/__tests__/aiContext.test.ts`
- **Test Sonucu:** 3 passed.
- **Kanıt:** [task-353.log](file:///C:/Users/monds/.gemini/antigravity/brain/ad618473-22c6-43b9-bd47-77df9bc2fe04/.system_generated/tasks/task-353.log)

---

### [DENETÇİ - TESLİMAT DENETİMİ]
- **Görev Kimliği:** TASK-20260806-2357-AI-PROMPT-SABLONU
- **Karar:** ONAYLANDI (TAMAMLANDI)
- **Gerekçe:** İşçi Ajan prompt şablonunu istenilen `AiRoleType` tipine uygun modüler hale getirmiştir. EXTRACT, REPORT vb. kısıtlamaları sorunsuz enjekte edilmiştir. Syntax hatası test aşamasında tespit edilip düzeltilmiş, sistem bütünlüğü korunmuştur.
