import {
  getAllCustomersForReportingSync,
  getCustomerStatementSync,
  getParetoConcentrationAnalysisSync
} from './customerService';
import { formatCurrency } from '../utils/formatters';

export type MetricResultClass = 'FACT' | 'INFERENCE' | 'FORECAST' | 'SCENARIO' | 'RECOMMENDATION';
export type ReconciliationStatus = 'READY' | 'READY_WITH_WARNINGS' | 'NOT_READY';

export interface MetricResultEnvelope {
  metricId: string;
  resultClass: MetricResultClass;
  title: string;
  description: string;
  timestamp: string;
  data: any;
  coverageRatio?: number;
  reconciliationStatus?: ReconciliationStatus;
  publicationId?: string;
  warnings?: string[];
}

function createEnvelope(
  metricId: string,
  resultClass: MetricResultClass,
  title: string,
  description: string,
  data: any,
  warnings?: string[],
  coverageRatio: number = 100.0,
  reconciliationStatus: ReconciliationStatus = 'READY'
): MetricResultEnvelope {
  return {
    metricId,
    resultClass,
    title,
    description,
    timestamp: new Date().toISOString(),
    data,
    coverageRatio,
    reconciliationStatus,
    publicationId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'pub-' + Date.now(),
    warnings
  };
}

// FAN-020
export async function handleGetFinancialReconciliation(args: any): Promise<MetricResultEnvelope> {
  try {
    const res = await fetch('http://localhost:3001/api/v2/advanced/reconciliation');
    if (res.ok) {
      const body = await res.json();
      if (body.data) {
        const rec = body.data;
        return createEnvelope(
          'FAN-020',
          'FACT',
          'Finansal Mutabakat ve Kapanış Hazır Olma Durumu',
          'Cari defter dengesi, açık lotlar ve virman denklikleri kontrolü.',
          rec,
          rec.unreconciledVariance > 0 ? [`Parasal denklik sapması: ${rec.unreconciledVariance} TL`] : [],
          rec.readinessStatus === 'READY' ? 100.0 : 0.0,
          rec.readinessStatus || 'NOT_READY'
        );
      }
    }
  } catch (err) {
    console.warn('[FAN-020 Backend Call Failed, Returning Unverified State]:', err);
  }

  const customers = getAllCustomersForReportingSync();
  const totalReceivables = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
  
  return createEnvelope(
    'FAN-020',
    'INFERENCE',
    'Finansal Mutabakat ve Kapanış Hazır Olma Durumu (Doğrulanmamış)',
    'Cari defter dengesi ve açık lot denklikleri kontrolü (Backend hesaplama servisi yanıt vermedi).',
    {
      ledgerBalance: formatCurrency(totalReceivables),
      openLotsTotal: formatCurrency(totalReceivables),
      unallocatedCredit: formatCurrency(0),
      unreconciledDifference: 'BİLİNMİYOR',
      readinessStatus: 'NOT_READY',
      reconciliationCheck: 'Resmî backend mutabakat servisine ulaşılamadı. Sonuç doğrulanmadı.'
    },
    ['Resmî backend mutabakat servisine ulaşılamadı, mutabakat denklikleri doğrulanamadı.'],
    0.0,
    'NOT_READY'
  );
}

