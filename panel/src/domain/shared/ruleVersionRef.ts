export interface RuleVersionRef {
  readonly ruleId: string;
  readonly version: string;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
}

const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function requireText(value: string, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`RuleVersionRef.${fieldName} boş olmayan metin olmalıdır.`);
  }

  return value.trim();
}

function requireIsoDateTime(value: string, fieldName: string): string {
  const normalized = requireText(value, fieldName);
  if (!ISO_DATE_TIME_PATTERN.test(normalized) || Number.isNaN(Date.parse(normalized))) {
    throw new TypeError(`RuleVersionRef.${fieldName} geçerli ISO tarih/saat olmalıdır.`);
  }

  return normalized;
}

export function createRuleVersionRef(input: RuleVersionRef): RuleVersionRef {
  const effectiveFrom = requireIsoDateTime(input.effectiveFrom, 'effectiveFrom');
  const effectiveTo = input.effectiveTo === undefined
    ? undefined
    : requireIsoDateTime(input.effectiveTo, 'effectiveTo');

  if (effectiveTo !== undefined && Date.parse(effectiveTo) < Date.parse(effectiveFrom)) {
    throw new RangeError('RuleVersionRef.effectiveTo effectiveFrom değerinden önce olamaz.');
  }

  return {
    ruleId: requireText(input.ruleId, 'ruleId'),
    version: requireText(input.version, 'version'),
    effectiveFrom,
    ...(effectiveTo === undefined ? {} : { effectiveTo })
  };
}
