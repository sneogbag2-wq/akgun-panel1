import { Router } from 'express';

export function createEngineRouter(dependencies = {}) {
  const router = Router();
  const { requireSupabaseUser, createRepositoryForAccessToken, enabled = true } = dependencies;

  if (requireSupabaseUser) {
    router.use('/', requireSupabaseUser);
  }

  router.use('/', (req, res, next) => {
    if (!enabled) {
      return res.status(404).json({ code: 'FEATURE_DISABLED', message: 'Engine module is disabled' });
    }
    // Initialize repository
    if (createRepositoryForAccessToken && req.headers && req.headers.authorization) {
      const token = req.headers.authorization.split(' ')[1];
      req.repository = createRepositoryForAccessToken(token);
    }
    next();
  });

  router.get('/status', (req, res) => {
    res.json({ module: 'engine', status: 'active' });
  });

  // OPS-DOC-001: transient_operational_documents
  router.get('/ops-documents', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('ops_doc_transient')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // STL-003: matched_operational_collection_signal
  router.get('/stl-matched-signals', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('stl_matched_signal')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // NOTEPRINT-012: artifact_audit_integrity
  router.get('/noteprint-audit', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('noteprint_audit_log')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // AIFOCUS
  router.get('/aifocus-context', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('aifocus_context')
        .select('*, aifocus_claim(*)')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // AIENG-001..024: AI Agent Logs
  router.get('/advanced/ai-logs', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('aieng_agent_log')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // SCN-001..010: Scenario Models
  router.get('/advanced/scenarios', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('scn_scenario_model')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // MET-001..020: Metric Registry
  router.get('/advanced/metric-registry', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('met_metric_registry')
        .select('*')
        .order('metric_id', { ascending: true })
        .limit(100);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // CUT-001..005: System Transition Logs
  router.get('/advanced/cutover-logs', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('cut_transition_log')
        .select('*')
        .order('processed_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
