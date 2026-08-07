export async function handleDraftManualTransaction(args: { transactionType: string; amount: number; customerId: string }): Promise<any> {
  try {
    const { fetchV4Api } = await import('./apiClient');
    // Faz 3: AI Mutasyonları Backend üzerinden güvenli (RLS) çalışır
    const response = await fetchV4Api('/ai/mutations/draft', {
      method: 'POST',
      body: JSON.stringify(args)
    });
    return response.data;
  } catch (error) {
    console.warn('Backend API hatası, taslak oluşturulamadı', error);
    throw error;
  }
}

export async function handlePreviewManualTransaction(args: { draftId: string }): Promise<any> {
  const mockPreviewHash = `HASH-${Date.now()}`;
  return {
    status: 'SUCCESS',
    action: 'PREVIEW_GENERATED',
    previewId: args.draftId,
    previewHash: mockPreviewHash,
    before: { balance: 150000, riskScore: 'HIGH' },
    after: { balance: 100000, riskScore: 'MEDIUM' },
    warnings: ['Bu işlem geçmiş FIFO eşleşmelerini bozabilir.', 'Bu değişiklik ERP ile henüz senkronize değil.'],
    note: 'Değişikliğin sistemdeki etkisi hesaplandı. Eğer onaylıyorsanız commit aracını previewId ve previewHash ile çağırın.'
  };
}

export async function handleCommitManualTransaction(args: { previewId: string; previewHash: string }): Promise<any> {
  if (!args.previewId || !args.previewHash) {
    return {
      status: 'ERROR',
      message: 'Güvenlik ihlali: Geçerli bir previewId ve previewHash sağlanmadan işlem commit edilemez.'
    };
  }
  return {
    status: 'SUCCESS',
    action: 'COMMITTED',
    transactionId: `TXN-${Math.floor(Math.random() * 100000)}`,
    note: 'Önizlenen işlem kullanıcı onayı sonrasında kalıcı olarak sisteme işlenmiştir.'
  };
}

export async function handleListManualSourceConflicts(): Promise<any> {
  return {
    status: 'SUCCESS',
    conflicts: [
      {
        conflictId: 'CONF-01',
        type: 'PAYMENT_MISMATCH',
        erpSource: { amount: 50000, date: '2026-08-06' },
        manualOverride: { amount: 60000, date: '2026-08-06' },
        recommendation: 'Lütfen manual işlemi silin veya ERP sistemindeki eksik dekontu merkeze bildirin.'
      }
    ],
    note: 'Sistemle çelişen manuel kayıtlar.'
  };
}
