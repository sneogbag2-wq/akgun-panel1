import { Router } from 'express';
import { createInvoiceControlService } from './invoiceControlService.js';

export function createInvoiceControlRouter(deps = {}) {
  const router = Router();
  
  router.use((req, res, next) => {
    req.invoiceControlService = createInvoiceControlService({ repository: deps.createRepositoryForAccessToken?.(req.headers.authorization) });
    next();
  });

  router.get('/invoice-controls', async (req, res, next) => {
    try {
      const result = await req.invoiceControlService.getControls(req.query.date);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/invoice-controls/summary', async (req, res, next) => {
    try {
      const result = await req.invoiceControlService.getSummary(req.query.date);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/invoice-controls/exceptions', async (req, res, next) => {
    try {
      const result = await req.invoiceControlService.getExceptions(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/invoice-controls/:invoiceId', async (req, res, next) => {
    try {
      const result = await req.invoiceControlService.getInvoiceDetail(req.params.invoiceId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/invoice-controls/:invoiceId/evidence', async (req, res, next) => {
    try {
      const result = await req.invoiceControlService.getEvidence(req.params.invoiceId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
