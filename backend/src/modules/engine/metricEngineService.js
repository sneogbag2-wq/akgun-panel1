import crypto from 'crypto';

export class MetricEngineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MetricEngineError';
  }
}

/**
 * Paket 13: Merkezî Metrik Motoru Servisi
 * Resmî MetricResultEnvelope Zarfı ve Yayınlama Mantığı
 */
export function createMetricEngineService(supabaseClient) {
  return Object.freeze({
    _isBlocked: false,

    // Yeni bir Calculation Run başlatır
    async startRun(runDate = new Date().toISOString()) {
      const runId = crypto.randomUUID();
      const runPayload = {
        run_id: runId,
        status: 'PENDING',
        run_date: runDate,
        created_at: new Date().toISOString()
      };

      if (supabaseClient && typeof supabaseClient.from === 'function') {
        try {
          await supabaseClient.from('calculation_runs').insert(runPayload);
        } catch (err) {
          // Fallback log
        }
      }

      return { runId, status: 'PENDING', runDate };
    },

    // İlgili Run ID altına tipli resmî MetricResultEnvelope kaydeder
    async recordMetric(runId, customerId, metricCode, metricValue, envelopeOptions = {}) {
      const resultId = crypto.randomUUID();
      const publicationId = envelopeOptions.publicationId || crypto.randomUUID();
      const resultClass = envelopeOptions.resultClass || 'FACT'; // FACT | INFERENCE | FORECAST | SCENARIO | RECOMMENDATION
      const coverageRatio = envelopeOptions.coverageRatio ?? 100.0;
      const reconciliationStatus = envelopeOptions.reconciliationStatus || 'READY'; // READY | READY_WITH_WARNINGS | NOT_READY

      const metricRecord = {
        id: resultId,
        run_id: runId,
        customer_id: customerId,
        metric_code: metricCode,
        metric_value: typeof metricValue === 'number' ? metricValue : null,
        result_class: resultClass,
        coverage_ratio: coverageRatio,
        reconciliation_status: reconciliationStatus,
        publication_id: publicationId,
        created_at: new Date().toISOString()
      };

      if (supabaseClient && typeof supabaseClient.from === 'function') {
        const { error } = await supabaseClient
          .from('metric_results')
          .upsert(metricRecord, { onConflict: 'run_id,customer_id,metric_code' });
        
        if (error) {
          throw new MetricEngineError(`Metrik kaydetme hatası (${metricCode}): ${error.message}`);
        }
      }

      return {
        id: resultId,
        publicationId,
        runId,
        customerId,
        metricCode,
        value: metricValue,
        resultClass,
        coverageRatio,
        reconciliationStatus,
        createdAt: metricRecord.created_at
      };
    },

    // Run işlemini başarıyla kapatır
    async completeRun(runId) {
      if (supabaseClient && typeof supabaseClient.from === 'function') {
        await supabaseClient
          .from('calculation_runs')
          .update({ status: 'SUCCESS' })
          .eq('run_id', runId);
      }
      return { runId, status: 'SUCCESS' };
    },

    // AI ve UI katmanı için müşterinin ilgili metrikteki son zarfını döner
    async getLatestMetric(customerId, metricCode) {
      if (!supabaseClient || typeof supabaseClient.from !== 'function') {
        return {
          id: crypto.randomUUID(),
          metricCode,
          value: null,
          resultClass: 'FACT',
          coverageRatio: 100,
          reconciliationStatus: 'READY',
          timestamp: new Date().toISOString()
        };
      }

      const { data, error } = await supabaseClient
        .from('metric_results')
        .select('*')
        .eq('customer_id', customerId)
        .eq('metric_code', metricCode)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;

      return {
        id: data.id,
        runId: data.run_id,
        publicationId: data.publication_id,
        metricCode: data.metric_code,
        value: data.metric_value,
        resultClass: data.result_class || 'FACT',
        coverageRatio: data.coverage_ratio || 100.0,
        reconciliationStatus: data.reconciliation_status || 'READY',
        timestamp: data.created_at
      };
    },

    // Bir metriğin bağımlılıklarını döner
    async getMetricDependencies(metricCode) {
      if (!supabaseClient || typeof supabaseClient.from !== 'function') return [];
      const { data } = await supabaseClient
        .from('metric_dependencies')
        .select('dependent_metric_id, metric_definitions!dependent_metric_id(code)')
        .eq('metric_definitions.code', metricCode);

      return data ? data.map(d => d.metric_definitions?.code).filter(Boolean) : [];
    }
  });
}
