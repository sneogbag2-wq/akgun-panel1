import { Router } from 'express';
import { createCommercialStockService } from './commercialStockService.js';

export function createStockRouter(deps = {}) {
  const router = Router();
  
  // Create service instance with injected repository (if provided via deps)
  // Or handle creation in a middleware that has access to the user's Supabase token
  
  router.use((req, res, next) => {
    // In actual implementation, we might get the repository from req context
    // if it depends on the authenticated user. For now, we use deps.
    req.stockService = createCommercialStockService({ repository: deps.createRepositoryForAccessToken?.(req.headers.authorization) });
    next();
  });

  router.post('/imports/commercial-stock/validate', async (req, res, next) => {
    try {
      const result = await req.stockService.validateImport(req.body.batchId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/imports/commercial-stock/:id/publish', async (req, res, next) => {
    try {
      const result = await req.stockService.publishImport(req.params.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/commercial-stock/summary', async (req, res, next) => {
    try {
      const summary = await req.stockService.getSummary(req.query);
      res.status(200).json(summary);
    } catch (err) {
      next(err);
    }
  });

  router.get('/commercial-stock/customers', async (req, res, next) => {
    try {
      const result = await req.stockService.getCustomers(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/commercial-stock/products', async (req, res, next) => {
    try {
      const result = await req.stockService.getProducts(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/commercial-stock/responsibility', async (req, res, next) => {
    try {
      const result = await req.stockService.getResponsibility(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/commercial-stock/exceptions', async (req, res, next) => {
    try {
      const result = await req.stockService.getExceptions(req.query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
