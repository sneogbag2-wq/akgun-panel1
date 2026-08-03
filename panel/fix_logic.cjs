const fs = require('fs');
const path = 'src/services/customerService.ts';
let content = fs.readFileSync(path, 'utf8');

const regexAll = /(export function getAllCustomersForReportingSync\(\): any\[\] \{[\s\S]*?\n\})/;
const replacementAll = `export function getAllCustomersForReportingSync(): any[] {
  const balanceMap = getBalanceMap();
  const chequesMap = getChequeMap();
  const { salesByCust, colsByCust, credsByCust } = buildMapsIfNeeded()!;
  return mockCustomers.map((c) => {
    const bal = balanceMap[c.customerId] || 0;
    const cs = chequesMap[c.customerId] || 0;
    const openInvs = getOpenInvoices(salesByCust[c.customerId] || [], colsByCust[c.customerId] || [], credsByCust[c.customerId] || []);
    const overdueBalance = openInvs.filter(i => (i.daysOverdue || 0) > 0).reduce((sum, i) => sum + (i.openAmount || 0), 0);
    return {
      ...c,
      balance: bal,
      cekSenet: cs,
      toplamRisk: bal + cs,
      overdueBalance: overdueBalance,
    };
  });
}`;

content = content.replace(regexAll, replacementAll);

const regexGlobal = /(export function getGlobalFinancialSummarySync\(\) \{[\s\S]*?\n\})/;
const replacementGlobal = `export function getGlobalFinancialSummarySync() {
  const balanceMap = getBalanceMap();
  
  const isVirmanOrDevir = (item: any) => {
    if (!item) return false;
    const str = \`\${item.type || ''} \${item.eDocumentNo || ''} \${item.description || ''}\`;
    return str.includes('VIRMAN') || str.includes('Virman') || str.includes('DEVIR') || str.includes('Devir') || str.includes('DEVİR') || str.includes('ÖZEL_AKTARIM');
  };

  const totalSalesAmount = mockSalesInvoices
    .filter((inv) => !isVirmanOrDevir(inv))
    .reduce((sum, inv) => sum + (inv.amount || 0), 0);
  
  const totalCollectionAmount = mockCollections
    .filter((col) => col.status === 'CREATED' && !isVirmanOrDevir(col))
    .reduce((sum, col) => sum + (col.amount || 0), 0);
    
  const totalCreditNoteAmount = mockCreditNotes
    .filter((cn) => cn.status === 'CREATED' && !isVirmanOrDevir(cn))
    .reduce((sum, cn) => sum + (cn.amount || 0), 0);

  const totalNetReceivables = Object.values(balanceMap).reduce((sum, bal) => sum + (bal > 0 ? bal : 0), 0);

  const { salesByCust, colsByCust, credsByCust } = buildMapsIfNeeded()!;
  let totalOverdue = 0;
  for (const c of mockCustomers) {
      const openInvs = getOpenInvoices(salesByCust[c.customerId] || [], colsByCust[c.customerId] || [], credsByCust[c.customerId] || []);
      const overdueAmt = openInvs.filter(i => (i.daysOverdue || 0) > 0).reduce((sum, i) => sum + (i.openAmount || 0), 0);
      totalOverdue += overdueAmt;
  }

  return {
    totalSales: totalSalesAmount,
    totalSalesAmount,
    totalCollections: totalCollectionAmount,
    totalCollectionAmount,
    totalCreditNotes: totalCreditNoteAmount,
    totalCreditNoteAmount,
    netReceivables: totalNetReceivables,
    totalNetReceivables,
    totalOverdue,
    totalSalesInvoiceCount: mockSalesInvoices.length,
    totalCollectionCount: mockCollections.filter((col) => col.status === 'CREATED').length,
  };
}`;

content = content.replace(regexGlobal, replacementGlobal);

