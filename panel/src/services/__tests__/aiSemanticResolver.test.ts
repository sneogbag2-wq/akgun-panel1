import { describe, it, expect } from 'vitest';
import { resolveSemanticQuery } from '../aiSemanticResolver';

describe('aiSemanticResolver', () => {
  it('should resolve sales metric successfully with Turkish variants', () => {
    const result = resolveSemanticQuery('Dünkü satışlar nasıl?');
    expect(result.isAmbiguous).toBe(false);
    expect(result.plan).not.toBeNull();
    expect(result.plan?.metric_ids).toContain('ACT-004');
  });

  it('should resolve collection metric with encoding or case differences', () => {
    const result = resolveSemanticQuery('ÖDEMELER ne durumda?');
    expect(result.isAmbiguous).toBe(false);
    expect(result.plan?.metric_ids).toContain('FIN-006');
  });

  it('should identify specific customer entity by 10 digit ID', () => {
    const result = resolveSemanticQuery('1234567890 kodlu müşteri için satış ve tahsilat durumu');
    expect(result.isAmbiguous).toBe(false);
    expect(result.plan?.entity_refs).toContain('CUST:1234567890');
    expect(result.plan?.metric_ids).toContain('ACT-004');
    expect(result.plan?.metric_ids).toContain('FIN-006');
  });

  it('should mark query as ambiguous if no metrics or entities are found', () => {
    const result = resolveSemanticQuery('Naber nasılsın');
    expect(result.isAmbiguous).toBe(true);
    expect(result.plan).toBeNull();
    expect(result.error).toContain('belirli bir metrik veya varlık');
  });

  it('should mark query as ambiguous if too many conflicting metrics are detected', () => {
    const result = resolveSemanticQuery('Satış tahsilat risk stok penetrasyon hepsini getir');
    expect(result.isAmbiguous).toBe(true);
    expect(result.plan).toBeNull();
    expect(result.error).toContain('Sorgu birden fazla farklı finansal ve operasyonel metrik içeriyor');
  });
});
