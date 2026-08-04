import { describe, expect, it } from 'vitest';
import { buildFinalResponseInstruction, buildPostToolFallback, buildToolResultsFallback, FINAL_RESPONSE_INSTRUCTION } from '../aiService';

describe('buildToolResultsFallback', () => {
  it('renders safe, readable metrics instead of the generic no-summary message', () => {
    const summary = buildToolResultsFallback([
      {
        toolName: 'getShipmentTrackingReport',
        toolArgs: {},
        toolResult: { customerCount: 179, topCustomers: [{ customerName: 'Örnek Cari' }], stats: { ignored: true } }
      }
    ]);

    expect(summary).toContain('getShipmentTrackingReport');
    expect(summary).toContain('customerCount');
    expect(summary).toContain('179');
    expect(summary).not.toContain('Örnek Cari');
  });

  it('keeps a pre-tool response when the final model response is empty', () => {
    const summary = buildPostToolFallback('Performansı kontrol ediyorum.', [
      { toolName: 'getSalesFkns', toolArgs: {}, toolResult: { customerCount: 3 } }
    ]);

    expect(summary).toContain('Performansı kontrol ediyorum.');
    expect(summary).toContain('customerCount');
  });

  it('instructs the model to produce a final response without new tool calls', () => {
    expect(FINAL_RESPONSE_INSTRUCTION).toContain('Yeni araç çağırma');
    expect(FINAL_RESPONSE_INSTRUCTION).toContain('nihai yanıt üret');
    expect(FINAL_RESPONSE_INSTRUCTION).toContain('Kanıt ve metrikler');
    expect(FINAL_RESPONSE_INSTRUCTION).toContain('tutar veya oranı');
  });

  it('adds the matching explainability template for shipment and sellout reports', () => {
    const instruction = buildFinalResponseInstruction([
      { toolName: 'getShipmentTrackingReport' },
      { toolName: 'calculateSelloutProbability' }
    ]);

    expect(instruction).toContain('Sevkiyat: rapor tarihini ve kapsamı yaz');
    expect(instruction).toContain('gerçekleşen sellout ile tahmin olasılığını kesinlikle ayrı etiketle');
  });
});
