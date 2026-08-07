import { Router } from 'express';

export function createStlMatchRouter(dependencies = {}) {
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

  // 1. GET /stl-daily-results
  router.get('/stl-daily-results', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { data, error } = await client
        .from('stl_daily_results')
        .select('*')
        .order('sellout_date', { ascending: false })
        .limit(30);

      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. POST /calculate-stl-pairs
  router.post('/calculate-stl-pairs', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { selloutDate, selloutLitres = 1000 } = req.body;
      const targetDate = selloutDate ? new Date(selloutDate) : new Date();

      // Rule resolution logic
      const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday
      const isMonthEndSunday = dayOfWeek === 0 && new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate() === targetDate.getDate();

      let matchRule = 'D_MINUS_1';
      let collectionAmount = 45000; // Simulated TL

      if (dayOfWeek === 1) {
        matchRule = 'MONDAY_WEEKEND_COMBINED';
        collectionAmount = 92000;
      } else if (isMonthEndSunday) {
        matchRule = 'MONTH_END_SUNDAY';
        collectionAmount = 40000;
      }

      const litres = Number(selloutLitres) || 1;
      const tlPerLitre = Number((collectionAmount / litres).toFixed(4));

      const formattedDate = targetDate.toISOString().split('T')[0];

      const { data, error } = await client
        .from('stl_daily_results')
        .upsert({
          sellout_date: formattedDate,
          collection_dates: [formattedDate],
          sellout_litres: litres,
          operational_collection_amount: collectionAmount,
          tl_per_litre: tlPerLitre,
          coverage_score: 100.00,
          overlap_warning: false
        })
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        matchRule,
        result: data
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
