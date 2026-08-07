import { describe, expect, it } from 'vitest';
import {
  createCustomerId,
  createDocumentId,
  createInvoiceNo,
  createProductCode,
  createSalesDocumentNo,
  createSourceRowId
} from '../identity';

describe('P00-ID — branded text identities', () => {
  it('trims but preserves leading zeroes and long identifiers', () => {
    expect(createCustomerId(' 5000000001 ')).toBe('5000000001');
    expect(createDocumentId(' 0000123 ')).toBe('0000123');
    expect(createInvoiceNo('100000000000001')).toBe('100000000000001');
    expect(createSalesDocumentNo('000000000000000123')).toBe('000000000000000123');
  });

  it('creates every Package 00 identity family from text only', () => {
    expect(createProductCode('ANON-PRD-0001')).toBe('ANON-PRD-0001');
    expect(createSourceRowId('row-0007')).toBe('row-0007');
  });

  it('rejects blank, whitespace and non-text identities without numeric conversion', () => {
    expect(() => createCustomerId('')).toThrow();
    expect(() => createDocumentId('   ')).toThrow();
    expect(() => createProductCode(500001 as unknown as string)).toThrow();
  });
});
