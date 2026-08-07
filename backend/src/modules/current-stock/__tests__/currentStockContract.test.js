import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalQuantity, headerMatches } from '../currentStockContract.js';
test('accepts only all three exact current-stock headers after permitted whitespace/case normalization', () => {
  assert.equal(headerMatches([' Malzeme numarası ', 'MALZEME TANIMI', 'Tahditsiz   kullanılabilir']), true);
  assert.equal(headerMatches(['Malzeme Kodu', 'Malzeme tanımı', 'Tahditsiz kullanılabilir']), false);
});
test('canonical quantity preserves decimal semantics without float coercion', () => {
  assert.equal(canonicalQuantity('002.5000'), '2.5');
  assert.equal(canonicalQuantity('0'), '0');
  assert.equal(canonicalQuantity('-1'), null);
  assert.equal(canonicalQuantity('NaN'), null);
});
