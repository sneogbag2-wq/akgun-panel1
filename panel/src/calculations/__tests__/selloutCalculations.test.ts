import { describe, it, expect } from 'vitest';
import { calculateHistoricalSeasonality } from '../selloutCalculations';

describe('calculateHistoricalSeasonality', () => {
  it('farklı ay uzunluklarını (28 vs 31 gün) birbirine karıştırmaz', () => {
    // Şubat (28 gün): 21. gün = %75'i geçmiş
    // Ocak (31 gün): 21. gün = %68'i geçmiş
    // targetDayFraction = 21/30 (Nisan, 30 gün) = 0.70
    const records = [
      { date: '2026-02-21', liters: 100 }, // Şubat toplamının tamamı bu tek kayıtta
      { date: '2026-01-21', liters: 100 }, // Ocak toplamının tamamı bu tek kayıtta
    ];
    const targetDayFraction = 21 / 30;
    const result = calculateHistoricalSeasonality(records, targetDayFraction);

    // Şubat'ta 21. gün oranı (21/28 = 0.75) hedef orandan (0.70) BÜYÜK olduğu için
    // bu kayıt "untilFraction" toplamına dahil EDİLMEMELİ.
    // Ocak'ta 21. gün oranı (21/31 = 0.677) hedef orandan (0.70) KÜÇÜK olduğu için
    // bu kayıt "untilFraction" toplamına dahil EDİLMELİ.
    // Şubat ayı için oran: 0/100 = 0
    // Ocak ayı için oran: 100/100 = 1
    // Ay-eşit-ağırlıklı ortalama: (0 + 1) / 2 = 0.5
    expect(result.historicalSeasonalityRatio).toBeCloseTo(0.5, 2);
  });

  it('her ayı kendi ay uzunluğuna göre normalize eder (regresyon testi - eski hata: sabit gün eşiği)', () => {
    // Eski (hatalı) davranış: recDay <= daysElapsed kontrolü, ay uzunluğunu hiç hesaba katmazdı.
    // targetDayFraction = 0.70 (ör. 30 günlük ayda 21. gün)
    // 31 günlük bir ayda gün 22 -> oran 22/31 = 0.71 (hedeften biraz büyük, dahil edilmemeli)
    const records = [{ date: '2026-01-22', liters: 50 }];
    const targetDayFraction = 0.70;
    const result = calculateHistoricalSeasonality(records, targetDayFraction);
    // 22/31 = 0.7097 > 0.70 olduğu için bu ayın oranı 0 çıkar; fonksiyon güvenlik
    // amaçlı olarak tam sıfır oranda targetDayFraction'a düşer (bölünemez durum koruması).
    // Asıl doğrulanan şey: kayıt YANLIŞLIKLA "dahil" sayılıp oran 1.0 çıkmıyor.
    expect(result.historicalSeasonalityRatio).toBeCloseTo(targetDayFraction, 5);
    expect(result.historicalSeasonalityRatio).not.toBeCloseTo(1, 2);
  });

  it('geçmiş veri yoksa targetDayFraction değerine düşer (varsayılan eşit dağılım)', () => {
    const result = calculateHistoricalSeasonality([], 0.6);
    expect(result.historicalSeasonalityRatio).toBeCloseTo(0.6, 5);
    expect(result.histTotalLiters).toBe(0);
  });

  it('ay sonu kapanış ivmesini (son ~1/3 dilim) ay uzunluğundan bağımsız oranla hesaplar', () => {
    const records = [
      { date: '2026-01-01', liters: 30 }, // ayın başı
      { date: '2026-01-25', liters: 70 }, // 25/31 = 0.806 >= 0.67 -> "geç ay" sayılır
    ];
    const result = calculateHistoricalSeasonality(records, 0.5);
    // toplam 100, geç-ay kısmı 70 -> oran 0.70
    expect(result.lateMonthSpikeRatio).toBeCloseTo(0.70, 2);
    expect(result.histTotalLiters).toBe(100);
  });

  it('birden fazla ayı ay-bazlı eşit ağırlıkla ortalar (hacmi büyük tek ay domine etmesin)', () => {
    const records = [
      // Ay 1: çok yüksek hacim, oranı 1.0 (tamamı erken günlerde)
      { date: '2026-01-05', liters: 10000 },
      // Ay 2: düşük hacim, oranı 0.0 (tamamı geç günlerde)
      { date: '2026-02-27', liters: 10 },
    ];
    // targetDayFraction yeterince büyük ki Ay1 kaydı dahil olsun, Ay2 kaydı dahil olmasın
    const targetDayFraction = 0.20;
    const result = calculateHistoricalSeasonality(records, targetDayFraction);
    // Ay1 oranı: 1.0 (5/31=0.16 <= 0.20), Ay2 oranı: 0.0 (27/28=0.96 > 0.20)
    // Ay-eşit ortalama: (1.0 + 0.0) / 2 = 0.5 (hacim ağırlıklı olsaydı ~1.0'a çok yakın çıkardı)
    expect(result.historicalSeasonalityRatio).toBeCloseTo(0.5, 2);
  });
});
