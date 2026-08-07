export interface QualityControlResult {
  isValid: boolean;
  warning?: string;
}

/**
 * AI tarafından üretilen metnin (narrative) kural tabanlı kalite denetimini yapar.
 * Halüsinasyon, kanıtsız öneri veya aşırı sayısal yığmayı tespit eder.
 */
export function validateNarrativeQuality(narrative: string, toolResultsCount: number = 0): QualityControlResult {
  if (!narrative || typeof narrative !== 'string') {
    return { isValid: true }; // Boş yanıtlarda denetim yok
  }

  const text = narrative.toLowerCase();
  
  // 1. Kuru Sayı Yığması (Raw Number Dumping) Kontrolü
  // Metindeki rakam karakterlerinin toplam karakter sayısına oranına bakıyoruz.
  const digitCount = (narrative.match(/\d/g) || []).length;
  const totalLength = narrative.length;
  
  if (totalLength > 50 && (digitCount / totalLength) > 0.4) {
    return {
      isValid: false,
      warning: "Yapay zeka analiz yorumu katmadan sadece sayıları listelemiş olabilir (Kuru Sayı Yığması)."
    };
  }

  // 2. Kanıtsız Risk / Öneri Kontrolü (Desteksiz Yargı)
  // Eğer metin çok kısaysa ama büyük yargılar içeriyorsa muhtemelen desteksizdir.
  const hasRiskKeyword = text.includes('risk') || text.includes('tehlike') || text.includes('kötüye gidiş') || text.includes('uyarı');
  const hasRecommendationKeyword = text.includes('öneri') || text.includes('tavsiye') || text.includes('yapılmalı') || text.includes('aksiyon');
  
  if ((hasRiskKeyword || hasRecommendationKeyword) && totalLength < 100 && toolResultsCount === 0) {
     return {
       isValid: false,
       warning: "Yapay zeka yeterli arka plan verisi (kanıt) sunmadan risk veya öneri belirtmiş olabilir."
     };
  }
  
  // 3. Kesinlik Halüsinasyonu
  const hasAbsolutes = text.includes('kesinlikle') || text.includes('yüzde yüz') || text.includes('garanti');
  if (hasAbsolutes) {
     return {
       isValid: false,
       warning: "Finansal verilerde 'kesinlik' belirten ifadeler kullanılmıştır; tahminler (forecast/scenario) kesinmiş gibi sunulamaz."
     };
  }

  return { isValid: true };
}
