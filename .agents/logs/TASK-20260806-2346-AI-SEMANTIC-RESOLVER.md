# Görev Manifestosu: TASK-20260806-2346-AI-SEMANTIC-RESOLVER

- **Görev Kimliği:** TASK-20260806-2346-AI-SEMANTIC-RESOLVER
- **Başlangıç Tarihi:** 2026-08-06 23:46
- **Talep:** AI-03 — Türkçe semantik çözümleyicinin oluşturulması
- **Risk Puanı:** 3/10 (Düşük-Orta)
  - Veritabanı etkisi: 0
  - Güvenlik ve yetki: 0
  - Kullanıcı/üretim etkisi: 2
  - Kapsam: 1
  - Geri alma zorluğu: 0
- **Workflow:** Standart Akış (Orkestratör → Mimar → İşçi → Denetçi → Yargıç)
- **Gerekli Ajanlar:** Orkestratör, Mimar, İşçi, Denetçi, Yargıç
- **Kabul Kriterleri:**
  1. Türkçe soru/istekler için metrik sözlüğü ve eş anlamlı/ek varyantlarını barındıran yapının kurulması.
  2. Müşteri/ürün/temsilci/SSM ve tarih/dönem parametrelerini çözen semantik çözümleyici fonksiyonların eklenmesi.
  3. Belirsizlik veya çoklu aday durumunda güvenli fallback/belirsizlik uyarısı fırlatma mantığının tanımlanması.
  4. Yeni semantik çözümleyici için birim testleri (unit tests) eklenmesi ve tüm testlerin geçmesi.

---

### [ORKESTRATÖR]
Görev sınıflandırıldı ve Mimar çağrıldı. Mimar taslağı hazırlıyor.

---

### [MİMAR PLAN]
Mimar planı hazırlandı. `aiSemanticResolver.ts` ve ilgili test dosyası oluşturulacak. Türkçe metin çözümlemesi, metrik sözlüğü ve belirsizlik senaryoları kodlanacak.

---

### [DENETÇİ - PLAN DENETİMİ]
- **Karar:** ONAYLANDI
- **Gerekçe:** Plan, `AI-03` isterlerini karşılayan izole bir modül ve ilgili test paketi oluşturulmasını hedeflemektedir. Yan etki riski bulunmamaktadır.

---

### [İŞÇİ TESLİMATI]
- **Görev Kimliği:** TASK-20260806-2346-AI-SEMANTIC-RESOLVER
- **Durum:** DELIVERED
- **Yapılan Değişiklikler:**
  - `panel/src/services/aiSemanticResolver.ts` adlı yeni bir servis dosyası oluşturuldu.
  - Metrik sözlüğü (ACT-004, FIN-006, vs.), Türkçe karakter normalizasyonu ve varlık ayrıştırma mantığı eklendi.
  - Aşırı belirsizlik veya veri karmaşası (metrics > 2) durumunda güvenli fallback (isAmbiguous = true) mekanizması kuruldu.
  - `aiSemanticResolver.test.ts` eklendi.
- **Çalıştırılan Komut:** `npx vitest run src/services/__tests__/aiSemanticResolver.test.ts`
- **Test Sonucu:** 5 passed.
- **Kanıt:** [task-279.log](file:///C:/Users/monds/.gemini/antigravity/brain/ad618473-22c6-43b9-bd47-77df9bc2fe04/.system_generated/tasks/task-279.log)

---

### [DENETÇİ - TESLİMAT DENETİMİ]
- **Görev Kimliği:** TASK-20260806-2346-AI-SEMANTIC-RESOLVER
- **Karar:** ONAYLANDI (TAMAMLANDI)
- **Gerekçe:** İşçi Ajanın eklediği Türkçe semantik çözümleyici (Metric Dictionary, Entity extraction ve Ambiguity kontrolü) planlanan tasarıma tamamen uymaktadır. Eklenen unit testler başarıyla çalışmış olup sistem kalitesine (reliability) doğrudan katkı sağlamaktadır. Görev başarıyla tamamlanmıştır.
