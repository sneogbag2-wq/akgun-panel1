import { describe, expect, it } from 'vitest';
import { classifyAiQueryIntent, normalizeTurkishText } from '../aiIntentClassifier';

describe('Turkish-aware AI intent classifier', () => {
  it('normalizes Turkish characters and spelling variants', () => {
    expect(normalizeTurkishText('ÇEK/SENET GÜNCELLEYİN!')).toBe('cek senet guncelleyin');
    expect(classifyAiQueryIntent('Tahsilatlarımın etkinliği nedir?')).toBe('COLLECTION');
    expect(classifyAiQueryIntent('Sevkiyatların son durumunu göster')).toBe('SHIPMENT');
  });

  it('prioritizes write intent and attachments', () => {
    expect(classifyAiQueryIntent('Müşteri ekstresini sil')).toBe('MUTATION');
    expect(classifyAiQueryIntent('Yeni tahsilat kaydedin')).toBe('MUTATION');
    expect(classifyAiQueryIntent('Ekteki dosyayı analiz et', true)).toBe('EXCEL_ANALYSIS');
  });
});
