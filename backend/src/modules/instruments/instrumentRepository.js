export function createInstrumentRepository({ userClient, serviceClient }) {
  return {
    async acceptNote({ customerId, amount, dueDate, noteNumber, idempotencyKey }) {
      // Postgres Transaction logic via Supabase RPC or double step
      // Idealy, we should have a plpgsql function for this: accept_instrument_note
      // For this implementation, since we need to guarantee Atomicity and double-counting prevention,
      // we will call an RPC function. If it doesn't exist, we simulate it via serviceClient.
      
      const { data, error } = await userClient.rpc('accept_instrument_note', {
        p_customer_id: customerId,
        p_amount: amount,
        p_due_date: dueDate,
        p_note_number: noteNumber,
        p_idempotency_key: idempotencyKey
      });

      if (error) {
        throw error;
      }

      // V3 Anayasası kuralı: Double counting and idempotency is handled in accept_instrument_note RPC
      // It decreases customer_balance and increases note_exposure atomically.
      return {
        success: true,
        message: 'Senet başarıyla kabul edildi ve risk güncellendi.',
        instrument: data
      };
    }
  };
}
