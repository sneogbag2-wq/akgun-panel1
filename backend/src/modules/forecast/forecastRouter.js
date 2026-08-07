import { Router } from 'express';

export function createForecastRouter(dependencies = {}) {
  const router = Router();
  const { requireSupabaseUser, createRepositoryForAccessToken, enabled = true } = dependencies;

  if (requireSupabaseUser) {
    router.use('/', requireSupabaseUser);
  }

  router.use('/', (req, res, next) => {
    if (!enabled) {
      return res.status(404).json({ code: 'FEATURE_DISABLED', message: 'Forecast module is disabled' });
    }
    // Initialize repository
    if (createRepositoryForAccessToken && req.headers && req.headers.authorization) {
      const token = req.headers.authorization.split(' ')[1];
      req.repository = createRepositoryForAccessToken(token);
    }
    next();
  });

  router.get('/status', (req, res) => {
    res.json({ module: 'forecast', status: 'active' });
  });

  // FCST-001: daily_forecast_model
  router.get('/daily-model', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fcst_daily_model')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // SS-001: dynamic_safety_stock
  router.get('/safety-stock', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('ss_dynamic_safety_stock')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // RISK-001: stockout_risk_indicator
  router.get('/stockout-risk', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('risk_stockout_indicator')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ORD-001: automated_replenishment_order
  router.get('/replenishment', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('ord_replenishment_recommendation')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ORDOP-001..010: Order Operations
  router.get('/advanced/order-operations', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('ordop_operation_log')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // REQ-001..005: Replenishment Requests
  router.get('/advanced/requirements', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('req_replenishment_request')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
