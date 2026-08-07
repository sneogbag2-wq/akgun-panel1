import { ProductContractError } from './productContract.js';

const abs = (value) => value < 0n ? -value : value;
function gcd(left, right) { let a = abs(left); let b = abs(right); while (b) [a, b] = [b, a % b]; return a || 1n; }
function fraction(numerator, denominator = 1n) {
  if (denominator === 0n) throw new ProductContractError('INVALID_CONVERSION_QUANTITY', 'products.graph.zeroDenominator');
  const sign = denominator < 0n ? -1n : 1n; const divisor = gcd(numerator, denominator);
  return Object.freeze({ numerator: (numerator / divisor) * sign, denominator: abs(denominator / divisor) });
}
export function decimalFraction(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(value)) throw new ProductContractError('INVALID_DECIMAL', 'products.graph.invalidDecimal');
  const [whole, decimal = ''] = value.split('.'); const scale = 10n ** BigInt(decimal.length);
  return fraction(BigInt(`${whole}${decimal}`), scale);
}
export function fractionFromText(value) {
  if (typeof value !== 'string') throw new ProductContractError('INVALID_DECIMAL', 'products.graph.invalidDecimal');
  if (value.includes('/')) {
    const [numerator, denominator, extra] = value.split('/');
    if (extra !== undefined || !/^-?[0-9]+$/u.test(numerator) || !/^[1-9][0-9]*$/u.test(denominator)) throw new ProductContractError('INVALID_DECIMAL', 'products.graph.invalidDecimal');
    return fraction(BigInt(numerator), BigInt(denominator));
  }
  return decimalFraction(value);
}
const multiply = (left, right) => fraction(left.numerator * right.numerator, left.denominator * right.denominator);
const divide = (left, right) => fraction(left.numerator * right.denominator, left.denominator * right.numerator);
const equals = (left, right) => left.numerator === right.numerator && left.denominator === right.denominator;
export function fractionText(value) { return value.denominator === 1n ? value.numerator.toString() : `${value.numerator.toString()}/${value.denominator.toString()}`; }

function conversionEdge(edge) {
  if (!edge || typeof edge.sourceMaterialCode !== 'string' || typeof edge.targetMaterialCode !== 'string' || !edge.sourceMaterialCode || !edge.targetMaterialCode) throw new ProductContractError('INVALID_MATERIAL_CODE', 'products.graph.invalidMaterialCode');
  if (edge.sourceMaterialCode === edge.targetMaterialCode) return { issue: 'SELF_CONVERSION_EDGE', edge };
  const sourceQuantity = decimalFraction(edge.sourceQuantity); const targetQuantity = decimalFraction(edge.targetQuantity);
  return { ...edge, ratio: divide(targetQuantity, sourceQuantity) };
}

