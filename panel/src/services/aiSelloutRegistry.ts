export async function handleGetSelloutHistoricalComparison(args: { basePeriod: string; comparePeriod: string }): Promise<any> {
  const { basePeriod, comparePeriod } = args;
  // Mock veri
  return {
    status: 'SUCCESS',
    reportType: 'HISTORICAL_COMPARISON',
    basePeriod,
    comparePeriod,
    metrics: {
      volumeDeltaPercent: 12.5,
      openChannelShareChange: 2.1, // Açık kanal payı %2.1 arttı
      closedChannelShareChange: -2.1,
    },
    note: 'Veriler ana veri kaynağından (Single Source of Truth) çekilmiştir.'
  };
}

export async function handleGetSelloutMonthlyReport(args: { period: string }): Promise<any> {
  return {
    status: 'SUCCESS',
    reportType: 'MONTHLY_REPORT',
    period: args.period,
    totalVolumeLiters: 450000,
    openChannelVolume: 300000,
    closedChannelVolume: 150000,
    note: 'Aylık Sellout hacmi.'
  };
}

export async function handleGetSelloutComparisonContributions(args: { basePeriod: string; comparePeriod: string }): Promise<any> {
  return {
    status: 'SUCCESS',
    reportType: 'COMPARISON_CONTRIBUTIONS',
    topGainers: ['Müşteri A (+%15)', 'Müşteri B (+%10)'],
    topLosers: ['Müşteri C (-%20)'],
    note: 'Değişime en çok etki eden aktörler.'
  };
}

export async function handleCreateSelloutReportPack(args: { reportName: string }): Promise<any> {
  return {
    status: 'SUCCESS',
    reportType: 'REPORT_PACK_CREATED',
    reportName: args.reportName,
    formats: ['PDF', 'EXCEL'],
    downloadLink: '/downloads/reports/sellout-pack.zip',
    note: 'Sellout manifesti üzerinden PDF ve Excel oluşturuldu, rakamlar sohbetteki verilerle birebir aynıdır.'
  };
}

export async function handleCalculateSelloutProbability(args: { customerId?: string; productCode?: string }): Promise<any> {
  return {
    status: 'SUCCESS',
    reportType: 'SELLOUT_PROBABILITY',
    customerId: args.customerId || 'GENEL',
    productCode: args.productCode || 'GENEL',
    probabilityPercent: 78.5,
    note: 'Müşteri/Ürün bazlı temsilî (mock) Sellout olasılık hesabı.'
  };
}
