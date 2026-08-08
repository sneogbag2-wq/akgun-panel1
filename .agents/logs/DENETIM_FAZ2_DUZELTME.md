ROL: Denetçi
TARANAN KURAL DOSYALARI: KODLAMA_ASAMALI_UYGULAMA_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, YARGIC_FAZ2_GERCEK.md
BAĞIMSIZLIK NOTU: Aynı oturum/model üzerinden zincir içi bağımsız denetim.

KARAR: ONAYLANDI (PLAN KAPISI)

Kontrol listesi sonuçları:
1. **Kurallar uygulanmış mı?** Evet. Yargıç raporundaki (YARGIC_FAZ2_GERCEK.md) ret gerekçeleri (izolasyon eksikliği ve silinen frontend fonksiyonları) birebir hedeflenmiş ve kurallardaki (Öneri 3 ve 5) gereksinimlere uygun bir düzeltme planı hazırlanmıştır.
2. **Kod doğru mu?** (Plan aşaması - Kod henüz yazılmadı). Ancak plandaki mock yaklaşımı (`_isBlocked: true` ve `console.warn` ile güvenli obje dönülmesi) mantıklı ve güvenlidir.
3. **AI yorumu / kalıp dışına çıkma var mı?** Hayır. İşçi Ajan, Yargıç'ın belirlediği çerçevenin dışına çıkmadan sadece istenen izolasyonları ve mock'lamaları yapmayı planlamıştır.
4. **Varsayımda bulunulmuş mu?** Planda 2 adet varsayım (VARSAYIM 1 ve VARSAYIM 2) açıkça listelenmiştir. Gizli/örtük bir varsayım tespit edilmemiştir.
5. **Yan kapıdan geçilmiş mi?** Hayır. Plan, tam tersine bir önceki sahte tamamlanma/yan kapı ihlalini kapatmayı hedeflemektedir.

İşçi Ajan, plana uygun olarak kodlamaya geçebilir. Kodlama bittikten sonra tam kanıtlarla (diff, test/build sonuçları) birlikte "Kod Kapısı" denetimine gelmelidir.
