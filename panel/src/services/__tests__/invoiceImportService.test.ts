import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoiceImportService } from '../invoiceImportService';

describe('invoiceImportService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exports parse, validate, publish, and uploadAndPreview methods', () => {
    expect(typeof invoiceImportService.parse).toBe('function');
    expect(typeof invoiceImportService.validate).toBe('function');
    expect(typeof invoiceImportService.publish).toBe('function');
    expect(typeof invoiceImportService.uploadAndPreview).toBe('function');
  });

  it('throws error when token is empty', async () => {
    await expect(invoiceImportService.parse('batch-1', '')).rejects.toThrow('Fatura yüklemesi için yetkili v2 oturumu gerekli.');
  });
});
