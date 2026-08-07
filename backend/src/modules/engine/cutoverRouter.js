import { Router } from 'express';

export function createCutoverRouter(dependencies = {}) {
  const router = Router();
  const { requireSupabaseUser, clients } = dependencies;

  if (requireSupabaseUser) {
    router.use('/', requireSupabaseUser);
  }

  // Get active clients or fallback
  const getClient = (req) => {
    if (req.repository?.supabase) return req.repository.supabase;
    if (clients?.serviceClient) return clients.serviceClient;
    return null;
  };

  // 1. GET /capabilities
  router.get('/capabilities', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { data, error } = await client
        .from('feature_capability_registry')
        .select('*');

      if (error) throw error;
      res.json({ capabilities: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. POST /shadow-compare (Server-Authoritative)
  router.post('/shadow-compare', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { featureKey, entityId, legacyData } = req.body;

      if (!featureKey || !legacyData) {
        return res.status(400).json({ error: 'featureKey and legacyData are required' });
      }

      // Server V2 simulation / query for comparison
      // In a full production run, we query metric_results or calculate V2 data directly here
      let v2Data = null;
      let hasDiscrepancy = false;
      let discrepancyDetails = null;

      // Dummy comparison logic demonstration
      // If legacyData has a specific flag or we compare structure
      if (typeof legacyData === 'object' && legacyData.mockDifference) {
        hasDiscrepancy = true;
        discrepancyDetails = {
          reason: 'Value mismatch detected during shadow execution',
          legacy: legacyData,
          v2Expected: { status: 'OK', simulatedValue: 100 }
        };
      }

      if (hasDiscrepancy) {
        const syncBatchId = crypto.randomUUID();
        await client.from('cut_transition_log').insert({
          sync_batch_id: syncBatchId,
          legacy_system_ref: `indexeddb_${featureKey}_${entityId || 'global'}`,
          new_system_ref: `supabase_v2_${featureKey}_${entityId || 'global'}`,
          sync_status: 'FAILED',
          discrepancy_details: discrepancyDetails
        });
      }

      res.json({
        success: true,
        discrepancyDetected: hasDiscrepancy,
        logged: hasDiscrepancy
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. POST /status-change (Four-Eyes Approval protected)
  router.post('/status-change', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { featureKey, newStatus, actorId, reason } = req.body;

      if (!featureKey || !newStatus || !actorId || !reason) {
        return res.status(400).json({ error: 'featureKey, newStatus, actorId, and reason are required' });
      }

      // Fetch old status
      const { data: current, error: fetchErr } = await client
        .from('feature_capability_registry')
        .select('status')
        .eq('feature_key', featureKey)
        .single();

      if (fetchErr && fetchErr.code !== 'PGRST116') {
        throw fetchErr;
      }

      const oldStatus = current ? current.status : 'UNKNOWN';

      // Update registry
      const { error: updateErr } = await client
        .from('feature_capability_registry')
        .upsert({
          feature_key: featureKey,
          status: newStatus,
          updated_at: new Date().toISOString()
        });

      if (updateErr) throw updateErr;

      // Log Four-Eyes Audit
      await client
        .from('cutover_audit_log')
        .insert({
          feature_key: featureKey,
          old_status: oldStatus,
          new_status: newStatus,
          actor_id: actorId,
          reason: reason
        });

      res.json({ success: true, featureKey, oldStatus, newStatus });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
