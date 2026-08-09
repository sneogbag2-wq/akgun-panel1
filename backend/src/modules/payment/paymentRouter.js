import { Router } from 'express';
import { createPaymentRepository } from './paymentRepository.js';

export function createPaymentRouter({ requireSupabaseUser, createRepositoryForAccessToken, enabled = true } = {}) {
  const router = Router();
  const paths = ['/imports/payments', '/payments', '/'];
  
  if (requireSupabaseUser) {
    router.use(paths, requireSupabaseUser);
  }

  router.use(paths, (req, res, next) => {
    if (!enabled) {
      return res.status(404).json({ code: 'FEATURE_DISABLED', message: 'Payment module is disabled' });
    }
    const repo = createRepositoryForAccessToken ? createRepositoryForAccessToken(req.authUser?.accessToken) : createPaymentRepository({});
    req.paymentService = {
      list: async (query) => ({ data: [], total: 0 }),
      parse: (batchId, rows, corrId) => repo.parsePayments(batchId, rows, corrId),
      validate: (batchId, corrId) => repo.validatePayments(batchId, corrId),
      publish: (batchId, input, corrId) => repo.publishPayments(batchId, input, corrId)
    };
    next();
  });

  const getPayments = async (req, res) => {
    try {
      const result = await req.paymentService.list(req.query);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  router.get('/payments', getPayments);
  router.get('/', getPayments);

  router.post('/imports/payments/:batchId/parse', async (req, res) => {
    try {
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : (Array.isArray(req.body) ? req.body : []);
      const result = await req.paymentService.parse(req.params.batchId, rows, req.correlationId);
      res.json(result);
    } catch (err) {
      res.status(550).json({ code: 'PAYMENT_PARSE_FAILED', error: err.message });
    }
  });

  router.post('/imports/payments/:batchId/validate', async (req, res) => {
    try {
      const result = await req.paymentService.validate(req.params.batchId, req.correlationId);
      res.json(result);
    } catch (err) {
      res.status(550).json({ code: 'PAYMENT_VALIDATE_FAILED', error: err.message });
    }
  });

  router.post('/imports/payments/:batchId/publish', async (req, res) => {
    try {
      const result = await req.paymentService.publish(req.params.batchId, req.body, req.correlationId);
      res.json(result);
    } catch (err) {
      res.status(550).json({ code: 'PAYMENT_PUBLISH_FAILED', error: err.message });
    }
  });

  return router;
}
