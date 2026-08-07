import express from 'express';
import { toErrorEnvelope } from '../imports/importContracts.js';
import { SelloutContractError } from './selloutContract.js';
import { createSelloutMetricService } from './selloutMetricService.js';
import { createSelloutTargetService } from './selloutTargetService.js';

const disabled = (res, id) => res.status(404).json({ code: 'FEATURE_DISABLED', messageKey: 'sellout.feature.disabled', correlationId: id, retryable: false });

export function createSelloutRouter({ requireSupabaseUser, createRepositoryForAccessToken, enabled = false }) {
  const router = express.Router(), paths = ['/imports/sellout', '/sellout'];
  router.use(paths, requireSupabaseUser);
  router.use(paths, (req, res, next) => {
    if (!enabled) return disabled(res, req.correlationId);
    const repo = createRepositoryForAccessToken(req.authUser.accessToken);
    req.selloutMetricService = createSelloutMetricService(repo);
    req.selloutTargetService = createSelloutTargetService(repo);
    return next();
  });

  const route = (handler) => async (req, res) => {
    try {
      res.json(await handler(req));
    } catch (error) {
      const result = error instanceof SelloutContractError
        ? { status: 422, body: { code: error.code, messageKey: error.messageKey, details: error.details, correlationId: req.correlationId, retryable: false } }
        : toErrorEnvelope(error, req.correlationId);
      res.status(result.status).json(result.body);
    }
  };

  // Import flow (Metrics Service handles it)
  router.post('/imports/sellout/:batchId/parse', route(req => req.selloutMetricService.parse(req.params.batchId, req.correlationId)));
  router.post('/imports/sellout/:batchId/validate', route(req => req.selloutMetricService.validate(req.params.batchId, req.correlationId)));
  router.get('/imports/sellout/:batchId/preview', route(req => req.selloutMetricService.preview(req.params.batchId)));
  router.post('/imports/sellout/:batchId/publish', route(req => req.selloutMetricService.publish(req.params.batchId, req.body, req.correlationId)));

  // Metrics, Periods, Events, Resolutions
  router.get('/sellout/periods', route(req => req.selloutMetricService.periods()));
  router.get('/sellout/events', route(req => req.selloutMetricService.events(req.query)));
  router.get('/sellout/monthly-performance', route(req => req.selloutMetricService.performance(req.query)));
  router.get('/sellout/reconciliation', route(req => req.selloutMetricService.reconciliation(req.query)));
  router.get('/sellout/exceptions', route(req => req.selloutMetricService.exceptions(req.query)));
  router.post('/sellout/resolutions/preview', route(req => req.selloutMetricService.resolutionPreview(req.body)));
  router.post('/sellout/resolutions/commit', route(req => req.selloutMetricService.resolutionCommit(req.body)));
  router.post('/sellout/resolutions/:resolutionId/reverse', route(req => req.selloutMetricService.resolutionReverse(req.params.resolutionId, req.body)));

  // Targets Flow
  router.get('/sellout/targets', route(req => req.selloutTargetService.targets(req.query)));
  router.post('/sellout/targets/preview', route(req => req.selloutTargetService.targetPreview(req.body)));
  router.post('/sellout/targets/commit', route(req => req.selloutTargetService.targetCommit(req.body)));
  router.post('/sellout/targets/:targetVersionId/reverse', route(req => req.selloutTargetService.targetReverse(req.params.targetVersionId, req.body)));

  // EVT-001..009: Canonical Events
  router.get('/sellout/advanced/events', async (req, res) => {
    try {
      const repo = createRepositoryForAccessToken(req.authUser.accessToken);
      const { data, error } = await repo.supabase
        .from('evt_sellout_event')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ACT-001..013: Actuals
  router.get('/sellout/advanced/actuals', async (req, res) => {
    try {
      const repo = createRepositoryForAccessToken(req.authUser.accessToken);
      const { data, error } = await repo.supabase
        .from('act_metric_actual')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // TGT-001..008: Attainment & Performance
  router.get('/sellout/advanced/attainment', async (req, res) => {
    try {
      const repo = createRepositoryForAccessToken(req.authUser.accessToken);
      const { data, error } = await repo.supabase
        .from('tgt_performance_attainment')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      res.json({ data: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
