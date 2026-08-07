import { Router } from 'express';
import { createFinancialReconciliationService } from '../financial/financialReconciliationService.js';
import { createFinancialHealthLimitService } from '../financial/financialHealthLimitService.js';
import { createFinancialCoreAnalyticsService } from '../financial/financialCoreAnalyticsService.js';
import { createReportExportService } from './reportExportService.js';

export function createReportsRouter(dependencies = {}) {
  const router = Router();
  const { requireSupabaseUser, createRepositoryForAccessToken, enabled = true } = dependencies;

  if (requireSupabaseUser) {
    router.use('/', requireSupabaseUser);
  }

  router.use('/', (req, res, next) => {
    if (!enabled) {
      return res.status(404).json({ code: 'FEATURE_DISABLED', message: 'Reports module is disabled' });
    }
    // Initialize repository
    if (createRepositoryForAccessToken && req.headers && req.headers.authorization) {
      const token = req.headers.authorization.split(' ')[1];
      req.repository = createRepositoryForAccessToken(token);
    }
    next();
  });

  router.get('/status', (req, res) => {
    res.json({ module: 'reports', status: 'active' });
  });

  // FAN-020: Financial Reconciliation Status
  router.get('/advanced/reconciliation', async (req, res) => {
    try {
      const recService = createFinancialReconciliationService({ repository: req.repository });
      const calculationRunId = req.query.runId;
      const reconciliation = await recService.checkFinancialReconciliation(calculationRunId, {
        ledgerBalance: req.query.ledgerBalance ? Number(req.query.ledgerBalance) : undefined,
        openLotsTotal: req.query.openLotsTotal ? Number(req.query.openLotsTotal) : undefined,
        unallocatedCredit: req.query.unallocatedCredit ? Number(req.query.unallocatedCredit) : undefined
      });
      res.json({ data: reconciliation });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // FAN-021: Data Coverage & Confidence Summary
  router.get('/advanced/coverage', async (req, res) => {
    try {
      const recService = createFinancialReconciliationService({ repository: req.repository });
      const metricCode = req.query.metricCode || 'GLOBAL';
      const coverage = await recService.calculateDataCoverage(metricCode, {
        expectedRows: req.query.expectedRows ? Number(req.query.expectedRows) : 100,
        processedRows: req.query.processedRows ? Number(req.query.processedRows) : 100,
        expectedAmount: req.query.expectedAmount ? Number(req.query.expectedAmount) : 1000,
        processedAmount: req.query.processedAmount ? Number(req.query.processedAmount) : 1000
      });
      res.json({ data: coverage });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // FAN-004: Payment Survival Curve
  router.get('/advanced/survival', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_payment_survival_curve')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // FAN-005: Aged Burden Bridge
  router.get('/advanced/aged-burden', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_aged_burden_bridge')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // FAN-006: Total Exposure Bridge
  router.get('/advanced/exposure-bridge', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_total_exposure_bridge')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // FAN-007: Economic Collection Bridge
  router.get('/advanced/collection-bridge', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_economic_collection_bridge')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // FAN-008: Instrument Maturity Ladder
  router.get('/advanced/maturity-ladder', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_instrument_maturity_ladder')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // FAN-009: Instrument Realization
  router.get('/advanced/instrument-realization', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_instrument_expected_realization')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // FAN-010: 13-Week Cash Forecast
  router.get('/advanced/cash-forecast-13w', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_cash_forecast_13w')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // FAN-011: Forecast Backtest
  router.get('/advanced/forecast-backtest', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_forecast_backtest')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // FAN-012: Deterioration Signals
  router.get('/advanced/deterioration-signals', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_early_deterioration_signal')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // FAN-013: Robust Anomalies
  router.get('/advanced/robust-anomalies', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_robust_anomaly')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // FAN-014: Behavior Segment
  router.get('/advanced/behavior-segment', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_behavior_segment')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // FAN-015: Collection Priority
  router.get('/advanced/collection-priority', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_collection_priority_score')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // FAN-016: Stress Scenario
  router.get('/advanced/stress-scenario', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_stress_scenario_result')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // FAN-017: Counterparty Loss
  router.get('/advanced/counterparty-loss', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_counterparty_loss_test')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // FAN-018: Expected Loss
  router.get('/advanced/expected-loss', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_expected_loss_scenario')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // FAN-019: Restatement Impact
  router.get('/advanced/restatement-impact', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_restatement_impact')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // AI-17: HLT-001 — Müşteri Finansal Sağlık Skoru
  router.get('/advanced/health', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_financial_health_score')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // AI-17: HLT-002 — Sağlık Skoru Bileşenleri
  router.get('/advanced/health/components', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_financial_health_component')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // AI-17: LIM-001 — İç Limit Önerisi
  router.get('/advanced/limit', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_internal_limit')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // AI-17: LIM-002 — Limit Değişim Geçmişi
  router.get('/advanced/limit/history', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_internal_limit_history')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // AI-17: PRF-001 — Temsilci Performans Karnesi
  router.get('/advanced/performance/rep', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_rep_financial_performance')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // AI-17: PRF-002 — SSM (Bölge) Performans Karnesi
  router.get('/advanced/performance/ssm', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_ssm_financial_performance')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // FAN-022: Eş Grup ve Dönem Kıyasları
  router.get('/advanced/peer-comparison', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_peer_group_comparison')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // FAN-023: Müşteri 360 Finansal Özet
  router.get('/advanced/customer-360', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_customer_360_summary')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // FAN-024: Takip Önerisi Sonuç Ölçümü
  router.get('/advanced/tracking-conversion', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_recommendation_conversion_tracking')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // FAN-001: concentration_pareto_hhi
  router.get('/advanced/pareto', async (req, res) => {
    try {
      const coreService = createFinancialCoreAnalyticsService({ repository: req.repository });
      const items = req.body?.items || req.query.items;
      if (Array.isArray(items)) {
        const paretoResult = await coreService.calculateConcentrationPareto({ items });
        return res.json({ data: paretoResult });
      }

      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_concentration_pareto_hhi')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // FAN-002: aging_transition_matrix
  router.get('/advanced/transition-matrix', async (req, res) => {
    try {
      const coreService = createFinancialCoreAnalyticsService({ repository: req.repository });
      const openingLots = req.body?.openingLots || [];
      const matrixResult = await coreService.calculateAgingTransitionMatrix({ openingLots });
      res.json({ data: matrixResult });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // FIN-015: financial_health_score & FIN-014: cei
  router.get('/financial-health', async (req, res) => {
    try {
      const healthService = createFinancialHealthLimitService({ repository: req.repository });
      const collectionRate = req.query.collectionRate !== undefined ? Number(req.query.collectionRate) : undefined;
      const agingDropRatio = req.query.agingDropRatio !== undefined ? Number(req.query.agingDropRatio) : undefined;
      const instrumentRiskRatio = req.query.instrumentRiskRatio !== undefined ? Number(req.query.instrumentRiskRatio) : undefined;
      const paymentSpeedDays = req.query.paymentSpeedDays !== undefined ? Number(req.query.paymentSpeedDays) : undefined;
      const customerId = req.query.customerId;
      const companyId = req.query.companyId;

      const healthResult = healthService.calculateHealthScore({
        collectionRate,
        agingDropRatio,
        instrumentRiskRatio,
        paymentSpeedDays,
        customerId,
        companyId
      });
      res.json({ data: healthResult });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // FAN-003: invoice_vintage_curve
  router.get('/advanced/vintage-curve', async (req, res) => {
    try {
      const coreService = createFinancialCoreAnalyticsService({ repository: req.repository });
      const cohortMonth = req.query.cohortMonth;
      const totalCohortPrincipal = req.query.totalCohortPrincipal ? Number(req.query.totalCohortPrincipal) : undefined;
      if (cohortMonth && totalCohortPrincipal !== undefined) {
        const vintageResult = await coreService.calculateInvoiceVintageCurve({ cohortMonth, totalCohortPrincipal });
        return res.json({ data: vintageResult });
      }

      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('fan_invoice_vintage_curve')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // RPT-002: report_result_manifest
  router.get('/manifests', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('rpt_report_manifest')
        .select('*, rpt_exported_artifact(*)')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // SORPT-001: monthly_sellout_series
  router.get('/sellout/monthly', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('sorpt_monthly_sellout')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(12);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // SORPT-006: channel_share_shift
  router.get('/sellout/channel-shift', async (req, res) => {
    try {
      if (!req.repository) return res.status(500).json({ error: 'Repository not initialized' });
      const { data, error } = await req.repository.supabase
        .from('sorpt_channel_share')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bölüm 7.2..7.8: Export endpoints (Snapshot, PDF 8 bölümlü, XLSX 5 sekmeli)
  router.post('/export/snapshot', async (req, res) => {
    try {
      const exportService = createReportExportService({ repository: req.repository });
      const snapshot = await exportService.generateReportSnapshot(req.body || {});
      res.json({ data: snapshot });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/export/pdf', async (req, res) => {
    try {
      const exportService = createReportExportService({ repository: req.repository });
      const snapshot = req.body.snapshot || await exportService.generateReportSnapshot(req.body || {});
      const pdfArtifact = await exportService.renderPdfReport(snapshot, req.body.options || {});
      res.json({ data: pdfArtifact });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/export/excel', async (req, res) => {
    try {
      const exportService = createReportExportService({ repository: req.repository });
      const snapshot = req.body.snapshot || await exportService.generateReportSnapshot(req.body || {});
      const excelArtifact = await exportService.renderExcelWorkbook(snapshot, req.body.options || {});
      res.json({ data: excelArtifact });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
