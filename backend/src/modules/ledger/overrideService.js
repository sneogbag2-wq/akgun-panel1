export function createOverrideService(repository) {
  if (!repository) throw new TypeError('Repository required');

  return Object.freeze({
    // Soft-Delete İşlemi
    async softDeleteEntry(entryId) {
      return repository.runInTransaction(async (tx) => {
        const entry = await tx.getEntryById(entryId);
        if (!entry) throw new Error('Entry not found');
        if (entry.deleted_at) throw new Error('Entry already deleted');

        // Fiziksel DELETE yasak, deleted_at doldurulur
        await tx.updateEntry(entryId, { deleted_at: new Date().toISOString() });
        return { success: true, message: 'Soft deleted successfully' };
      });
    },

    // Manuel Override (Ezme) İşlemi
    async overrideEntry(oldEntryId, newAmount) {
      return repository.runInTransaction(async (tx) => {
        const oldEntry = await tx.getEntryById(oldEntryId);
        if (!oldEntry || oldEntry.deleted_at) throw new Error('Valid entry not found');

        // Eski kaydın validity değerini OVERRIDDEN yapıyoruz (Tarihçede kalıyor ama hesapta sayılmıyor)
        await tx.updateEntry(oldEntryId, { validity: 'OVERRIDDEN' });

        // Yeni kaydı MANUAL_OVERRIDE olarak giriyoruz
        const newEntryId = await tx.insertEntry({
          customer_id: oldEntry.customer_id,
          amount: newAmount,
          source: 'MANUAL_OVERRIDE',
          validity: 'VALID'
        });

        return { success: true, oldEntryId, newEntryId };
      });
    }
  });
}
