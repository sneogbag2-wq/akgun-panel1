import { Router } from 'express';

export function createReturnServiceRouter(dependencies = {}) {
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

  // 1. POST /register - Register IADE/HIZMET credit
  router.post('/register', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { customerId, documentNo, creditType = 'IADE', amount = 0 } = req.body;
      if (!customerId || !documentNo || !amount) {
        return res.status(400).json({ error: 'customerId, documentNo, and amount are required' });
      }

      const { data, error } = await client
        .from('return_service_credit_event')
        .insert({
          customer_id: String(customerId),
          document_no: String(documentNo),
          credit_type: String(creditType).toUpperCase(),
          amount: Number(amount)
        })
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        record: data
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