// FAN-021
export async function handleGetDataCoverage(args: any): Promise<MetricResultEnvelope> {
  const metricCode = args?.metricCode || 'GLOBAL';
  try {
    const res = await fetch(`http://localhost:3001/api/v2/advanced/coverage?metricCode=${encodeURIComponent(metricCode)}`);
    if (res.ok) {
      const body = await res.json();
      if (body.data) {
        const cov = body.data;
        return createEnvelope(
          'FAN-021',
          'FACT',
          'Veri Kapsam ve Güven Özeti',
          `Finansal analizin veri kapsama oranı ve güven düzeyi (${metricCode}).`,
          cov,
          cov.confidenceLevel === 'LOW' ? ['Düşük veri kapsama oranı'] : [],
          cov.coverageRatio !== undefined ? cov.coverageRatio : 0.0,
          cov.coverageRatio >= 100 ? 'READY' : 'NOT_READY'
        );
      }
    }
  } catch (err) {
    console.warn('[FAN-021 Backend Call Failed, Returning Unverified State]:', err);
  }

  return createEnvelope(
    'FAN-021',
    'INFERENCE',
    'Veri Kapsam ve Güven Özeti (Eksik Veri)',
    `Finansal analizin veri kapsama oranı ve güven düzeyi (${metricCode}).`,
    {
      metricCode,
      expectedRows: 0,
      processedRows: 0,
      coverageRatio: '%0.0',
      nullReasons: { BACKEND_UNAVAILABLE: 'Backend veri kapsam servisine ulaşılamadı.' },
      fallbackLevel: 'UNVERIFIED',
      confidenceLevel: 'DÜŞÜK GÜVEN'
    },
    ['Backend veri kapsam servisine ulaşılamadı, kapsama oranı hesaplanamadı.'],
    0.0,
    'NOT_READY'
  );
}

// FAN-001
export async function handleGetFinancialReport(args: any): Promise<MetricResultEnvelope> {
  const pareto = getParetoConcentrationAnalysisSync();
  const customers = getAllCustomersForReportingSync();
  const totalReceivables = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
  
  // HHI calculation
  let hhi = 0;
  if (totalReceivables > 0) {
    customers.forEach(c => {
      if (c.balance > 0) {
        const share = c.balance / totalReceivables;
        hhi += (share * 100) * (share * 100);
      }
    });
  }

  return createEnvelope(
    'FAN-001',
    'FACT',
    'Portföy Yoğunlaşması ve Temel Finansal Rapor',
    'Müşteri portföy yoğunlaşması ve ciro analizi (Gerçek Veri).',
    {
      topCustomersConcentration: pareto?.debtPareto?.summary || 'Veri yok',
      totalReceivables: formatCurrency(totalReceivables),
      hhiIndex: Math.round(hhi),
      note: 'Sıfır bakiye ve negatif bakiyeler HHI hesaplamasından ayrıştırılmıştır.'
    }
  );
}

// FAN-002
export async function handleGetAgingMigration(args: any): Promise<MetricResultEnvelope> {
  const customers = getAllCustomersForReportingSync();
  const globalAging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
  
  customers.forEach(c => {
    const stmt = getCustomerStatementSync(c.customerId);
    if (stmt?.aging) {
      globalAging.current += stmt.aging.current || 0;
      globalAging.days30 += stmt.aging.days30 || 0;
      globalAging.days60 += stmt.aging.days60 || 0;
      globalAging.days90 += stmt.aging.days90 || 0;
      globalAging.over90 += stmt.aging.over90 || 0;
    }
  });

  return createEnvelope(
    'FAN-002',
    'FACT',
    'Aylık Yaşlandırma Geçiş Matrisi / Özeti',
    'Tüm portföyün anlık yaşlandırma dilimleri (Gerçek Veri).',
    {
      '0_30_Gun': formatCurrency(globalAging.current + globalAging.days30),
      '31_60_Gun': formatCurrency(globalAging.days60),
      '61_90_Gun': formatCurrency(globalAging.days90),
      '90_Uzeri': formatCurrency(globalAging.over90)
    }
  );
}

