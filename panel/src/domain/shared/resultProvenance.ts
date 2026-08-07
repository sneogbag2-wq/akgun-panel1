import type { RuleVersionRef } from './ruleVersionRef';
import type { SourceRef } from './sourceRef';

export interface ResultProvenance {
  readonly calculationRunId: string;
  readonly sourceRefs: readonly SourceRef[];
  readonly ruleVersions: readonly RuleVersionRef[];
  readonly calculatedAt: string;
  readonly coverage?: Readonly<Record<string, unknown>>;
  readonly exclusions?: readonly string[];
}

const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function requireText(value: string, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`ResultProvenance.${fieldName} boş olmayan metin olmalıdır.`);
  }

  return value.trim();
}

function requireIsoDateTime(value: string): string {
  const normalized = requireText(value, 'calculatedAt');
  if (!ISO_DATE_TIME_PATTERN.test(normalized) || Number.isNaN(Date.parse(normalized))) {
    throw new TypeError('ResultProvenance.calculatedAt geçerli ISO tarih/saat olmalıdır.');
  }

  return normalized;
}

export function createResultProvenance(input: ResultProvenance): ResultProvenance {
  if (!Array.isArray(input.sourceRefs) || input.sourceRefs.length === 0) {
    throw new TypeError('ResultProvenance en az bir SourceRef taşımalıdır.');
  }
  if (!Array.isArray(input.ruleVersions) || input.ruleVersions.length === 0) {
    throw new TypeError('ResultProvenance en az bir RuleVersionRef taşımalıdır.');
  }
  if (input.exclusions !== undefined && !Array.isArray(input.exclusions)) {
    throw new TypeError('ResultProvenance.exclusions dizi olmalıdır.');
  }

  return {
    calculationRunId: requireText(input.calculationRunId, 'calculationRunId'),
    sourceRefs: [...input.sourceRefs],
    ruleVersions: [...input.ruleVersions],
    calculatedAt: requireIsoDateTime(input.calculatedAt),
    ...(input.coverage === undefined ? {} : { coverage: { ...input.coverage } }),
    ...(input.exclusions === undefined ? {} : {
      exclusions: input.exclusions.map((exclusion) => requireText(exclusion, 'exclusions'))
    })
  };
}
