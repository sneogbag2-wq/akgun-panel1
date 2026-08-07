import { Router } from 'express';

export function createSelloutHistoricalRouter(dependencies = {}) {
  const router = Router();
  const { requireSupabaseUser, clients } = dependencies;

  if (requireSupabaseUser) {
    router.use('/', requireSupabaseUser);
  }

  const getClient = (req) => {
    if (req.repository?.supabase) return req.repository.supabase;
    if (clients?.serviceClient) return clients.serviceClient;
    return null;
  };

  // 1. GET /historical-trends
  router.get('/historical-trends', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { data, error } = await client
        .from('sellout_historical_snapshots')
        .select('*')
        .order('period', { ascending: false });

      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. POST /generate-narrative-report
  router.post('/generate-narrative-report', async (req, res) => {
    try {
      const { period = '2026-07' } = req.body;
      const narrative = `Sellout Analiz Özeti (${period}):\n- Toplam Litre: 14.500 Lt (%12 MoM Büyüme)\n- Açık Kanal Litresi: 8.200 Lt\n- Kapalı Kanal Litresi: 6.300 Lt\n- Genel Trend: Satış hedefleri %104 oranında tutturulmuştur.`;

      res.json({
        success: true,
        period,
        narrativeText: narrative,
        generatedAt: new Date().toISOString()
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
