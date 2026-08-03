import { getMonthlySalesRepPerformanceSync } from './src/services/customerService';

const perf = getMonthlySalesRepPerformanceSync();
console.log(JSON.stringify(perf.repList.map((r: any) => ({
  repName: r.repName,
  monthSales: r.monthSales,
  monthCollections: r.monthCollections,
  totalNetReceivables: r.totalNetReceivables,
  primResult: r.primResult
})), null, 2));
