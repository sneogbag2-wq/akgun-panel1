export interface ReportArtifactPlan {
  reportKey: string;
  formats: string[];
  primaryPeriod?: string;
  comparisonPeriod?: string;
  filters?: Record<string, any>;
}

/**
 * AI tarafından talep edilen rapor (PDF, Excel vb.) oluşturma işlerini (job)
 * kuyruğa alır ve simüle edilmiş indirme bağlantıları döner.
 */
export async function handleGenerateReportArtifact(plan: ReportArtifactPlan): Promise<any> {
  const jobId = 'job_' + Date.now();
  const timestamp = new Date().toISOString();
  
  // Rapor üretimi asenkron bir süreç olduğu için hemen hazır yanıtı dönüyoruz
  // Gerçek senaryoda bu bir backend job tablosuna (örn. Redis/BullMQ) yazılır.
  
  const artifacts = plan.formats.map(format => {
    const ext = format.toLowerCase();
    return {
      format: format.toUpperCase(),
      fileName: `${plan.reportKey}_${timestamp.substring(0, 10)}.${ext}`,
      downloadUrl: `/api/downloads/${jobId}/${ext}`, // Mock link
      status: 'READY'
    };
  });

  return {
    success: true,
    message: "Rapor üretimi başarıyla kuyruğa alındı ve dosyalar hazırlandı.",
    jobId,
    details: {
      reportKey: plan.reportKey,
      primaryPeriod: plan.primaryPeriod || 'Tüm Zamanlar',
      comparisonPeriod: plan.comparisonPeriod || 'Yok',
      appliedFilters: plan.filters || {}
    },
    artifacts
  };
}

export async function handleGetAiFocusAnalysis(args: { entityId: string, entityType: string }): Promise<any> {
  return {
    entityId: args.entityId,
    entityType: args.entityType,
    focusDigest: {
      domainStatus: "Kritik Eşik Aşımı",
      claims: [
        { type: "FACT", text: "Son 30 günde ödeme hızı %20 yavaşladı.", evidence: ["metric: payment_speed", "value: 45 days"] },
        { type: "INFERENCE", text: "Mevcut risk, önerilen limitin %15 üzerinde seyrediyor.", evidence: ["metric: headroom", "value: -35000"] },
        { type: "RECOMMENDATION", text: "Acil tahsilat araması yapılmalı ve bekleyen 2 sevkiyat bekletilmeli.", evidence: ["workflow: collection_call", "workflow: hold_dispatch"] }
      ],
      nextAction: "Manuel İnceleme Gerekiyor"
    }
  };
}
