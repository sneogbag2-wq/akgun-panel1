const fs = require('fs');
const path = 'c:\\Users\\monds\\Desktop\\test\\panel\\src\\services\\customerService.ts';

let content = fs.readFileSync(path, 'utf8');

// The replacement logic:
const oldSignature = `export function getMonthlySalesRepPerformanceSync() {
  if (repPerfCache) return repPerfCache;`;
  
const newSignature = `export function getMonthlySalesRepPerformanceSync(selectedMonth?: string) {
  // if (repPerfCache && !selectedMonth) return repPerfCache; // Disable cache for now to ensure month filtering works dynamically
`;

const oldMonthMetrics = `const monthMetrics = getCurrentMonthMetricsSync();
  const ym = monthMetrics.yearMonth;`;
  
const newMonthMetrics = `const monthMetrics = getCurrentMonthMetricsSync();
  const ym = selectedMonth || monthMetrics.yearMonth;
  const isTargetMonth = (dateStr: string) => String(dateStr || '').startsWith(ym);
`;

const oldSalesLoop = `for (const inv of mockSalesInvoices) {
    if (inv.invoiceDate) { // Tüm zamanlar cirosunu dahil edelim mi? Kullanıcı "Toplam Ciro ve Tahsilat" diyor, aylık değil.
      const rep = custToRep[inv.customerId] || 'Key Account';
      if (!repMap[rep]) {
        repMap[rep] = { repName: rep, customerCount: 0, monthSales: 0, monthCollections: 0, totalNetReceivables: 0, riskyCustomerCount: 0, customers: [] };
      }
      repMap[rep].monthSales += (inv.amount || 0);
    }
  }`;

const newSalesLoop = `for (const inv of mockSalesInvoices) {
    if (inv.invoiceDate && isTargetMonth(inv.invoiceDate)) {
      const rep = custToRep[inv.customerId] || 'Key Account';
      if (!repMap[rep]) {
        repMap[rep] = { repName: rep, customerCount: 0, monthSales: 0, monthCollections: 0, totalNetReceivables: 0, riskyCustomerCount: 0, customers: [] };
      }
      repMap[rep].monthSales += (inv.amount || 0);
    }
  }`;

const oldColsLoop = `for (const col of mockCollections) {
    if (col.status === 'CREATED' && col.date) {
      const rep = custToRep[col.customerId] || 'Key Account';
      if (!repMap[rep]) {
        repMap[rep] = { repName: rep, customerCount: 0, monthSales: 0, monthCollections: 0, totalNetReceivables: 0, riskyCustomerCount: 0, customers: [] };
      }
      repMap[rep].monthCollections += (col.amount || 0);
    }
  }`;

const newColsLoop = `for (const col of mockCollections) {
    if (col.status === 'CREATED' && col.date && isTargetMonth(col.date)) {
      const rep = custToRep[col.customerId] || 'Key Account';
      if (!repMap[rep]) {
        repMap[rep] = { repName: rep, customerCount: 0, monthSales: 0, monthCollections: 0, totalNetReceivables: 0, riskyCustomerCount: 0, customers: [] };
      }
      repMap[rep].monthCollections += (col.amount || 0);
    }
  }`;

const oldFilterSort = `const repList = Object.values(repMap)
    .filter((r: any) => r.customerCount > 1) // Yeni kural: müşteri sayısı 1 olanları hesaplamalardan ve ekrandan çıkart
    .sort((a: any, b: any) => (b.monthSales || b.totalNetReceivables) - (a.monthSales || a.totalNetReceivables));`;

const newFilterSort = `const activeCustomers = mockCustomers.filter((c: any) => !isPassiveOrCanceledStatus(c.customerStatus));
  const activeCustomerCount = activeCustomers.length;
  const threshold = Math.max(2, activeCustomerCount * 0.02); // %2 kuralı

  const repList = Object.values(repMap)
    .filter((r: any) => 
      r.customerCount >= threshold && 
      !['Belirtilmemiş', 'Key Account', '—'].includes(r.repName)
    )
    .sort((a: any, b: any) => (b.monthSales || b.totalNetReceivables) - (a.monthSales || a.totalNetReceivables));`;
    
const oldReturn = `repPerfCache = {
    monthLabel: monthMetrics.monthLabel,
    repList,
  };
  return repPerfCache;`;
  
const newReturn = `
  const [y, m] = ym.split('-');
  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const formattedMonthLabel = \`\${monthNames[parseInt(m, 10) - 1] || ''} \${y}\`;

  repPerfCache = {
    monthLabel: formattedMonthLabel,
    repList,
  };
  return repPerfCache;`;


content = content.replace(oldSignature, newSignature);
content = content.replace(oldMonthMetrics, newMonthMetrics);
content = content.replace(oldSalesLoop, newSalesLoop);
content = content.replace(oldColsLoop, newColsLoop);
content = content.replace(oldFilterSort, newFilterSort);
content = content.replace(oldReturn, newReturn);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched customerService.ts');
