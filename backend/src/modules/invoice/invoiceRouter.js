import { Router } from 'express';
import { createInvoiceService } from './invoiceService.js';
import { createInvoiceRepository } from './invoiceRepository.js';

export function createInvoiceRouter({ requireSupabaseUser, createRepositoryForAccessToken, enabled = true } = {}) {
  const router = Router();
  const paths = ['/imports/sales', '/invoices', '/'];
  
  if (requireSupabaseUser) {
    router.use(paths, requireSupabaseUser);
  }

  router.use(paths, (req, res, next) => {
    if (!enabled) {
      return res.status(404).json({ code: 'FEATURE_DISABLED', message: 'Invoice module is disabled' });
    }
    const repo = createRepositoryForAccessToken ? createRepositoryForAccessToken(req.authUser?.accessToken) : createInvoiceRepository({});
    req.invoiceService = createInvoiceService(repo);
    next();
  });

  const getInvoices = async (req, res) => {
    try {
      const result = await req.invoiceService.list(req.query);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  router.get('/invoices', getInvoices);
  router.get('/', getInvoices);

  router.post('/imports/sales/:batchId/parse', async (req, res) => {
    try {
      const rows = Array.isArray(req.body?.rows) ? req.body.rows : (Array.isArray(req.body) ? req.body : []);
      const result = await req.invoiceService.parse(req.params.batchId, rows, req.correlationId);
      res.json(result);
    } catch (err) {
      res.status(550).json({ code: 'SALES_PARSE_FAILED', error: err.message });
    }
  });

  router.post('/imports/sales/:batchId/validate', async (req, res) => {
    try {
      const result = await req.invoiceService.validate(req.params.batchId, req.correlationId);
      res.json(result);
    } catch (err) {
      res.status(550).json({ code: 'SALES_VALIDATE_FAILED', error: err.message });
    }
  });

  router.post('/imports/sales/:batchId/publish', async (req, res) => {
    try {
      const result = await req.invoiceService.publish(req.params.batchId, req.body, req.correlationId);
      res.json(result);
    } catch (err) {
      res.status(550).json({ code: 'SALES_PUBLISH_FAILED', error: err.message });
    }
  });

  return router;
}