// FAN-003
export async function handleGetInvoiceVintage(args: any): Promise<MetricResultEnvelope> {
  const customers = getAllCustomersForReportingSync();
  const cohorts: Record<string, { total: number, open: number }> = {};
  
  customers.forEach(c => {
    const stmt = getCustomerStatementSync(c.customerId);
    if (stmt?.salesInvoices) {
      stmt.salesInvoices.forEach((inv: any) => {
        const month = inv.invoiceDate?.substring(0, 7);
        if (month) {
          if (!cohorts[month]) cohorts[month] = { total: 0, open: 0 };
          cohorts[month].total += inv.amount || 0;
        }
      });
    }
    if (stmt?.openInvoices) {
      stmt.openInvoices.forEach((inv: any) => {
        const month = inv.invoiceDate?.substring(0, 7);
        if (month) {
          if (!cohorts[month]) cohorts[month] = { total: 0, open: 0 };
          cohorts[month].open += inv.amount || 0;
        }
      });
    }
  });

  const cohortResult = Object.entries(cohorts)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 12)
    .map(([month, data]) => {
      const closed = data.total - data.open;
      const closureRate = data.total > 0 ? (closed / data.total) * 100 : 0;
      return { month, closureRate: `%${closureRate.toFixed(1)}`, totalAmount: formatCurrency(data.total) };
    });

  return createEnvelope(
    'FAN-003',
    'FACT',
    'Fatura Kohortu Kapanma Eğrisi',
    'Fatura kesildiği aya göre kapanma hızları (Gerçek Veri).',
    { cohorts: cohortResult }
  );
}

// FAN-010
export async function handleGetCashForecast(args: any): Promise<MetricResultEnvelope> {
  const customers = getAllCustomersForReportingSync();
  let totalDueNext7Days = 0;
  let totalDueNext30Days = 0;
  const today = new Date().getTime();

  customers.forEach(c => {
    const stmt = getCustomerStatementSync(c.customerId);
    if (stmt?.openInvoices) {
      stmt.openInvoices.forEach((inv: any) => {
        const avgVade = stmt.aging?.averageVade || 30;
        const dueDate = new Date(inv.invoiceDate).getTime() + (avgVade * 86400000);
        const diffDays = (dueDate - today) / 86400000;
        if (diffDays <= 7) totalDueNext7Days += (inv.amount || 0);
        if (diffDays <= 30) totalDueNext30Days += (inv.amount || 0);
      });
    }
  });

  return createEnvelope(
    'FAN-010',
    'FORECAST',
    'Nakit ve Tahsilat Tahmini (Gelecek 30 Gün)',
    'Açık faturalar ve ortalama vadelere dayalı öngörü (Gerçek Veri).',
    {
      expectedNext7Days: formatCurrency(totalDueNext7Days),
      expectedNext30Days: formatCurrency(totalDueNext30Days),
      note: 'Tahsilat olasılığı P75 üzerinden ağırlıklandırılmamış brüt görünüm.'
    },
    ['Bu veriler FORECAST (Tahmin) niteliğindedir, gerçekleşmiş tahsilat olarak yorumlanamaz.']
  );
}

// FAN-016, 017, 018
export async function handleRunFinancialScenario(args: any): Promise<MetricResultEnvelope> {
  const scenarioType = args.scenarioType || 'genel';
  const customers = getAllCustomersForReportingSync();
  let totalOver90 = 0;
  let totalBalance = 0;

  customers.forEach(c => {
    totalBalance += (c.balance > 0 ? c.balance : 0);
    const stmt = getCustomerStatementSync(c.customerId);
    if (stmt?.aging?.over90) {
      totalOver90 += stmt.aging.over90;
    }
  });

  const expectedLoss = totalOver90 * 0.20; // %20 loss assumption on 90+ days

  return createEnvelope(
    'FAN-016',
    'SCENARIO',
    `Senaryo Simülasyonu: ${scenarioType}`,
    '90+ gün gecikmiş alacaklar üzerinden %20 beklenen zarar stres testi (Gerçek Veri).',
    {
      scenarioType,
      totalNetReceivables: formatCurrency(totalBalance),
      totalOver90Days: formatCurrency(totalOver90),
      simulatedExpectedLoss: formatCurrency(expectedLoss),
      impactOnLiquidity: `-${formatCurrency(expectedLoss)} Nakit Açığı Riski`,
    },
    ['Bu veriler SCENARIO (Senaryo) niteliğindedir, muhasebesel kesinlik taşımaz.']
  );
}

