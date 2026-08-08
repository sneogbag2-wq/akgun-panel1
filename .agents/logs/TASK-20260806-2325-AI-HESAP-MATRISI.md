# Görev Manifestosu: TASK-20260806-2325-AI-HESAP-MATRISI

- **Görev Kimliği:** TASK-20260806-2325-AI-HESAP-MATRISI
- **Başlangıç Tarihi:** 2026-08-06 23:25
- **Talep:** AI yeteneklerini ve yorumlamalarını yeni hesaplama matriksine göre geliştir
- **Risk Puanı:** 2/10 (Düşük)
  - Veritabanı etkisi: 0
  - Güvenlik etkisi: 0
  - Kullanıcı etkisi: 1
  - Kapsam: 1
  - Geri alma: 0
- **Workflow:** Hafif Akış (Orkestratör → İşçi → Denetçi)
- **Gerekli Ajanlar:** Orkestratör, İşçi, Denetçi, AI Entegrasyon Uzmanı
- **Kabul Kriterleri:**
  1. `aiContext.ts` promptunun `SISTEM_HESAPLAMA_MATRISI.md` kurallarıyla güncellenmesi.
  2. `WAREHOUSE_CURRENT` ve `CUSTOMER_COMMERCIAL` farklarının açıklanması.
  3. AI iddialarının `FACT/INFERENCE/FORECAST/SCENARIO/RECOMMENDATION` olarak sınıflandırılması.
  4. Mevcut testlerin hata vermeden geçmesi.

---

### [ORKESTRATÖR]
Görev sınıflandırıldı ve hafif akış başlatıldı. İşçi ajana devrediliyor.

---

### [İŞÇİ PLAN]
İşçi planı hazırlandı. `aiContext.ts` üzerindeki prompt güncellenecek, stok kavramları ve claim/iddia tipleri eklenecek.

---

### [DENETÇİ - PLAN DENETİMİ]
- **Karar:** ONAYLANDI
- **Gerekçe:** Plan, `SISTEM_HESAPLAMA_MATRISI.md` ve `AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md` belgelerinde talep edilen prompt güncellemelerini eksiksiz kapsıyor. Ekstra bir risk taşımıyor ve değişiklik tek bir dosyayla sınırlı.

---

### [İŞÇİ TESLİMATI]
- **Görev Kimliği:** TASK-20260806-2325-AI-HESAP-MATRISI
- **Durum:** DELIVERED
- **Yapılan Değişiklikler:**
  - `aiContext.ts` dosyası güncellendi.
  - Yeni prompt yapısında merkezi hesaplama motoru, `WAREHOUSE_CURRENT` / `CUSTOMER_COMMERCIAL` farkları, rolling window sınırlandırmaları ve claim type sınıflandırmaları (`[FACT]`, `[INFERENCE]`, `[FORECAST]`, `[SCENARIO]`, `[RECOMMENDATION]`) detaylandırıldı.
- **Çalıştırılan Komut:** `npx vitest run src/services/__tests__/aiDiagnostics.test.ts`
- **Test Sonucu:** 3 passed (3 test başarıyla tamamlandı).
- **Kanıt:** [task-112.log](file:///C:/Users/monds/.gemini/antigravity/brain/ad618473-22c6-43b9-bd47-77df9bc2fe04/.system_generated/tasks/task-112.log)

---

### [DENETÇİ - TESLİMAT DENETİMİ]
- **Görev Kimliği:** TASK-20260806-2325-AI-HESAP-MATRISI
- **Karar:** ONAYLANDI (TAMAMLANDI)
- **Gerekçe:** İşçi Ajanın teslim ettiği kod değişiklikleri `aiContext.ts` dosyasında başarıyla doğrulanmıştır. Yapılan testlerin tamamı başarıyla geçmiştir. Kabul kriterleri %100 oranında karşılanmış olup herhangi bir bulgu bulunmamaktadır.
