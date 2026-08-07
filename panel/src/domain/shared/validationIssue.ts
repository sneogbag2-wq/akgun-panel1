import type { SourceRef } from './sourceRef';

export const VALIDATION_SEVERITIES = ['INFO', 'WARNING', 'ERROR', 'BLOCKING'] as const;
export type ValidationSeverity = (typeof VALIDATION_SEVERITIES)[number];

export interface ValidationIssue {
  readonly ruleId: string;
  readonly severity: ValidationSeverity;
  readonly sourceRefs: readonly SourceRef[];
  readonly affectedFields: readonly string[];
  readonly messageKey: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly blocksPublication: boolean;
}

function requireText(value: string, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`ValidationIssue.${fieldName} boş olmayan metin olmalıdır.`);
  }

  return value.trim();
}

export function createValidationIssue(input: ValidationIssue): ValidationIssue {
  if (!VALIDATION_SEVERITIES.includes(input.severity)) {
    throw new TypeError('ValidationIssue.severity geçersiz.');
  }
  if (!Array.isArray(input.sourceRefs) || input.sourceRefs.length === 0) {
    throw new TypeError('ValidationIssue en az bir SourceRef taşımalıdır.');
  }
  if (!Array.isArray(input.affectedFields)) {
    throw new TypeError('ValidationIssue.affectedFields dizi olmalıdır.');
  }
  if (typeof input.blocksPublication !== 'boolean') {
    throw new TypeError('ValidationIssue.blocksPublication açık boolean olmalıdır.');
  }
  if (input.severity === 'BLOCKING' && !input.blocksPublication) {
    throw new TypeError('BLOCKING ValidationIssue yayınlamayı engellemelidir.');
  }

  return {
    ...input,
    ruleId: requireText(input.ruleId, 'ruleId'),
    sourceRefs: [...input.sourceRefs],
    affectedFields: input.affectedFields.map((field) => requireText(field, 'affectedFields')),
    messageKey: requireText(input.messageKey, 'messageKey'),
    ...(input.details === undefined ? {} : { details: { ...input.details } })
  };
}
