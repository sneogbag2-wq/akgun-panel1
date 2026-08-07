export const CALCULATION_STATUS_CODES = ['NOT_RUN', 'VALID', 'PARTIAL', 'BLOCKED', 'FAILED'] as const;
export type CalculationStatusCode = (typeof CALCULATION_STATUS_CODES)[number];

export type CalculationStatus =
  | { readonly status: 'NOT_RUN'; readonly reasonCode?: never }
  | { readonly status: 'VALID'; readonly reasonCode?: never }
  | { readonly status: 'PARTIAL'; readonly reasonCode: string }
  | { readonly status: 'BLOCKED'; readonly reasonCode: string }
  | { readonly status: 'FAILED'; readonly reasonCode: string };

function requireReasonCode(reasonCode: string | undefined): string {
  if (typeof reasonCode !== 'string' || !reasonCode.trim()) {
    throw new TypeError('PARTIAL, BLOCKED ve FAILED CalculationStatus için reasonCode zorunludur.');
  }

  return reasonCode.trim();
}

export function createCalculationStatus(
  status: CalculationStatusCode,
  reasonCode?: string
): CalculationStatus {
  if (!CALCULATION_STATUS_CODES.includes(status)) {
    throw new TypeError('CalculationStatus geçersiz.');
  }

  if (status === 'PARTIAL' || status === 'BLOCKED' || status === 'FAILED') {
    return { status, reasonCode: requireReasonCode(reasonCode) };
  }

  if (reasonCode !== undefined) {
    throw new TypeError(`${status} CalculationStatus için reasonCode verilemez.`);
  }

  return { status };
}
