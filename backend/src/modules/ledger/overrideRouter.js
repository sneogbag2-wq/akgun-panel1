import { Router } from 'express';
import { createOverrideService } from './overrideService.js';

export function createOverrideRouter(dependencies = {}) {
  const router = Router();
  const { createRepositoryForAccessToken } = dependencies;

  router.use((req, res, next) => {
    let repo = dependencies.repository;
    if (!repo && createRepositoryForAccessToken && req.headers?.authorization) {
      const token = req.headers.authorization.split(' ')[1];
      repo = createRepositoryForAccessToken(token);
    }
    if (repo) {
      req.overrideService = createOverrideService(repo);
    }
    next();
  });

  router.post('/soft-delete', async (req, res) => {
    try {
      if (!req.overrideService) return res.status(500).json({ error: 'Override service not initialized' });
      const { entryId } = req.body;
      if (!entryId) return res.status(400).json({ error: 'entryId is required' });

      const result = await req.overrideService.softDeleteEntry(entryId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/override', async (req, res) => {
    try {
      if (!req.overrideService) return res.status(500).json({ error: 'Override service not initialized' });
      const { oldEntryId, newAmount } = req.body;
      if (!oldEntryId || newAmount === undefined) {
        return res.status(400).json({ error: 'oldEntryId and newAmount are required' });
      }

      const result = await req.overrideService.overrideEntry(oldEntryId, newAmount);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
