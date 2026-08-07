export const productSemanticDescriptor = Object.freeze({
  version: 'product-semantic-v2/1.0.0',
  entities: Object.freeze([
    Object.freeze({ key: 'PRODUCT_FAMILY', terms: ['ürün ailesi', 'ürün grubu'], ambiguity: 'VARIANT_OR_FAMILY_REVIEW' }),
    Object.freeze({ key: 'PRODUCT_VARIANT', terms: ['paket varyantı', 'malzeme kodu', '6lı', '12li', '24lü'], ambiguity: 'VARIANT_OR_FAMILY_REVIEW' }),
  ]),
  measures: Object.freeze([{ key: 'LITRES_PER_STOCK_UNIT', terms: ['litre katsayısı', 'lpu'] }, { key: 'CASE_EQUIVALENT', terms: ['koli eşdeğeri'], status: 'REQUIRES_CANONICAL_VARIANT' }]),
  tools: Object.freeze(['resolve_product_scope', 'explain_product_family', 'explain_litre_conversion']),
  prohibitions: Object.freeze(['NO_NAME_DERIVED_FAMILY', 'NO_NAME_DERIVED_LITRE', 'NO_CLIENT_SIDE_CALCULATION']),
});
