import { cleanSourceText, normalizeComparisonText } from './customerMasterContract.js';

function uniqueNormalizedValues(rows, field) {
  const values = new Map();
  for (const row of rows) {
    const raw = cleanSourceText(row.parsedPayload?.[field]);
    const normalized = normalizeComparisonText(raw);
    if (normalized && !values.has(normalized)) values.set(normalized, raw);
  }
  return values;
}

export function resolveProfile(rows) {
  const fields = ['customerName', 'storeName'];
  const profile = {};
  const provenance = {};
  let partial = false;
  for (const field of fields) {
    const values = uniqueNormalizedValues(rows, field);
    provenance[field] = [...values.values()];
    if (values.size === 1) profile[field] = [...values.values()][0];
    if (values.size > 1) partial = true;
  }
  return Object.freeze({
    resolutionState: partial ? 'PARTIAL' : 'RESOLVED',
    profile: Object.freeze(profile),
    provenance: Object.freeze(provenance),
    issues: Object.freeze(partial ? ['PROFILE_FIELD_CONFLICT'] : []),
  });
}
