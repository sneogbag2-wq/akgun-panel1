import { normalizeComparisonText } from './customerMasterContract.js';

const DEFAULT_STATUS_ALIASES = new Map([
  ['aktif', 'ACTIVE'], ['aktif (a)', 'ACTIVE'], ['active', 'ACTIVE'],
  ['pasif', 'PASSIVE'], ['pasif (p)', 'PASSIVE'], ['passive', 'PASSIVE'],
  ['iptal', 'CANCELLED'], ['iptal (c)', 'CANCELLED'], ['iptal edildi', 'CANCELLED'], ['cancelled', 'CANCELLED'],
]);

export function resolveCustomerStatus(rows, aliases = DEFAULT_STATUS_ALIASES) {
  const values = rows.map((row) => aliases.get(normalizeComparisonText(row.parsedPayload?.customerStatus)) ?? 'UNKNOWN');
  const unique = [...new Set(values)];
  const status = unique.includes('ACTIVE') ? 'ACTIVE'
    : unique.includes('PASSIVE') ? 'PASSIVE'
      : unique.length > 0 && unique.every((value) => value === 'CANCELLED') ? 'CANCELLED'
        : 'UNKNOWN';
  return Object.freeze({
    status,
    rawDistribution: Object.freeze(Object.fromEntries(unique.map((value) => [value, values.filter((item) => item === value).length]))),
    issues: Object.freeze(unique.includes('UNKNOWN') ? ['UNKNOWN_CUSTOMER_STATUS'] : []),
  });
}
