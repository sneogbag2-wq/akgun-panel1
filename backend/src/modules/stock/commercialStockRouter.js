import { Router } from 'express';

export function createCommercialStockRouter(dependencies = {}) {
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

  // 1. GET /summary - Fetch active commercial stock summary
  router.get('/summary', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { data, error } = await client
        .from('commercial_stock_item')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. POST /publish - Publish atomic commercial stock snapshot
  router.post('/publish', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { filename, items } = req.body;
      if (!filename || !Array.isArray(items)) {
        return res.status(400).json({ error: 'filename and items array required' });
      }

      // Create import record
      const { data: impRec, error: impErr } = await client
        .from('commercial_stock_import')
        .insert({
          filename,
          total_items: items.length,
          total_remaining_litres: items.reduce((acc, curr) => acc + (Number(curr.remainingLitres) || 0), 0)
        })
        .select()
        .single();

      if (impErr) throw impErr;

      // Deactivate old active stock set
      await client
        .from('commercial_stock_item')
        .update({ is_active: false })
        .eq('is_active', true);

      // Insert new active set
      const rowsToInsert = items.map(it => ({
        import_id: impRec.id,
        document_no: String(it.documentNo || ''),
        customer_id: String(it.customerId || ''),
        product_id: String(it.productId || ''),
        remaining_quantity: Number(it.remainingQuantity || 0),
        remaining_litres: Number(it.remainingLitres || 0),
        is_active: true
      }));

      if (rowsToInsert.length > 0) {
        const { error: insErr } = await client
          .from('commercial_stock_item')
          .insert(rowsToInsert);
        if (insErr) throw insErr;
      }

      res.json({
        success: true,
        importId: impRec.id,
        publishedItems: rowsToInsert.length
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
