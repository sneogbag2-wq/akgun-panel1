import { Router } from 'express';
import { createDispatchService } from './dispatchService.js';

export function createDispatchRouter(deps = {}) {
  const router = Router();
  
  router.use((req, res, next) => {
    req.dispatchService = createDispatchService({ repository: deps.createRepositoryForAccessToken?.(req.headers.authorization) });
    next();
  });

  router.get('/dispatch/today', async (req, res, next) => {
    try {
      const result = await req.dispatchService.getTodayOrders();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/dispatch/summary', async (req, res, next) => {
    try {
      const result = await req.dispatchService.getSummary();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/dispatch/orders', async (req, res, next) => {
    try {
      const result = await req.dispatchService.getOrders(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/dispatch/orders/:salesDocumentNo', async (req, res, next) => {
    try {
      const result = await req.dispatchService.getOrder(req.params.salesDocumentNo);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });


  router.get('/dispatch/exceptions', async (req, res, next) => {
    try {
      const result = await req.dispatchService.getExceptions(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/dispatch/handoff-status', async (req, res, next) => {
    try {
      const result = await req.dispatchService.getHandoffStatus();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/dispatch/orders/:id/actions/preview', async (req, res, next) => {
    try {
      const result = await req.dispatchService.previewAction(req.params.id, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/dispatch/orders/:id/actions/commit', async (req, res, next) => {
    try {
      const result = await req.dispatchService.commitAction(req.params.id, req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
