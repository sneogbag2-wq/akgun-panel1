import { Router } from 'express';
import { createFknsService } from './fknsService.js';

export function createFknsRouter(deps = {}) {
  const router = Router();
  // Service instance, optionally injecting metricEngineService
  const fknsService = createFknsService(deps.metricEngineService);

  // Example route to trigger FKNS analysis
  router.post('/analyze', async (req, res, next) => {
    try {
      const { regionId, runId, rawFknsData } = req.body;
      if (!regionId || !runId || !rawFknsData) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const result = await fknsService.runFknsAnalysis(regionId, runId, rawFknsData);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