const regexRep = /(export function getMonthlySalesRepPerformanceSync\(\) \{[\s\S]*?\n\})/;
const replacementRep = `export function getMonthlySalesRepPerformanceSync() {
  if (repPerfCache) return repPerfCache;
  if (mockCustomers.length === 0) {
    loadSeedData();
  }

  const monthMetrics = getCurrentMonthMetricsSync();
  const ym = monthMetrics.yearMonth;
  const balanceMap = getBalanceMap();
  const { salesByCust, colsByCust, credsByCust } = buildMapsIfNeeded()!;

  const repMap: Record<string, any> = {};
  const custToRep: Record<string, string> = {};

  for (const c of mockCustomers) {
    const rep = c.salesRepName || c.salesRep || 'Key Account';
    custToRep[c.customerId] = rep;
    if (!repMap[rep]) {
      repMap[rep] = {
        repName: rep,
        customerCount: 0,
        monthSales: 0,
        monthCollections: 0,
        totalNetReceivables: 0,
        riskyCustomerCount: 0,
        totalOverdue28: 0,
        totalVadeSum: 0,
        vadeCustCount: 0,
        customers: [],
      };
    }
    const bal = balanceMap[c.customerId] || 0;
    // Sadece aktif müşterileri (bakiyesi olan) müşteri sayısına dahil ediyoruz
    if (bal !== 0 || (salesByCust[c.customerId] && salesByCust[c.customerId].length > 0)) {
        repMap[rep].customerCount += 1;
    }

    let overdueAmt = 0;
    let avgVade = 0;
    if (bal > 0) {
      repMap[rep].totalNetReceivables += bal;
      if (bal > 15000) {
        repMap[rep].riskyCustomerCount += 1;
      }
      const aging = getAgingBuckets(salesByCust[c.customerId] || [], colsByCust[c.customerId] || [], credsByCust[c.customerId] || []);
      avgVade = aging.averageVade || 0;
      if (avgVade > 0) {
        repMap[rep].totalVadeSum += avgVade;
        repMap[rep].vadeCustCount += 1;
      }

      // Calculate strictly >= 28 days overdue
      const openInvs = getOpenInvoices(salesByCust[c.customerId] || [], colsByCust[c.customerId] || [], credsByCust[c.customerId] || []);
      overdueAmt = openInvs.filter(i => (i.daysOverdue || 0) >= 28).reduce((sum, i) => sum + (i.openAmount || 0), 0);
      repMap[rep].totalOverdue28 += overdueAmt;
    }

    repMap[rep].customers.push({
      customerId: c.customerId,
      customerName: c.signName || c.customerName,
      balance: bal,
    });
  }

  for (const inv of mockSalesInvoices) {
    if (inv.invoiceDate) { // Tüm zamanlar cirosunu dahil edelim mi? Kullanıcı "Toplam Ciro ve Tahsilat" diyor, aylık değil.
      const rep = custToRep[inv.customerId] || 'Key Account';
      if (!repMap[rep]) {
        repMap[rep] = { repName: rep, customerCount: 0, monthSales: 0, monthCollections: 0, totalNetReceivables: 0, riskyCustomerCount: 0, customers: [] };
      }
      repMap[rep].monthSales += (inv.amount || 0);
    }
  }

  for (const col of mockCollections) {
    if (col.status === 'CREATED' && col.date) {
      const rep = custToRep[col.customerId] || 'Key Account';
      if (!repMap[rep]) {
        repMap[rep] = { repName: rep, customerCount: 0, monthSales: 0, monthCollections: 0, totalNetReceivables: 0, riskyCustomerCount: 0, customers: [] };
      }
      repMap[rep].monthCollections += (col.amount || 0);
    }
  }

  for (const rep of Object.values(repMap) as any[]) {
    rep.collectionPerformance = rep.monthSales > 0 ? Math.min(100, Math.round((rep.monthCollections / rep.monthSales) * 100)) : (rep.monthCollections > 0 ? 100 : 0);
    rep.averageVade = rep.vadeCustCount > 0 ? Math.round(rep.totalVadeSum / rep.vadeCustCount) : 0;
    
    // Calculate Risk Level properly based on collection and overdue
    if (rep.collectionPerformance < 50 || rep.totalOverdue28 > 100000) rep.riskLevel = "Kritik Risk";
    else if (rep.collectionPerformance < 75 || rep.totalOverdue28 > 50000) rep.riskLevel = "Yüksek Risk";
    else if (rep.collectionPerformance < 90 || rep.totalOverdue28 > 10000) rep.riskLevel = "Orta Risk";
    else rep.riskLevel = "Düşük Risk";
  }

  const repList = Object.values(repMap)
    .filter((r: any) => r.customerCount > 1) // Yeni kural: müşteri sayısı 1 olanları hesaplamalardan ve ekrandan çıkart
    .sort((a: any, b: any) => (b.monthSales || b.totalNetReceivables) - (a.monthSales || a.totalNetReceivables));

  repPerfCache = {
    monthLabel: monthMetrics.monthLabel,
    repList,
  };
  return repPerfCache;
}`;

content = content.replace(regexRep, replacementRep);

fs.writeFileSync(path, content, 'utf8');
console.log("Done");