export function resolveProductGraph(inputEdges) {
  const issues = []; const adjacency = new Map(); const directed = new Map(); const uniqueEdges = new Map();
  for (const rawEdge of inputEdges) {
    let edge; try { edge = conversionEdge(rawEdge); } catch (error) { issues.push({ code: error.code ?? 'INVALID_CONVERSION_QUANTITY', edge: rawEdge }); continue; }
    if (edge.issue) { issues.push({ code: edge.issue, edge: rawEdge }); continue; }
    const pair = `${edge.sourceMaterialCode}\u0000${edge.targetMaterialCode}`; const existing = uniqueEdges.get(pair);
    if (existing && !equals(existing.ratio, edge.ratio)) { issues.push({ code: 'CONVERSION_RATIO_CONFLICT', edge: rawEdge }); continue; }
    if (existing) continue; uniqueEdges.set(pair, edge);
    directed.set(edge.sourceMaterialCode, [...(directed.get(edge.sourceMaterialCode) ?? []), edge]);
    const add = (from, to, lpuFactor) => adjacency.set(from, [...(adjacency.get(from) ?? []), { to, lpuFactor, edge }]);
    // target LPU = source LPU / (target units per source unit).
    add(edge.sourceMaterialCode, edge.targetMaterialCode, divide(fraction(1n), edge.ratio));
    add(edge.targetMaterialCode, edge.sourceMaterialCode, edge.ratio);
  }
  const directedVisited = new Set();
  const visitDirected = (materialCode, ratioFromRoot, stack, pathRatios) => {
    directedVisited.add(materialCode); stack.add(materialCode); pathRatios.set(materialCode, ratioFromRoot);
    for (const next of directed.get(materialCode) ?? []) {
      const candidate = multiply(ratioFromRoot, next.ratio);
      if (stack.has(next.targetMaterialCode)) {
        if (!equals(candidate, pathRatios.get(next.targetMaterialCode))) issues.push({ code: 'CONVERSION_CYCLE_INCONSISTENT', edge: next, cycleStart: next.targetMaterialCode });
      } else if (!directedVisited.has(next.targetMaterialCode)) visitDirected(next.targetMaterialCode, candidate, stack, pathRatios);
    }
    stack.delete(materialCode); pathRatios.delete(materialCode);
  };
  for (const materialCode of directed.keys()) if (!directedVisited.has(materialCode)) visitDirected(materialCode, fraction(1n), new Set(), new Map());
  const visited = new Set(); const components = [];
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;
    const values = new Map([[start, fraction(1n)]]); const queue = [start]; const nodes = [];
    while (queue.length) {
      const node = queue.shift(); if (visited.has(node)) continue; visited.add(node); nodes.push(node);
      for (const link of adjacency.get(node) ?? []) {
        const candidate = multiply(values.get(node), link.lpuFactor);
        if (values.has(link.to) && !equals(values.get(link.to), candidate)) issues.push({ code: link.to === start ? 'CONVERSION_CYCLE_INCONSISTENT' : 'MULTI_PATH_RATIO_CONFLICT', componentStart: start, edge: link.edge });
        else if (!values.has(link.to)) { values.set(link.to, candidate); queue.push(link.to); }
      }
    }
    const componentEdges = [...uniqueEdges.values()].filter((edge) => nodes.includes(edge.sourceMaterialCode) && nodes.includes(edge.targetMaterialCode));
    components.push(Object.freeze({ nodes: Object.freeze(nodes.sort()), edges: Object.freeze(componentEdges), lpuFactorsFromRoot: Object.freeze(Object.fromEntries([...values].map(([code, value]) => [code, fractionText(value)]))) }));
  }
  const blockedNodes = new Set(issues.filter((issue) => ['CONVERSION_RATIO_CONFLICT', 'MULTI_PATH_RATIO_CONFLICT', 'CONVERSION_CYCLE_INCONSISTENT'].includes(issue.code)).flatMap((issue) => issue.edge ? [issue.edge.sourceMaterialCode, issue.edge.targetMaterialCode] : []));
  return Object.freeze({ components: Object.freeze(components), issues: Object.freeze(issues), blockedMaterialCodes: Object.freeze([...blockedNodes].sort()) });
}

export function propagateLitreAnchor({ graph, anchorMaterialCode, litresPerStockUnit }) {
  const anchor = fractionFromText(litresPerStockUnit); const component = graph.components.find((item) => item.nodes.includes(anchorMaterialCode));
  if (!component) return Object.freeze({ values: Object.freeze({}), issues: Object.freeze([{ code: 'MISSING_LITRE_ANCHOR', materialCode: anchorMaterialCode }]) });
  const rootFactor = fractionFromText(component.lpuFactorsFromRoot[anchorMaterialCode]);
  const values = {};
  for (const [materialCode, factorText] of Object.entries(component.lpuFactorsFromRoot)) {
    const factor = fractionFromText(factorText);
    values[materialCode] = fractionText(divide(multiply(anchor, factor), rootFactor));
  }
  return Object.freeze({ values: Object.freeze(values), issues: Object.freeze([]) });
}
