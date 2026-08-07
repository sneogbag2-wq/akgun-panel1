import type { ResponseDensity } from './aiIntentClassifier';

/**
 * AI-11: Token ve Yoğunluk Yöneticisi
 * Kullanıcının niyetine göre AI'a gidecek görünmez talimatları (Prompt Injection) üretir.
 */
export function injectDensityPrompt(userMessage: string, density: ResponseDensity): string {
  let injection = '';
  
  if (density === 'SHORT') {
    injection = `\n\n[SİSTEM: Kullanıcı çok hızlı/kısa bir cevap bekliyor. SADECE temel sonucu ver. Merhaba, saygılar gibi giriş/çıkış veya açıklama YAPMA. Çıktını 50-100 kelimeyle sınırla.]`;
  } else if (density === 'LONG') {
    injection = `\n\n[SİSTEM: Kullanıcı kapsamlı bir finansal analiz bekliyor. Tüm Rapor Sözleşmesini (Katkı, Risk, Senaryo) tam uygula, bolca tablo ve detaylı finansal yorumlar yap. Token sınırlarını sonuna kadar kullan.]`;
  }
  
  // MEDIUM için ek bir instructiona gerek yok, varsayılan prompt yeterli.
  
  return userMessage + injection;
}
