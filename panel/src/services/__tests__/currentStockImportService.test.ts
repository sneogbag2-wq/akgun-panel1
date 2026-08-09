import { describe, it, expect, vi, beforeEach } from 'vitest';
import { currentStockImportService } from '../currentStockImportService';

describe('currentStockImportService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exports parse, validate, publish, and uploadAndPreview methods', () => {
    expect(typeof currentStockImportService.parse).toBe('function');
    expect(typeof currentStockImportService.validate).toBe('function');
    expect(typeof currentStockImportService.publish).toBe('function');
    expect(typeof currentStockImportService.uploadAndPreview).toBe('function');
  });

  it('throws error when token is empty', async () => {
    await expect(currentStockImportService.parse('batch-1', '')).rejects.toThrow('Stok yüklemesi için yetkili v2 oturumu gerekli.');
  });
});
