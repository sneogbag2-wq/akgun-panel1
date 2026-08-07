import { decimalFraction, fractionFromText, fractionText, propagateLitreAnchor } from './productGraphResolver.js';

const precedence = Object.freeze(['SELLOUT', 'KA', 'PACKAGE_PROPAGATED', 'CATALOG', 'MANUAL']);
function candidateFromEvidence(evidence) {
  if (!evidence || !precedence.includes(evidence.kind) || evidence.positiveRowCount < 1) return null;
  try { return Object.freeze({ kind: evidence.kind, materialCode: evidence.materialCode, value: evidence.sumLitres ? evidenceLpu(evidence) : fractionText(fractionFromText(evidence.litresPerStockUnit)), positiveRowCount: evidence.positiveRowCount, verificationStatus: evidence.positiveRowCount === 1 ? 'OBSERVED_LOW_EVIDENCE' : 'VERIFIED' }); } catch { return null; }
}
function evidenceLpu(evidence) {
  const litres = decimalFraction(evidence.sumLitres); const quantity = decimalFraction(evidence.sumQuantity);
  return fractionText(fractionFromText(`${litres.numerator * quantity.denominator}/${litres.denominator * quantity.numerator}`));
}
export function resolveProductLitres({ evidence = [], graph }) {
  const candidates = evidence.map((item) => ({ ...item, value: item.sumLitres ? evidenceLpu(item) : item.litresPerStockUnit })).map(candidateFromEvidence).filter(Boolean);
  const byMaterial = new Map(); for (const candidate of candidates) byMaterial.set(candidate.materialCode, [...(byMaterial.get(candidate.materialCode) ?? []), candidate]);
  const selected = {}; const issues = [];
  for (const [materialCode, choices] of byMaterial) {
    choices.sort((left, right) => precedence.indexOf(left.kind) - precedence.indexOf(right.kind));
    const preferred = choices[0]; const conflicts = choices.filter((candidate) => candidate.value !== preferred.value);
    if (conflicts.length) { issues.push({ code: 'LITRE_SOURCE_CONFLICT', materialCode, candidates: choices.map((item) => ({ kind: item.kind, value: item.value })) }); continue; }
    selected[materialCode] = preferred;
  }
  for (const [materialCode, candidate] of Object.entries(selected)) {
    if (!graph?.components?.some((component) => component.nodes.includes(materialCode))) continue;
    const propagation = propagateLitreAnchor({ graph, anchorMaterialCode: materialCode, litresPerStockUnit: candidate.value });
    for (const [target, value] of Object.entries(propagation.values)) if (!selected[target]) selected[target] = { kind: 'PACKAGE_PROPAGATED', value, verificationStatus: 'VERIFIED', propagatedFrom: materialCode };
  }
  for (const component of graph?.components ?? []) if (!component.nodes.some((code) => selected[code])) issues.push({ code: 'MISSING_LITRE_ANCHOR', materialCodes: component.nodes });
  return Object.freeze({ candidates: Object.freeze(candidates), selected: Object.freeze(selected), issues: Object.freeze(issues), coverage: Object.freeze({ resolvedVariantCount: Object.keys(selected).length, componentCount: graph?.components?.length ?? 0 }) });
}
