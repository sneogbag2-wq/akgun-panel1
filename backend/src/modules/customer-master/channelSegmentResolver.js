import { normalizeComparisonText } from './customerMasterContract.js';

const CHANNEL_ALIASES = new Map([
  ['standart açık', 'OPEN'], ['horeca', 'OPEN'], ['otel', 'OPEN'],
  ['standart kapalı', 'CLOSED'], ['ekomini', 'CLOSED'],
]);

export function resolveChannel(rows, aliases = CHANNEL_ALIASES) {
  const values = [...new Set(rows.map((row) => aliases.get(normalizeComparisonText(row.parsedPayload?.channel)) ?? 'UNCLASSIFIED'))];
  const conflict = values.includes('OPEN') && values.includes('CLOSED');
  return Object.freeze({
    channel: conflict ? 'UNCLASSIFIED' : values[0] ?? 'UNCLASSIFIED',
    resolutionState: conflict ? 'REVIEW_REQUIRED' : values[0] === 'UNCLASSIFIED' ? 'UNRESOLVED' : 'RESOLVED',
    issues: Object.freeze(conflict ? ['CHANNEL_CONFLICT'] : values.includes('UNCLASSIFIED') ? ['CHANNEL_UNCLASSIFIED'] : []),
  });
}

export function resolveSegment(rows) {
  const values = [...new Set(rows.map((row) => normalizeComparisonText(row.parsedPayload?.segment)).filter(Boolean))];
  if (values.length === 1) return Object.freeze({ segment: values[0], resolutionState: 'RESOLVED', issues: Object.freeze([]) });
  return Object.freeze({
    segment: 'UNCLASSIFIED_SEGMENT',
    resolutionState: values.length === 0 ? 'UNRESOLVED' : 'REVIEW_REQUIRED',
    issues: Object.freeze(values.length > 1 ? ['SEGMENT_CONFLICT'] : []),
  });
}
