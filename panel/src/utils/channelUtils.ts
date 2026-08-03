// src/utils/channelUtils.ts
// Sellout Raporu "Müşteri Kanalı Tnm." Sütunu Kanal Eşleme Motoru

/**
 * Müşteri Kanalı Tnm sütünundaki 4 (ve 5) ana veri ismine göre Kanal Eşleme:
 * Standart Açık , Horeca ve Otel = Açık Kanal
 * Standart Kapalı ve Ekomini = Kapalı Kanal
 *
 * NOT: customerMasterParser içinde Bira/Distile gibi birden fazla birimden
 * gelen kayıtlar birleştirilirken kanal alanı "AÇIK / KAPALI" gibi TEK bir
 * string'e birleşebiliyor. Böyle bir string hem "AÇIK" hem "KAPALI" kelimesini
 * içerir. Eskiden KAPALI kontrolü ÖNCE yapıldığı için bu karma müşteriler her
 * zaman sessizce KAPALI kanala atanıyor, Açık Kanal raporlarından tamamen
 * düşüyordu. Artık böyle bir string açıkça tespit edilip 'KARMA' olarak
 * döndürülüyor; çağıran kod bunu ihtiyacına göre yorumlayabilir (bkz.
 * resolveSelloutChannel çağıran fknsCalculations/selloutCalculations).
 */
export function resolveSelloutChannel(channelName: string | null | undefined): 'AÇIK' | 'KAPALI' | 'KARMA' {
  if (!channelName) return 'AÇIK';
  const ch = String(channelName).trim().toUpperCase();

  const isKapali =
    ch.includes('STANDART KAPALI') ||
    ch.includes('EKOMİNİ') ||
    ch.includes('EKOMINI') ||
    ch.includes('KAPALI');

  const isAcik =
    ch.includes('STANDART AÇIK') ||
    ch.includes('STANDART ACIK') ||
    ch.includes('HORECA') ||
    ch.includes('OTEL') ||
    ch.includes('AÇIK') ||
    ch.includes('ACIK');

  // Her iki kanal da tespit edildiyse (örn. birleştirilmiş "AÇIK / KAPALI" kaydı):
  // müşteriyi tek bir kanala hatalı şekilde atamak yerine KARMA döndür.
  if (isKapali && isAcik) return 'KARMA';
  if (isKapali) return 'KAPALI';
  if (isAcik) return 'AÇIK';

  return 'AÇIK';
}

/**
 * KARMA sonucunu, belirli bir hedef kanal için "bu kanala dahil mi?" sorusuna
 * çeviren yardımcı fonksiyon. KARMA müşteriler, o kanaldan gerçekten satışı
 * olduğu için HER İKİ kanal raporuna da dahil edilir (ne Açık ne Kapalı
 * hedeflerinden haksız yere dışlanmaz).
 */
export function customerBelongsToChannel(
  channelName: string | null | undefined,
  targetChannel: 'AÇIK' | 'KAPALI'
): boolean {
  const resolved = resolveSelloutChannel(channelName);
  if (resolved === 'KARMA') return true;
  return resolved === targetChannel;
}

// Backward compatibility helper
export function resolveChannelFromMaster(channelName: string | null | undefined): 'AÇIK' | 'KAPALI' {
  const resolved = resolveSelloutChannel(channelName);
  // Geriye dönük uyumluluk: eski çağıranlar sadece AÇIK/KAPALI bekliyor.
  // KARMA durumunda AÇIK döndürüyoruz (varsayılan davranışla tutarlı ve
  // müşteriyi tamamen görünmez kılan eski KAPALI-öncelikli hataya dönmüyoruz).
  return resolved === 'KAPALI' ? 'KAPALI' : 'AÇIK';
}
