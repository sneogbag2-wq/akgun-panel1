import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selloutImportService } from '../selloutImportService';

describe('selloutImportService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exports parse, validate, publish, and uploadAndPreview methods', () => {
    expect(typeof selloutImportService.parse).toBe('function');
    expect(typeof selloutImportService.validate).toBe('function');
    expect(typeof selloutImportService.publish).toBe('function');
    expect(typeof selloutImportService.uploadAndPreview).toBe('function');
  });

  it('throws error when token is empty', async () => {
    await expect(selloutImportService.parse('batch-1', '')).rejects.toThrow('Sellout yüklemesi için yetkili v2 oturumu gerekli.');
  });
});
