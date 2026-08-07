import { formatCurrency } from '../utils/formatters';

export async function handleGetTodaysDispatchOrders(): Promise<any> {
  // Bugüne ait operasyonel çıkış/dağıtım siparişleri (Lojistik)
  return {
    status: 'SUCCESS',
    reportType: 'DISPATCH_OPERATION',
    date: new Date().toISOString().split('T')[0],
    summary: {
      totalVehicles: 3,
      totalOrders: 15,
      pendingLoad: 2,
      onRoute: 1
    },
    exceptionNotes: 'Herhangi bir lojistik/operasyonel kriz bulunmuyor.',
    note: 'Bu veri yalnızca deponun dağıtıma çıkaracağı fiziksel yükü (Operasyon) gösterir, finansal eşleşme içermez.'
  };
}

export async function handleGetDeliveredInvoiceControls(args: { customerId?: string }): Promise<any> {
  // Malı gitmiş ama finansal FIFO/Peşin kontrolü henüz kapanmamış faturalar (Finans)
  return {
    status: 'SUCCESS',
    reportType: 'INVOICE_CONTROL',
    customerId: args.customerId || 'Tümü',
    unmatchedInvoicesCount: 4,
    totalUnmatchedAmount: formatCurrency(125000),
    topRisk: 'Fatura no: INV-2023-001 (Teslimat yapıldı ancak dünkü ödemeyle henüz eşleşmedi, FIFO uyuşmazlığı var).',
    note: 'Bu veri teslimatı tamamlanmış resmî faturaların tahsilat (FIFO/Peşin) mutabakat durumunu (Finans) gösterir.'
  };
}

export async function handleExplainInvoiceControlAlert(args: { documentId: string }): Promise<any> {
  return {
    status: 'SUCCESS',
    documentId: args.documentId,
    alertLevel: 'HIGH',
    issue: 'FIFO Uyumsuzluğu',
    explanation: 'Dün gelen 50.000 TL ödeme, bu faturadan önce bekleyen eski bir iade/lot işlemine (allocation) sayılmıştır. Dolayısıyla bu teslimat henüz finanse edilmemiştir.',
    recommendation: 'Satış temsilcisine veya tahsilat birimine faturanın güncel durumunu sorun.'
  };
}