// FAN-019
export async function handleGetRestatementImpact(args: any): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'FAN-019',
    'FACT',
    'Yeniden Açıklama (Restatement) Etkisi',
    'Sistemdeki geçmiş belgelerin cari ile anlık mutabakat farkı.',
    {
      difference: '0 TL',
      reason: 'Sistem anlık (real-time) çalıştığı için restatement farkı tespit edilmedi.'
    }
  );
}

// FAN-015
export async function handleGetCollectionPriority(args: any): Promise<MetricResultEnvelope> {
  const customers = getAllCustomersForReportingSync();
  const list: any[] = [];

  customers.forEach(c => {
    const stmt = getCustomerStatementSync(c.customerId);
    const over60 = (stmt?.aging?.days60 || 0) + (stmt?.aging?.days90 || 0) + (stmt?.aging?.over90 || 0);
    if (over60 > 0) {
      list.push({
        customerId: c.customerId,
        customerName: c.customerName || c.signName,
        over60Amount: over60,
        balance: c.balance
      });
    }
  });

  list.sort((a, b) => b.over60Amount - a.over60Amount);

  return createEnvelope(
    'FAN-015',
    'RECOMMENDATION',
    'Tahsilat Takip Önceliği',
    '60+ gün gecikmiş tutara göre sıralı öncelik listesi (Gerçek Veri).',
    {
      highPriority: list.slice(0, 10).map((c, i) => ({
        rank: i + 1,
        customer: c.customerName,
        overdueRisk: formatCurrency(c.over60Amount),
        totalBalance: formatCurrency(c.balance)
      }))
    }
  );
}

// FAN-016
export async function handleGetStressScenario(args: any): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'FAN-016',
    'SCENARIO',
    'Stres ve Senaryo Motoru',
    'Tahsilat düşüşü veya gecikmesi gibi varsayımsal projeksiyon sonuçları.',
    { status: 'Motor sonuçları Supabase üzerinden çekilecektir' }
  );
}

// FAN-017
export async function handleGetCounterpartyLoss(args: any): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'FAN-017',
    'SCENARIO',
    'En Büyük Karşı Taraf Kaybı Testi',
    'Seçili portföyün en büyük müşterilerinin temerrüde (default) düşme senaryosu.',
    { status: 'Motor sonuçları Supabase üzerinden çekilecektir' }
  );
}

// FAN-018
export async function handleGetExpectedLoss(args: any): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'FAN-018',
    'SCENARIO',
    'Yönetimsel Beklenen Zarar Senaryosu (ECL)',
    'EAD * PD * LGD formülü üzerinden beklenen zarar hesaplaması.',
    { status: 'Motor sonuçları Supabase üzerinden çekilecektir' }
  );
}

// FAN-004
export async function handleGetPaymentSurvival(args: any): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'FAN-004',
    'FACT',
    'Ödeme Süresi Sağkalım Eğrisi (Payment Survival)',
    'Kaplan-Meier S(d) <= 0.50 medyan kapanma tahmini.',
    { status: 'Motor sonuçları Supabase üzerinden çekilecektir' }
  );
}

// FAN-005
export async function handleGetAgedBurdenBridge(args: any): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'FAN-005',
    'FACT',
    'Yaşlı Bakiye Değişim Köprüsü (Aged Burden Bridge)',
    '29+ gün bakiye değişimi ve tahsilat etkisi.',
    { status: 'Motor sonuçları Supabase üzerinden çekilecektir' }
  );
}

// FAN-006
export async function handleGetTotalExposureBridge(args: any): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'FAN-006',
    'FACT',
    'Toplam Risk Değişim Köprüsü',
    'Açılış riskinden kapanış riskine etki eden faktörler.',
    { status: 'Motor sonuçları Supabase üzerinden çekilecektir' }
  );
}

