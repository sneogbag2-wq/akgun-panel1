import { Router } from 'express';

export function createLedgerRouter({ requireSupabaseUser, createRepositoryForAccessToken, enabled = true } = {}) {
  const router = Router();
  
  if (requireSupabaseUser) {
    router.use('/', requireSupabaseUser);
  }

  router.use('/', (req, res, next) => {
    if (!enabled) {
      return res.status(404).json({ code: 'FEATURE_DISABLED', message: 'Ledger module is disabled' });
    }
    // Initialize repository/service
    if (createRepositoryForAccessToken && req.headers && req.headers.authorization) {
      const token = req.headers.authorization.split(' ')[1];
      req.repository = createRepositoryForAccessToken(token);
    }
    req.ledgerService = {
      list: async (query) => {
        return { data: [], total: 0 }; // Temporary implementation
      },
      status: async () => {
        return { module: 'ledger', status: 'active' };
      }
    };
    next();
  });

  router.get('/status', async (req, res) => {
    res.json(await req.ledgerService.status());
  });

  router.get('/', async (req, res) => {
    try {
      const result = await req.ledgerService.list(req.query);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // FAN-002: aging_migration_matrix
  router.get('/aging-migration', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_aging_migration_matrix')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // FAN-016: stress_scenario
  router.get('/stress-scenarios', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_stress_scenario')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // MAN-001..010: Manual Overrides
  router.get('/advanced/overrides', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('man_override_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
