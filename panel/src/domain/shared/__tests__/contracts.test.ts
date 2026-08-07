import { describe, expect, it } from 'vitest';
import { createCalculationStatus } from '../calculationStatus';
import { createResultProvenance } from '../resultProvenance';
import { createRuleVersionRef } from '../ruleVersionRef';
import { createSourceRef } from '../sourceRef';
import { createValidationIssue } from '../validationIssue';

const sourceRef = createSourceRef({
  sourceFileId: 'anon-source-file-001',
  importBatchId: 'anon-import-batch-001',
  sheetName: 'ANONIM_SAYFA',
  sourceRowNumber: 7,
  sourceRecordKey: '0000123'
});

const ruleVersion = createRuleVersionRef({
  ruleId: 'P00-CONTRACT-001',
  version: '1.0.0',
  effectiveFrom: '2026-08-05T00:00:00.000Z'
});

describe('P00-CON — shared provenance and validation contracts', () => {
  it('validates a one-based source reference and immutable source key', () => {
    expect(sourceRef.sourceRowNumber).toBe(7);
    expect(sourceRef.sourceRecordKey).toBe('0000123');
    expect(() => createSourceRef({ ...sourceRef, sourceRowNumber: 0 })).toThrow();
    expect(() => createSourceRef({ ...sourceRef, sourceRowNumber: 1.5 })).toThrow();
  });

  it('enforces the blocking publication invariant', () => {
    const issue = createValidationIssue({
      ruleId: 'P00-CONTRACT-002',
      severity: 'BLOCKING',
      sourceRefs: [sourceRef],
      affectedFields: ['customerId'],
      messageKey: 'customer.required',
      blocksPublication: true
    });

    expect(issue.blocksPublication).toBe(true);
    expect(() => createValidationIssue({ ...issue, blocksPublication: false })).toThrow();
  });

  it('keeps rule time ranges and calculation reasons explicit', () => {
    expect(() => createRuleVersionRef({
      ...ruleVersion,
      effectiveTo: '2026-08-04T23:59:59.000Z'
    })).toThrow();
    expect(createCalculationStatus('VALID')).toEqual({ status: 'VALID' });
    expect(createCalculationStatus('PARTIAL', 'SOURCE_COVERAGE_INCOMPLETE')).toEqual({
      status: 'PARTIAL',
      reasonCode: 'SOURCE_COVERAGE_INCOMPLETE'
    });
    expect(() => createCalculationStatus('FAILED')).toThrow();
    expect(() => createCalculationStatus('VALID', 'UNEXPECTED')).toThrow();
  });

  it('requires source and rule provenance without calculating a metric', () => {
    const provenance = createResultProvenance({
      calculationRunId: 'run-p00-anon-001',
      sourceRefs: [sourceRef],
      ruleVersions: [ruleVersion],
      calculatedAt: '2026-08-05T00:01:00.000Z',
      coverage: { status: 'PARTIAL' },
      exclusions: ['ANON_EXCLUDED_ROW']
    });

    expect(provenance.sourceRefs).toHaveLength(1);
    expect(provenance.ruleVersions).toHaveLength(1);
    expect(() => createResultProvenance({ ...provenance, sourceRefs: [] })).toThrow();
    expect(() => createResultProvenance({ ...provenance, ruleVersions: [] })).toThrow();
  });
});
