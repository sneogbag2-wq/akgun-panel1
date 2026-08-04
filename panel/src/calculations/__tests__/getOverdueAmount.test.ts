import { describe, it, expect } from 'vitest';
import { getOverdueAmount, getAgingBuckets } from '../cariCalculations';

describe('getOverdueAmount - fatura tarihi bazlı kanonik hesap', () => {
  const ref = new Date('2026-08-03');

  it('tam 28 gün eşiğini fatura tarihinden doğru uygular', () => {
    const sales = [
      { invoiceId: 'A', invoiceDate: '2026-07-06', amount: 1000 }, // 28 gün önce -> dahil
      { invoiceId: 'B', invoiceDate: '2026-07-10', amount: 500 },  // 24 gün önce -> dahil değil
      { invoiceId: 'C', invoiceDate: '2026-06-01', amount: 2000 }, // 63 gün önce -> dahil
    ];
    const result = getOverdueAmount(sales, [], [], 28, ref);
    expect(result).toBe(3000); // A + C, B hariç
  });

  it('30 günlük bucket yaklaşıklığından farklı/daha doğru sonuç verir (28-29 gün arası fatura artık yakalanıyor)', () => {
    const sales = [{ invoiceId: 'X', invoiceDate: '2026-07-05', amount: 777 }]; // 29 gün önce
    const exact = getOverdueAmount(sales, [], [], 28, ref);
    const bucketApprox = getAgingBuckets(sales, [], [], ref);
    const oldApprox = (bucketApprox.days30 || 0) + (bucketApprox.days60 || 0) + (bucketApprox.days90 || 0) + (bucketApprox.over90 || 0);
    expect(exact).toBe(777);      // yeni: 28 gün eşiğiyle doğru şekilde yakalanıyor
    expect(oldApprox).toBe(0);    // eski: 30 gün eşiği yüzünden kaçırılıyordu (raporda hep 0 görünmesinin sebebi)
  });
});
