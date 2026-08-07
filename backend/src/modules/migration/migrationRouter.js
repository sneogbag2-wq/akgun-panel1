import { Router } from 'express';

export function createMigrationRouter(dependencies = {}) {
  const router = Router();
  router.get('/status', (req, res) => {
    res.json({ module: 'migration', status: 'active' });
  });
  return router;
}
