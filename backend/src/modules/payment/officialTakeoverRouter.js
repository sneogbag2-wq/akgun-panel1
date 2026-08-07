import { Router } from 'express';

export function createOfficialTakeoverRouter(dependencies = {}) {
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

  // 1. POST /reconcile-takeover - Reconcile official collections with transient documents (%80 threshold)
  router.post('/reconcile-takeover', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { officialCollections = [] } = req.body;

      // Fetch active transient documents
      const { data: transientDocs, error: transErr } = await client
        .from('ops_doc_transient')
        .select('*')
        .eq('is_active', true);

      if (transErr) throw transErr;

      let matchedCount = 0;
      const takeoverRecords = [];
      const matchedTransientDocIds = [];

      for (const off of officialCollections) {
        const offDocNo = String(off.documentNo || off.document_no || '').trim();
        const offCustId = String(off.customerId || off.customer_id || '').trim();

        const match = transientDocs?.find(td => 
          td.document_no === offDocNo || (td.customer_id === offCustId && Number(td.amount) === Number(off.amount))
        );

        if (match) {
          matchedCount++;
          matchedTransientDocIds.push(match.id);
          takeoverRecords.push({
            official_collection_id: String(off.id || offDocNo),
            transient_document_no: match.document_no,
            customer_id: match.customer_id,
            match_status: 'RECONCILED',
            batch_match_rate: 100.00
          });
        }
      }

      const totalCount = officialCollections.length || 1;
      const matchRate = Number(((matchedCount / totalCount) * 100).toFixed(2));
      const status = matchRate >= 80 ? 'RECONCILED_WITH_EXCEPTIONS' : 'LOW_MATCH_REVIEW';

      if (takeoverRecords.length > 0) {
        await client
          .from('official_collection_takeover')
          .insert(takeoverRecords);

        // Deactivate matched transient documents so official collections take over
        await client
          .from('ops_doc_transient')
          .update({ is_active: false })
          .in('id', matchedTransientDocIds);
      }

      res.json({
        success: true,
        totalOfficialCollections: officialCollections.length,
        matchedCount,
        batchMatchRate: matchRate,
        status
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
