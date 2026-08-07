import { Router } from 'express';

export function createPromissoryNoteRouter(dependencies = {}) {
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

  // 1. POST /create-draft - Create installment breakdown & draft note
  router.post('/create-draft', async (req, res) => {
    try {
      const client = getClient(req);
      if (!client) return res.status(500).json({ error: 'Database client unavailable' });

      const { customerId, totalAmount, installmentCount = 1, startDate } = req.body;
      if (!customerId || !totalAmount) {
        return res.status(400).json({ error: 'customerId and totalAmount are required' });
      }

      const count = Math.max(1, Number(installmentCount) || 1);
      const total = Number(totalAmount) || 0;

      // Base installment amount & cent remainder handling
      const baseAmount = Math.floor((total / count) * 100) / 100;
      const remainder = Number((total - baseAmount * count).toFixed(2));

      // Create draft record
      const { data: draftRec, error: draftErr } = await client
        .from('promissory_note_draft')
        .insert({
          customer_id: String(customerId),
          total_amount: total,
          installment_count: count,
          template_version: 'v1_A5_legal',
          status: 'DRAFT'
        })
        .select()
        .single();

      if (draftErr) throw draftErr;

      // Build installments array
      const installments = [];
      const baseDate = startDate ? new Date(startDate) : new Date();

      for (let i = 1; i <= count; i++) {
        const dueDate = new Date(baseDate);
        dueDate.setMonth(baseDate.getMonth() + (i - 1));

        let instAmt = baseAmount;
        if (i === count) instAmt += remainder; // add remainder to last installment

        installments.push({
          draft_id: draftRec.id,
          installment_no: i,
          amount: Number(instAmt.toFixed(2)),
          due_date: dueDate.toISOString().split('T')[0]
        });
      }

      const { data: instData, error: instErr } = await client
        .from('promissory_note_installment')
        .insert(installments)
        .select();

      if (instErr) throw instErr;

      res.json({
        success: true,
        draft: draftRec,
        installments: instData
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
