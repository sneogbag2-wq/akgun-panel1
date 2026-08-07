import { Router } from 'express';

export function createSalesOrderRouter(dependencies = {}) {
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

  // 1. GET /active - Fetch active sales order documents
  router.get('/active', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { data, error } = await client
        .from('sales_order_document')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. POST /publish - Deduplicate & publish sales order documents (amount counted ONCE per doc)
  router.post('/publish', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { orders } = req.body;
      if (!Array.isArray(orders)) {
        return res.status(400).json({ error: 'orders array is required' });
      }

      // Group rows by sales_document_no to count total_amount ONCE
      const docMap = new Map();

      for (const row of orders) {
        const docNo = String(row.salesDocumentNo || row.sales_document_no || '').trim();
        const custId = String(row.customerId || row.customer_id || '').trim();
        const docAmount = Number(row.totalAmount || row.total_amount || 0);

        if (!docNo || !custId) continue;

        if (!docMap.has(docNo)) {
          docMap.set(docNo, {
            sales_document_no: docNo,
            customer_id: custId,
            requested_delivery_date: row.requestedDeliveryDate || row.requested_delivery_date || null,
            total_amount: docAmount,
            order_status: row.orderStatus || 'SUBMITTED',
            is_active: true,
            rows: []
          });
        }

        if (row.productId || row.product_id) {
          docMap.get(docNo).rows.push({
            product_id: String(row.productId || row.product_id),
            quantity: Number(row.quantity || 0),
            unit_price: Number(row.unitPrice || row.unit_price || 0),
            line_total: Number(row.lineTotal || row.line_total || 0)
          });
        }
      }

      const createdDocs = [];

      for (const [_, docData] of docMap) {
        const { rows, ...header } = docData;
        const { data: docRec, error: docErr } = await client
          .from('sales_order_document')
          .upsert(header, { onConflict: 'sales_document_no' })
          .select()
          .single();

        if (docErr) throw docErr;

        if (rows.length > 0) {
          const rowsWithDocId = rows.map(r => ({ ...r, document_id: docRec.id }));
          const { error: rowErr } = await client
            .from('sales_order_source_row')
            .insert(rowsWithDocId);
          if (rowErr) throw rowErr;
        }

        createdDocs.push(docRec);
      }

      res.json({
        success: true,
        publishedDocumentsCount: createdDocs.length
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
