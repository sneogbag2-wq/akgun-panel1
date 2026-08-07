import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductService } from '../productService.js';

test('package-conversion validation forwards exact graph conflicts to the database publication gate', async () => {
  let validationInput;
  const service = createProductService({
    async getImport() { return { source_kind: 'PACKAGE_CONVERSION_HISTORY', storage_object_path: 'anonymous.xlsx' }; },
    async readSourceBytes() { return Buffer.from('anonymous'); },
    async validate(input) { validationInput = input; return { status: 'FAILED' }; },
  }, {
    parseWorkbook() { return { records: [
      { parsedPayload: { sourceMaterialCode: 'A', sourceQuantity: '1', targetMaterialCode: 'B', targetQuantity: '2' } },
      { parsedPayload: { sourceMaterialCode: 'B', sourceQuantity: '1', targetMaterialCode: 'C', targetQuantity: '2' } },
      { parsedPayload: { sourceMaterialCode: 'A', sourceQuantity: '1', targetMaterialCode: 'C', targetQuantity: '3' } },
    ] }; },
    resolveGraph() { return { issues: [{ code: 'MULTI_PATH_RATIO_CONFLICT', componentStart: 'A' }] }; },
  });
  const result = await service.validate('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'anonymous-correlation');
  assert.equal(result.status, 'FAILED');
  assert.deepEqual(validationInput.graphIssues, [{ code: 'MULTI_PATH_RATIO_CONFLICT', componentStart: 'A' }]);
});
