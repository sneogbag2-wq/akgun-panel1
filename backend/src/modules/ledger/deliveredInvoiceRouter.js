import { Router } from 'express';

export function createDeliveredInvoiceRouter(dependencies = {}) {
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

  // 1. POST /check - Perform delivered invoice risk analysis
  router.post('/check', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { customerId, invoiceNo, deliveryDocNo, amount = 0, hasDMinus1Proof = false } = req.body;
      if (!customerId || !invoiceNo) {
        return res.status(400).json({ error: 'customerId and invoiceNo are required' });
      }

      // Simple risk assessment logic: if no D-1 proof and amount > 50000, risk is WARNING
      let riskStatus = 'OK';
      if (!hasDMinus1Proof && Number(amount) > 50000) {
        riskStatus = 'WARNING';
      }

      const { data, error } = await client
        .from('delivered_invoice_check')
        .insert({
          customer_id: String(customerId),
          invoice_no: String(invoiceNo),
          delivery_doc_no: deliveryDocNo ? String(deliveryDocNo) : null,
          d_minus_1_proof: Boolean(hasDMinus1Proof),
          risk_status: riskStatus,
          amount: Number(amount)
        })
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        check: data
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. GET /open-stack - Get open stack summary for customer
  router.get('/open-stack', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { customerId } = req.query;
      let query = client.from('delivered_invoice_open_stack').select('*');
      if (customerId) {
        query = query.eq('customer_id', String(customerId));
      }

      const { data, error } = await query;
      if (error) throw error;

      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
