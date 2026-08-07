import { Router } from 'express';
import { createFinancialReadService } from './financialReadService.js';

export function createFinancialRouter(dependencies = {}) {
  const router = Router();

  router.use((req, res, next) => {
    let repo = dependencies.repository || req.repository;
    req.financialReadService = createFinancialReadService({ repository: repo });
    next();
  });

  router.get('/analysis', async (req, res) => {
    try {
      const customerId = req.query.customerId;
      const cei = await req.financialReadService.calculateCEI(customerId);
      const health = await req.financialReadService.calculateHealthScore(customerId);
      const limit = await req.financialReadService.calculateCreditLimit(customerId);
      res.json({ cei, health, limit });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/cei', async (req, res) => {
    try {
      const result = await req.financialReadService.calculateCEI(req.query.customerId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/health-score', async (req, res) => {
    try {
      const result = await req.financialReadService.calculateHealthScore(req.query.customerId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/credit-limit', async (req, res) => {
    try {
      const result = await req.financialReadService.calculateCreditLimit(req.query.customerId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