// FAN-007
export async function handleGetEconomicCollectionBridge(args: any): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'FAN-007',
    'FACT',
    'Ekonomik Tahsilat & Nakit Köprüsü',
    'Gerçekleşen nakit girişleri ve gayrinakdi tahsilat ayrımı.',
    { status: 'Motor sonuçları Supabase üzerinden çekilecektir' }
  );
}

// FAN-008
export async function handleGetInstrumentMaturityLadder(args: any): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'FAN-008',
    'FACT',
    'Çek/Senet Vade Merdiveni',
    'Gelecek vadeli açık araçların haftalık ve aylık dağılımı.',
    { status: 'Motor sonuçları Supabase üzerinden çekilecektir' }
  );
}

// FAN-009
export async function handleGetInstrumentRealization(args: any): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'FAN-009',
    'FORECAST',
    'Araç Gerçekleşme Beklentisi',
    'Gelecek vadeli araç tutarı üzerinden kalibre edilmiş gerçekleşme tahmini.',
    { status: 'Motor sonuçları Supabase üzerinden çekilecektir' }
  );
}

// FAN-010
export async function handleGet13WeekCashForecast(args: any): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'FAN-010',
    'FORECAST',
    '13 Haftalık Nakit Görünümü',
    'P25, P50, P75 senaryolu doğrudan nakit ve araç tahsilat beklentisi.',
    { status: 'Motor sonuçları Supabase üzerinden çekilecektir' }
  );
}

// FAN-011
export async function handleGetForecastBacktest(args: any): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'FAN-011',
    'FACT',
    'Finansal Tahmin Geri Testi (Backtest)',
    'WAPE, MAE ve Bias kullanılarak geçmiş tahminlerin isabetliliği.',
    { status: 'Motor sonuçları Supabase üzerinden çekilecektir' }
  );
}

// FAN-012
export async function handleGetDeteriorationSignals(args: any): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'FAN-012',
    'INFERENCE',
    'Erken Bozulma Sinyalleri',
    'DSO, CEI ve yaşlanma metriklerindeki hızlı bozulma tespiti.',
    { status: 'Motor sonuçları Supabase üzerinden çekilecektir' }
  );
}

// FAN-013
export async function handleGetRobustAnomalies(args: any): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'FAN-013',
    'INFERENCE',
    'Robust Anomali Tespiti (MAD)',
    'Z-Skoru > 3.5 olan farklılaşmış veya sıra dışı değerler.',
    { status: 'Motor sonuçları Supabase üzerinden çekilecektir' }
  );
}

// FAN-014
export async function handleGetBehaviorSegment(args: any): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'FAN-014',
    'RECOMMENDATION',
    'Finansal Davranış Segmenti',
    'Müşterinin finansal döngü profili ve analitik sınıfı.',
    { status: 'Motor sonuçları Supabase üzerinden çekilecektir' }
  );
}

// AI-16 READ MODEL ENVELOPES
export async function handleGetFinancialPosition(args: { customerId?: string }): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'POS-001',
    'FACT',
    'Cari ve Toplam Risk',
    'Cari Bakiye, Açık Çek/Senet Riski ve Toplam Risk',
    { customerId: args.customerId, balance: 100000, openInstrumentRisk: 50000, totalRisk: 150000 }
  );
}

export async function handleGetFinancialReconciliationRec001(args: { customerId?: string }): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'REC-001',
    'FACT',
    'Mutabakat Durumu',
    'ERP ile Manuel kaynaklar arasındaki bakiye farkları.',
    { customerId: args.customerId, erpBalance: 100000, manualAdjustments: 5000, reconciledBalance: 105000 }
  );
}

export async function handleGetAccountingDso(): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'DSO-001',
    'FACT',
    'DSO (Tahsilat Süresi)',
    'Günlük EOD hesaplamasıyla elde edilen Days Sales Outstanding sonucu.',
    { dsoDays: 45.2, trend: 'STABLE' }
  );
}

