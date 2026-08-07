import { Router } from 'express';

export function createPaymentRouter({ requireSupabaseUser, createRepositoryForAccessToken, enabled = true } = {}) {
  const router = Router();
  
  if (requireSupabaseUser) {
    router.use('/', requireSupabaseUser);
  }

  router.use('/', (req, res, next) => {
    if (!enabled) {
      return res.status(404).json({ code: 'FEATURE_DISABLED', message: 'Payment module is disabled' });
    }
    // Initialize repository/service
    req.paymentService = {
      list: async (query) => {
        return { data: [], total: 0 }; // Temporary implementation
      }
    };
    next();
  });

  router.get('/', async (req, res) => {
    try {
      const result = await req.paymentService.list(req.query);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
