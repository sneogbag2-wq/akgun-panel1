import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAiDiagnostics, getAiDiagnostics, recordAiDiagnostic } from '../aiDiagnostics';

describe('AI diagnostics', () => {
  afterEach(() => {
    clearAiDiagnostics();
  });

  it('stores only the anonymous diagnostic schema', () => {
    recordAiDiagnostic({
      id: 'ai_test',
      createdAt: '2026-08-04T00:00:00.000Z',
      intent: 'CUSTOMER',
      selectedTools: ['searchCustomers'],
      executedTools: [{ toolName: 'searchCustomers', durationMs: 12, resultSizeBytes: 99, status: 'SUCCESS' }],
      requestDurationMs: 35,
      modelOutcome: 'TEXT',
      modelFinishReason: 'STOP',
      followedByToolCall: false,
      fallbackReason: null,
      responseLength: 120,
      modelAttempts: 1,
      // @ts-expect-error The public diagnostic schema deliberately rejects user content.
      userMessage: 'Müşteri adı veya bakiyesi burada saklanmamalı'
    });

    const entry = JSON.parse(JSON.stringify(getAiDiagnostics()[0])) as Record<string, unknown>;
    expect(entry).not.toHaveProperty('userMessage');
    expect(JSON.stringify(entry)).not.toContain('Müşteri adı');
    expect(entry.selectedTools).toEqual(['searchCustomers']);
  });

  it('does not persist diagnostics outside development mode', () => {
    vi.stubEnv('DEV', false);
    recordAiDiagnostic({
      id: 'production_test', createdAt: '2026-08-04T00:00:00.000Z', intent: 'GENERAL', selectedTools: [], executedTools: [],
      requestDurationMs: 1, modelOutcome: 'TEXT', modelFinishReason: 'STOP', followedByToolCall: false,
      fallbackReason: null, responseLength: 1, modelAttempts: 1
    });
    expect(getAiDiagnostics()).toEqual([]);
    vi.unstubAllEnvs();
  });
});
