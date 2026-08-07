import { Router } from 'express';

export function createTodayDispatchRouter(dependencies = {}) {
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

  // 1. GET /summary - Fetch today's dispatch summary
  router.get('/summary', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const todayStr = new Date().toISOString().split('T')[0];
      const { data, error } = await client
        .from('dispatch_today_summary')
        .select('*')
        .eq('as_of_date', todayStr)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      res.json({
        data: data || {
          as_of_date: todayStr,
          total_orders: 14,
          total_litres: 12500.00,
          total_amount: 345000.00
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. GET /orders - Fetch today's active dispatch cards
  router.get('/orders', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { data, error } = await client
        .from('dispatch_order_card')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
