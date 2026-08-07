import { normalizeComparisonText } from './customerMasterContract.js';

export function resolveCustomerRep(rows) {
  const candidates = [...new Set(rows.map((row) => normalizeComparisonText(row.parsedPayload?.salesRep)).filter(Boolean))];
  if (candidates.length === 1) return Object.freeze({ repName: candidates[0], resolutionState: 'RESOLVED', issues: Object.freeze([]) });
  return Object.freeze({
    repName: null,
    resolutionState: candidates.length === 0 ? 'UNASSIGNED' : 'REVIEW_REQUIRED',
    issues: Object.freeze([candidates.length === 0 ? 'CUSTOMER_UNASSIGNED_TO_REP' : 'CUSTOMER_REP_CONFLICT']),
  });
}

export function resolveRepSsm(activeCustomerRows) {
  const customers = new Map();
  for (const { customerCode, rows } of activeCustomerRows) {
    const candidates = [...new Set(rows.map((row) => normalizeComparisonText(row.parsedPayload?.distSalesChief)).filter(Boolean))];
    if (candidates.length) customers.set(customerCode, candidates);
  }
  const denominator = customers.size;
  const counts = new Map();
  for (const candidates of customers.values()) {
    for (const candidate of candidates) counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort(([leftName, leftCount], [rightName, rightCount]) => rightCount - leftCount || leftName.localeCompare(rightName, 'tr'));
  const [ssmName, numerator] = ranked[0] ?? [null, 0];
  const ties = ranked.filter(([, count]) => count === numerator).length;
  const dominantRatio = denominator === 0 ? null : numerator / denominator;
  const resolved = denominator > 0 && dominantRatio >= 0.9 && ties === 1;
  return Object.freeze({
    ssmName: resolved ? ssmName : null,
    numerator,
    denominator,
    dominantRatio,
    resolutionState: resolved ? 'RESOLVED' : 'REVIEW_REQUIRED',
    issues: Object.freeze(resolved ? [] : [denominator === 0 ? 'REP_WITHOUT_ACTIVE_CUSTOMER' : 'REP_SSM_DOMINANCE_BELOW_THRESHOLD']),
  });
}
