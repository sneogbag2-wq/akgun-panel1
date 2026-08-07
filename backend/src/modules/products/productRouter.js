import express from 'express';
import { toErrorEnvelope } from '../imports/importContracts.js';
import { ProductContractError } from './productContract.js';
import { createProductService } from './productService.js';
const disabled = (res, correlationId) => res.status(404).json({ code: 'FEATURE_DISABLED', messageKey: 'products.feature.disabled', correlationId, retryable: false });
function envelope(error, correlationId) { return error instanceof ProductContractError ? { status: 422, body: { code: error.code, messageKey: error.messageKey, correlationId, retryable: false, ...(Object.keys(error.details).length ? { details: error.details } : {}) } } : toErrorEnvelope(error, correlationId); }
export function createProductRouter({ requireSupabaseUser, createRepositoryForAccessToken, enabled = false }) {
  if (typeof requireSupabaseUser !== 'function' || typeof createRepositoryForAccessToken !== 'function') throw new TypeError('Product router requires bearer auth and repository factory');
  const router = express.Router(); const paths = ['/imports/package-conversions', '/products', '/product-resolution-runs'];
  router.use(paths, requireSupabaseUser); router.use(paths, (req, res, next) => { if (!enabled) return disabled(res, req.correlationId); req.productService = createProductService(createRepositoryForAccessToken(req.authUser.accessToken)); return next(); });
  const route = (handler) => async (req, res) => { try { res.json(await handler(req, res)); } catch (error) { const failure = envelope(error, req.correlationId); res.status(failure.status).json(failure.body); } };
  router.post('/imports/package-conversions/:batchId/parse', route((req) => req.productService.parse(req.params.batchId, req.correlationId)));
  router.post('/imports/package-conversions/:batchId/validate', route((req) => req.productService.validate(req.params.batchId, req.correlationId)));
  router.post('/imports/package-conversions/:batchId/publish', route((req) => req.productService.publish(req.params.batchId, req.body, req.correlationId)));
  router.get('/products/variants', route((req) => req.productService.variants(req.query)));
  router.get('/products/families', route((req) => req.productService.families(req.query)));
  router.get('/products/families/:familyId/conversion-graph', route((req) => req.productService.graph(req.params.familyId, req.query)));
  router.get('/products/families/:familyId', route((req) => req.productService.family(req.params.familyId, req.query)));
  router.get('/products/litre-coverage', route((req) => req.productService.coverage(req.query)));
  router.get('/products/exceptions', route((req) => req.productService.exceptions(req.query)));
  router.post('/products/resolutions/:issueId/preview', route((req) => req.productService.preview(req.params.issueId, req.body)));
  router.post('/products/resolutions/:issueId/commit', route((req) => req.productService.commit(req.params.issueId, req.body)));
  router.post('/products/resolutions/:resolutionId/revert', route((req) => req.productService.revert(req.params.resolutionId, req.body)));
  router.get('/product-resolution-runs/:runId/reconciliation', route((req) => req.productService.reconciliation(req.params.runId)));
  return router;
}
