import express from 'express';

export function createInstrumentRouter({ requireSupabaseUser, enabled, createRepositoryForAccessToken }) {
  const router = express.Router();

  if (!enabled) {
    router.use((req, res, next) => {
      res.status(404).json({ error: 'Instruments V2 module is not enabled.' });
    });
    return router;
  }

  router.use(requireSupabaseUser);

  router.post('/accept-note', async (req, res, next) => {
    try {
      const accessToken = req.headers.authorization?.split(' ')[1];
      const repository = createRepositoryForAccessToken(accessToken);
      
      const { customerId, amount, dueDate, noteNumber, idempotencyKey } = req.body;
      
      if (!customerId || !amount || !idempotencyKey) {
        return res.status(400).json({ error: 'customerId, amount and idempotencyKey are required.' });
      }

      if (amount <= 0) {
        return res.status(400).json({ error: 'Amount must be greater than zero.' });
      }

      // Senet Kabul İşlemi (Transaction)
      const result = await repository.acceptNote({
        customerId,
        amount,
        dueDate,
        noteNumber,
        idempotencyKey
      });

      res.status(201).json(result);
    } catch (error) {
      if (error.code === 'DUPLICATE_IDEMPOTENCY' || error.code === '23505') {
        return res.status(409).json({ error: 'Bu işlem (Senet Kabulü) daha önce gerçekleştirilmiş.' });
      }
      next(error);
    }
  });

  return router;
}
