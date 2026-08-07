import { describe, it, expect, vi } from 'vitest';
import { buildSystemPrompt } from '../aiContext';
import * as customerService from '../customerService';

// Mock customerService to avoid reading IndexedDB during tests
vi.mock('../customerService', () => ({
  getGlobalFinancialSummarySync: vi.fn(() => ({})),
  getCurrentMonthMetricsSync: vi.fn(() => ({})),
  getMonthlySalesRepPerformanceSync: vi.fn(() => ({})),
  getActiveCustomerCountSync: vi.fn(() => 0),
  isUsingSeedData: vi.fn(() => true),
  formatCurrency: vi.fn((val) => `₺${val}`)
}));

describe('aiContext - buildSystemPrompt', () => {
  it('should return default CFO prompt without specific JSON rules if no role is provided', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('CFO düzeyinde');
    expect(prompt).not.toContain('ZORUNLU JSON ÇIKTI YAPISI (EXTRACT)');
    expect(prompt).not.toContain('ZORUNLU JSON ÇIKTI YAPISI (REPORT)');
  });

  it('should include EXTRACT JSON rules when role is EXTRACT', () => {
    const prompt = buildSystemPrompt('EXTRACT');
    expect(prompt).toContain('ZORUNLU JSON ÇIKTI YAPISI (EXTRACT)');
    expect(prompt).toContain('SemanticQueryPlan');
  });

  it('should include REPORT JSON rules when role is REPORT', () => {
    const prompt = buildSystemPrompt('REPORT');
    expect(prompt).toContain('ZORUNLU JSON ÇIKTI YAPISI (REPORT)');
    expect(prompt).toContain('AiAnalysisClaim');
  });
});