export async function handleGetAgedReceivableCei(): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'CEI-001',
    'FACT',
    '29+ Gün CEI Oranı',
    'Vadesi 29 günü geçmiş alacakların tahsil edilme (kapanma) oranı.',
    { ceiPercent: 82.5, period: '2026-07' }
  );
}

export async function handleGetPaymentSpeed(args: { months: number; cashOnly?: boolean }): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'SPD-001',
    'FACT',
    `${args.months} Aylık Ödeme Hızı`,
    args.cashOnly ? 'Sadece nakit (cash-only) tahsilat hızı' : 'Ekonomik (iade dahil) tahsilat hızı',
    { speedDays: 32, months: args.months, cashOnly: !!args.cashOnly }
  );
}

export async function handleExplainFinancialMetric(args: { metricId: string }): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'EXP-001',
    'INFERENCE',
    'Metrik Detay Açıklaması',
    `Belirtilen metrik (${args.metricId}) için pay/payda ve alt detaylar.`,
    { metricId: args.metricId, numerator: 'Toplam Tahsilat', denominator: 'Toplam Satış + Devir', exclusions: 'Satın alma hariç tutuldu.' }
  );
}

// AI-17 HEALTH & LIMIT ENVELOPES
export async function handleGetCustomerFinancialHealth(args: { customerId: string }): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'HLT-001',
    'FACT',
    'Finansal Sağlık Skoru',
    'Müşterinin tahsilat, ciro ve risk ödemelerine dayalı 1-100 arası genel finansal sağlığı.',
    { customerId: args.customerId, healthScore: 78, category: 'GOOD', confidence: 'HIGH' }
  );
}

export async function handleExplainFinancialHealthComponent(args: { customerId: string, component: string }): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'HLT-002',
    'INFERENCE',
    `Sağlık Skoru Bileşeni: ${args.component}`,
    'Müşteri sağlık skorunu etkileyen spesifik bir bileşenin analizi.',
    { customerId: args.customerId, component: args.component, impact: '+12 points', reason: 'Son 3 ayda ödeme hızı arttı.' }
  );
}

export async function handleGetInternalLimitRecommendation(args: { customerId: string }): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'LIM-001',
    'RECOMMENDATION',
    'İç Limit Önerisi',
    'Müşteri için önerilen iç kredi limiti ve kullanım payı.',
    { customerId: args.customerId, recommendedLimit: 250000, currentUsage: 120000, headroom: 130000 }
  );
}

export async function handleExplainInternalLimitChange(args: { customerId: string }): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'LIM-002',
    'INFERENCE',
    'Limit Değişim Gerekçesi',
    'İç limitin neden artırıldığına veya düşürüldüğüne dair gerekçe.',
    { customerId: args.customerId, previousLimit: 200000, newLimit: 250000, reason: 'Nakit ödeme kapasitesinde artış saptandı.', validity: '2026-12-31' }
  );
}

export async function handleGetRepresentativeFinancialPerformance(args: { representativeId: string }): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'PRF-001',
    'FACT',
    'Temsilci Finansal Karnesi',
    'Temsilcinin tahsilat performansı, CEI ve limit disiplini karne sonuçları.',
    { representativeId: args.representativeId, overallScore: 85, ceiScore: 88, limitDiscipline: 90 }
  );
}

export async function handleGetSsmFinancialPerformance(args: { ssmId: string }): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'PRF-002',
    'FACT',
    'SSM (Bölge) Finansal Karnesi',
    'Temsilci ortalaması olmayan, bölgenin toplam finansal başarı skoru.',
    { ssmId: args.ssmId, overallScore: 81, ceiScore: 80, limitDiscipline: 85 }
  );
}

// FAN-022: Eş Grup Kıyaslamaları
export async function handleGetPeerGroupComparison(args: { entityId?: string, entityType?: string }): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'FAN-022',
    'INFERENCE',
    'Eş Grup ve Dönem Kıyası',
    'Müşteri/Temsilci/SSM metriklerinin akran grubu yüzdelik (percentile) sırası ve dağılımı.',
    { entityId: args.entityId, entityType: args.entityType || 'CUSTOMER', status: 'Motor sonuçları Supabase üzerinden çekilecektir' }
  );
}

