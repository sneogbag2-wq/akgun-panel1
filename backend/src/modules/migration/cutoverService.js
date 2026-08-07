export class CutoverError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CutoverError';
  }
}

export function createCutoverService(legacySystem, v4System, isCutoverComplete = false) {
  if (!legacySystem || !v4System) throw new TypeError('Both Legacy and V4 systems are required');

  return Object.freeze({
    // Hard Cutover aktif mi?
    isCutoverComplete() {
      return isCutoverComplete;
    },

    // Veri yazma isteği gelir
    async writeFinancialData(data) {
      if (isCutoverComplete) {
        // CUTOVER TAMAMLANDI: Legacy sisteme yazmak KESİNLİKLE YASAK!
        // Yalnızca V4'e yazılır.
        return await v4System.write(data);
      } else {
        // SHADOW MODE (Paralel Yayın İş Kuralı)
        // Her ikisine de yazılır, V4'ün sonucu katı şekilde denetlenir.
        // Uyuşmazlık durumunda iş kuralı (SISTEM_HESAPLAMA_MATRISI) ihlal edilmiş sayılır ve hata fırlatılır.
        const legacyResult = await legacySystem.write(data);
        const v4Result = await v4System.write(data);
        
        // Strict Match Verification
        if (legacyResult.value !== v4Result.value) {
          throw new CutoverError(`[SHADOW MODE MISMATCH] Strict rule violation! Legacy: ${legacyResult.value}, V4: ${v4Result.value}`);
        }

        return legacyResult;
      }
    },

    // Legacy sisteme doğrudan (arka kapıdan) erişim denemesi
    async accessLegacyDirectly() {
      if (isCutoverComplete) {
        throw new CutoverError('Legacy System is Deprecated and Locked.');
      }
      return legacySystem.access();
    }
  });
}
