import express from 'express';
import { toErrorEnvelope } from '../imports/importContracts.js';
import { CustomerMasterContractError } from './customerMasterContract.js';
import { createCustomerMasterService } from './customerMasterService.js';

function errorEnvelope(error, correlationId) {
  if (error instanceof CustomerMasterContractError) {
    return { status: 422, body: { code: error.code, messageKey: error.messageKey, correlationId, retryable: false, ...(Object.keys(error.details).length ? { details: error.details } : {}) } };
  }
  return toErrorEnvelope(error, correlationId);
}

function featureDisabled(res, correlationId) {
  return res.status(404).json({ code: 'FEATURE_DISABLED', messageKey: 'customerMaster.feature.disabled', correlationId, retryable: false });
}

export function createCustomerMasterRouter({ requireSupabaseUser, createRepositoryForAccessToken, enabled = false }) {
  if (typeof requireSupabaseUser !== 'function' || typeof createRepositoryForAccessToken !== 'function') {
    throw new TypeError('Customer master router requires bearer auth and repository factory');
  }
  const router = express.Router();
  const customerMasterPaths = [
    '/imports/customer-master', '/customers', '/organization', '/customer-master',
  ];
  router.use(customerMasterPaths, requireSupabaseUser);
  router.use(customerMasterPaths, (req, res, next) => {
    if (!enabled) return featureDisabled(res, req.correlationId);
    try {
      req.customerMasterService = createCustomerMasterService(createRepositoryForAccessToken(req.authUser.accessToken));
      return next();
    } catch (error) {
      return next(error);
    }
  });
  const route = (handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      const envelope = errorEnvelope(error, req.correlationId);
      res.status(envelope.status).json(envelope.body);
    }
  };
  router.post('/imports/customer-master/:batchId/parse', route(async (req, res) => {
    res.json(await req.customerMasterService.parse(req.params.batchId, req.correlationId));
  }));
  router.post('/imports/customer-master/:batchId/validate', route(async (req, res) => {
    res.json(await req.customerMasterService.validate(req.params.batchId, req.correlationId));
  }));
  router.post('/imports/customer-master/:batchId/publish', route(async (req, res) => {
    res.json(await req.customerMasterService.publish(req.params.batchId, req.body, req.correlationId));
  }));
  router.get('/customers', route(async (req, res) => {
    res.json(await req.customerMasterService.list(req.query));
  }));
  router.get('/customers/:customerCode/history', route(async (req, res) => {
    res.json(await req.customerMasterService.history(req.params.customerCode));
  }));
  router.get('/customers/:customerCode', route(async (req, res) => {
    res.json(await req.customerMasterService.customer(req.params.customerCode, req.query));
  }));
  router.get('/organization/reps', route(async (req, res) => {
    res.json(await req.customerMasterService.organization('REPS', req.query));
  }));
  router.get('/organization/ssms', route(async (req, res) => {
    res.json(await req.customerMasterService.organization('SSMS', req.query));
  }));
  router.get('/organization/hierarchy', route(async (req, res) => {
    res.json(await req.customerMasterService.organization('HIERARCHY', req.query));
  }));
  router.get('/organization/exceptions', route(async (req, res) => {
    res.json(await req.customerMasterService.organization('EXCEPTIONS', req.query));
  }));
  router.get('/customer-master/snapshots/:snapshotId/reconciliation', route(async (req, res) => {
    res.json(await req.customerMasterService.reconciliation(req.params.snapshotId));
  }));

  // CUS-001..008: Customer Resolution
  router.get('/customers/advanced/resolution', route(async (req, res) => {
    const repository = createRepositoryForAccessToken(req.authUser.accessToken);
    const { data, error } = await repository.supabase
      .from('cus_resolution')
      .select('*')
      .order('calculated_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ data: data || [] });
  }));

  // ORG-001..008: Organization Hierarchy Metrics
  router.get('/organization/advanced/hierarchy-metrics', route(async (req, res) => {
    const repository = createRepositoryForAccessToken(req.authUser.accessToken);
    const { data, error } = await repository.supabase
      .from('org_hierarchy')
      .select('*')
      .order('calculated_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ data: data || [] });
  }));

  // DQ-001: Data Quality Issues
  router.get('/customer-master/dq-issues', route(async (req, res) => {
    const repository = createRepositoryForAccessToken(req.authUser.accessToken);
    const { data, error } = await repository.supabase
      .from('dq_issue_log')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json({ data: data || [] });
  }));

  return router;
}