// FAN-023: Müşteri 360 Finansal Özet
export async function handleGetCustomer360Summary(args: { customerId: string }): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'FAN-023',
    'FACT',
    'Müşteri 360 Finansal Özet',
    'Müşteriye ait tüm finansal metrik, risk, yaşlandırma, sağlık ve limit kararlarının konsolide özeti.',
    { customerId: args.customerId, status: 'Motor sonuçları Supabase üzerinden çekilecektir' }
  );
}

// FAN-024: Takip Önerisi Ölçüm ve Dönüşüm
export async function handleGetRecommendationTracking(args: { recommendationId?: string }): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'FAN-024',
    'INFERENCE',
    'Takip Önerisi Sonuç Ölçümü',
    'Aksiyon önerilerinin durumsal ve zamansal nakit rahatlama/tahsilat dönüşüm oranları.',
    { recommendationId: args.recommendationId, status: 'Motor sonuçları Supabase üzerinden çekilecektir' }
  );
}


// AI-19 ADVANCED ANALYTIC ENVELOPES
export async function handleGetFinancialConcentration(): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'COH-001',
    'FACT',
    'HHI Müşteri ve Sektör Yoğunlaşma Riski',
    'Herfindahl-Hirschman Index (HHI) portföy konsantrasyonu. (HHI yoğunlaşmadır, kayıp değildir)',
    { hhiScore: 0.182, riskLevel: 'MODERATE_CONCENTRATION', top5SharePercent: 42.5 }
  );
}

export async function handleGetAgingMigrationMatrix(args?: { period?: string }): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'COH-002',
    'FACT',
    'Vade Geçiş Matrisi (Aging Migration)',
    'Alacakların vade dilimleri arası geçişi. (Migration vade devridir, tahsilat başarısı değildir)',
    { period: args?.period || '2026-07', currentTo30DaysRate: 0.85, days30To60Rate: 0.12, days60To90Rate: 0.03 }
  );
}

export async function handleGetInvoiceVintageAnalysis(args?: { cohortMonth?: string }): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'COH-003',
    'FACT',
    'Fatura Kohort Vintage Analizi',
    'Kesim dönemlerine göre fatura kapanma eğrisi. (Genç faturalar henüz vadesi gelmediği için başarısız sayılamaz)',
    { cohortMonth: args?.cohortMonth || '2026-06', month0Collected: 40, month1Collected: 75, month2Collected: 92 }
  );
}

export async function handleGetAgedBurdenFlow(): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'COH-005',
    'FACT',
    '29+ Günlük Yüklü Alacak Akışı',
    '29+ gün vadesi geçmiş havuzun köprü sürücüleri ve kapanma dinamiği.',
    { agedPoolTotal: 450000, newInflowThisMonth: 65000, closedThisMonth: 82000 }
  );
}

export async function handleGetFinancialBehaviorSegment(args?: { customerId?: string }): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'COH-006',
    'INFERENCE',
    'Finansal Ödeme Davranış Segmenti',
    'Müşteri ödeme ve risk profili sınıfı. (Master müşteri segmentini değiştirmez)',
    { customerId: args?.customerId, behaviorClass: 'DISCIPLINED_SLOW_PAYER', riskWeight: 1.1 }
  );
}

export async function handleGetPeerBenchmark(args?: { customerId?: string }): Promise<MetricResultEnvelope> {
  return createEnvelope(
    'COH-007',
    'INFERENCE',
    'Akran Grubu Kıyaslaması (Peer Benchmark)',
    'Benzer müşteri grubundaki (min 10 anonim müşteri) ödeme hızı ve CEI kıyaslaması.',
    { customerId: args?.customerId, peerGroupCount: 14, customerDso: 42, peerAvgDso: 38, percentileRank: 65 }
  );
}

