import { describe, it, expect, vi, beforeEach } from 'vitest';
import { purchaseImportService } from '../purchaseImportService';
import { paymentImportService } from '../paymentImportService';
import { chequeImportService } from '../chequeImportService';
import { dispatchImportService } from '../dispatchImportService';

describe('Remaining Import Pipeline Services (Faz 4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('purchaseImportService exports parse, validate, publish, uploadAndPreview', () => {
    expect(typeof purchaseImportService.parse).toBe('function');
    expect(typeof purchaseImportService.validate).toBe('function');
    expect(typeof purchaseImportService.publish).toBe('function');
    expect(typeof purchaseImportService.uploadAndPreview).toBe('function');
  });

  it('paymentImportService exports parse, validate, publish, uploadAndPreview', () => {
    expect(typeof paymentImportService.parse).toBe('function');
    expect(typeof paymentImportService.validate).toBe('function');
    expect(typeof paymentImportService.publish).toBe('function');
    expect(typeof paymentImportService.uploadAndPreview).toBe('function');
  });

  it('chequeImportService exports parse, validate, publish, uploadAndPreview', () => {
    expect(typeof chequeImportService.parse).toBe('function');
    expect(typeof chequeImportService.validate).toBe('function');
    expect(typeof chequeImportService.publish).toBe('function');
    expect(typeof chequeImportService.uploadAndPreview).toBe('function');
  });

  it('dispatchImportService exports parse, validate, publish, uploadAndPreview', () => {
    expect(typeof dispatchImportService.parse).toBe('function');
    expect(typeof dispatchImportService.validate).toBe('function');
    expect(typeof dispatchImportService.publish).toBe('function');
    expect(typeof dispatchImportService.uploadAndPreview).toBe('function');
  });

  it('all services throw error when token is missing', async () => {
    await expect(purchaseImportService.parse('b1', '')).rejects.toThrow();
    await expect(paymentImportService.parse('b1', '')).rejects.toThrow();
    await expect(chequeImportService.parse('b1', '')).rejects.toThrow();
    await expect(dispatchImportService.parse('b1', '')).rejects.toThrow();
  });
});
