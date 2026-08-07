import test from 'node:test';
import assert from 'node:assert/strict';
import { anonymousMeasurementEvidence, anonymousPackageConversions } from '../../../test/anonymousProductFixtures.js';
import { decimalFraction, fractionText, propagateLitreAnchor, resolveProductGraph } from '../productGraphResolver.js';
import { resolveProductLitres } from '../productLitreResolver.js';
import { productSemanticDescriptor } from '../productSemanticDescriptor.js';

test('exact rational conversion graph preserves 4, 2 and 0.25 relationships without float drift', () => {
  const graph = resolveProductGraph(anonymousPackageConversions);
  assert.equal(graph.issues.length, 0);
  assert.equal(graph.components.length, 2);
  const values = propagateLitreAnchor({ graph, anchorMaterialCode: 'A100', litresPerStockUnit: '20' }).values;
  assert.equal(values.A100, '20');
  assert.equal(values.A100_6, '5');
  assert.equal(values.A100_12, '10');
  const second = propagateLitreAnchor({ graph, anchorMaterialCode: 'B200_6', litresPerStockUnit: '3' }).values;
  assert.equal(second.B200, '12');
  assert.equal(second.B200_SINGLE, '12');
  assert.equal(fractionText(decimalFraction('0.25')), '1/4');
});

test('self edge, pair ratio conflict, inconsistent multi-path and inconsistent cycle are explicit product issues', () => {
  const graph = resolveProductGraph([
    { sourceMaterialCode: 'X', sourceQuantity: '1', targetMaterialCode: 'X', targetQuantity: '1' },
    { sourceMaterialCode: 'A', sourceQuantity: '1', targetMaterialCode: 'B', targetQuantity: '4' },
    { sourceMaterialCode: 'A', sourceQuantity: '1', targetMaterialCode: 'B', targetQuantity: '2' },
    { sourceMaterialCode: 'B', sourceQuantity: '1', targetMaterialCode: 'C', targetQuantity: '2' },
    { sourceMaterialCode: 'A', sourceQuantity: '1', targetMaterialCode: 'C', targetQuantity: '3' },
  ]);
  assert.ok(graph.issues.some((issue) => issue.code === 'SELF_CONVERSION_EDGE'));
  assert.ok(graph.issues.some((issue) => issue.code === 'CONVERSION_RATIO_CONFLICT'));
  assert.ok(graph.issues.some((issue) => issue.code === 'MULTI_PATH_RATIO_CONFLICT'));
  const cycle = resolveProductGraph([
    { sourceMaterialCode: 'D', sourceQuantity: '1', targetMaterialCode: 'E', targetQuantity: '2' },
    { sourceMaterialCode: 'E', sourceQuantity: '1', targetMaterialCode: 'F', targetQuantity: '2' },
    { sourceMaterialCode: 'F', sourceQuantity: '1', targetMaterialCode: 'D', targetQuantity: '2' },
  ]);
  assert.ok(cycle.issues.some((issue) => issue.code === 'CONVERSION_CYCLE_INCONSISTENT'));
});

test('official litre evidence uses sum litres divided by sum quantity, not an arithmetic mean of row ratios', () => {
  const graph = resolveProductGraph(anonymousPackageConversions);
  const result = resolveProductLitres({ evidence: anonymousMeasurementEvidence, graph });
  assert.equal(result.selected.A100.value, '20');
  assert.equal(result.selected.A100_6.value, '5');
  assert.equal(result.selected.A100_12.value, '10');
  assert.equal(result.issues.some((issue) => issue.code === 'LITRE_SOURCE_CONFLICT'), false);
});

test('conflicting higher priority evidence is not silently replaced by a lower priority source', () => {
  const graph = resolveProductGraph(anonymousPackageConversions);
  const result = resolveProductLitres({ evidence: [
    { kind: 'SELLOUT', materialCode: 'A100', sumQuantity: '2', sumLitres: '40', positiveRowCount: 2 },
    { kind: 'KA', materialCode: 'A100', sumQuantity: '2', sumLitres: '42', positiveRowCount: 2 },
  ], graph });
  assert.equal(result.selected.A100, undefined);
  assert.ok(result.issues.some((issue) => issue.code === 'LITRE_SOURCE_CONFLICT'));
});

test('an anchorless component remains a family candidate but is marked missing litre anchor', () => {
  const graph = resolveProductGraph(anonymousPackageConversions);
  const result = resolveProductLitres({ evidence: [], graph });
  assert.equal(result.coverage.resolvedVariantCount, 0);
  assert.equal(result.issues.filter((issue) => issue.code === 'MISSING_LITRE_ANCHOR').length, 2);
});

test('semantic descriptor separates family and variant and does not declare a live AI route', () => {
  assert.ok(productSemanticDescriptor.tools.includes('resolve_product_scope'));
  assert.equal(productSemanticDescriptor.prohibitions.includes('NO_NAME_DERIVED_LITRE'), true);
  assert.equal(productSemanticDescriptor.entities[0].ambiguity, 'VARIANT_OR_FAMILY_REVIEW');
});
