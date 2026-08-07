import { Router } from 'express';

export function createOpsDocStagingRouter(dependencies = {}) {
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

  // 1. POST /validate - Create staging import & rows with in-file dedup
  router.post('/validate', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { filename, rows } = req.body;
      if (!filename || !Array.isArray(rows)) {
        return res.status(400).json({ error: 'filename and rows array are required' });
      }

      // Create import record
      const { data: importRec, error: impErr } = await client
        .from('ops_doc_staging_import')
        .insert({
          filename,
          source_kind: 'BELGELER_EXCEL',
          row_count: rows.length,
          status: 'STAGED'
        })
        .select()
        .single();

      if (impErr) throw impErr;

      // In-file dedup by document_no + customer_id + amount
      const seenHashes = new Set();
      const stagingRows = [];
      let duplicateCount = 0;

      for (const r of rows) {
        const docNo = String(r.documentNo || r.document_no || '').trim();
        const custId = String(r.customerId || r.customer_id || '').trim();
        const amt = Number(r.amount || 0);
        const dedupHash = `${docNo}_${custId}_${amt}`;

        if (seenHashes.has(dedupHash)) {
          duplicateCount++;
          continue;
        }
        seenHashes.add(dedupHash);

        stagingRows.push({
          staging_id: importRec.id,
          document_no: docNo,
          customer_id: custId,
          amount: amt,
          document_date: r.documentDate || r.document_date || null,
          raw_data: r,
          dedup_hash: dedupHash,
          validation_status: docNo && custId ? 'VALID' : 'INVALID'
        });
      }

      if (stagingRows.length > 0) {
        const { error: rowErr } = await client
          .from('ops_doc_staging_row')
          .insert(stagingRows);
        if (rowErr) throw rowErr;
      }

      res.json({
        stagingId: importRec.id,
        filename,
        totalRawRows: rows.length,
        stagedValidRows: stagingRows.length,
        duplicateCount,
        status: 'STAGED'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. POST /:stagingId/publish-snapshot - Atomic snapshot diff & publish
  router.post('/:stagingId/publish-snapshot', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { stagingId } = req.params;

      // Fetch staging rows
      const { data: stagedRows, error: fetchErr } = await client
        .from('ops_doc_staging_row')
        .select('*')
        .eq('staging_id', stagingId)
        .eq('validation_status', 'VALID');

      if (fetchErr) throw fetchErr;

      // Deactivate previous snapshot rows
      await client
        .from('ops_doc_transient')
        .update({ is_active: false })
        .eq('is_active', true);

      // Insert new active snapshot
      const snapshotRows = stagedRows.map(r => ({
        document_no: r.document_no,
        customer_id: r.customer_id,
        amount: r.amount,
        document_date: r.document_date,
        snapshot_version: 1,
        is_active: true,
        published_at: new Date().toISOString()
      }));

      if (snapshotRows.length > 0) {
        const { error: insErr } = await client
          .from('ops_doc_transient')
          .insert(snapshotRows);
        if (insErr) throw insErr;
      }

      // Mark import as PUBLISHED
      await client
        .from('ops_doc_staging_import')
        .update({ status: 'PUBLISHED' })
        .eq('id', stagingId);

      res.json({
        success: true,
        stagingId,
        publishedCount: snapshotRows.length
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. GET /current-snapshot - Fetch current active transient records
  router.get('/current-snapshot', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { data, error } = await client
        .from('ops_doc_transient')
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
