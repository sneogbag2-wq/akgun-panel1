import express from 'express';
import { createImportService } from './importService.js';
import { toErrorEnvelope } from './importContracts.js';

function safeBatchView(batch) {
  const { storage_object_path: _storageObjectPath, storageObjectPath: _storageObjectPathCamel, ...safe } = batch;
  return safe;
}

export function createImportRouter({ requireSupabaseUser, createRepositoryForAccessToken }) {
  if (typeof requireSupabaseUser !== 'function' || typeof createRepositoryForAccessToken !== 'function') {
    throw new TypeError('Import router requires bearer auth and repository factory');
  }

  const router = express.Router();
  router.use(requireSupabaseUser);
  router.use((req, _res, next) => {
    try {
      req.importService = createImportService(createRepositoryForAccessToken(req.authUser.accessToken));
      next();
    } catch (error) {
      next(error);
    }
  });

  const route = (handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      const envelope = toErrorEnvelope(error, req.correlationId);
      res.status(envelope.status).json(envelope.body);
    }
  };

  router.post('/imports/initiate', route(async (req, res) => {
    res.status(201).json(await req.importService.initiate(req.body));
  }));

  router.post('/imports/:batchId/complete-upload', route(async (req, res) => {
    res.json(await req.importService.completeUpload(req.params.batchId, req.correlationId));
  }));

  router.post('/imports/:batchId/validate', route(async (req, res) => {
    res.json(await req.importService.validate(req.params.batchId, req.correlationId));
  }));

  router.get('/imports/:batchId', route(async (req, res) => {
    res.json(safeBatchView(await req.importService.getImport(req.params.batchId)));
  }));

  router.get('/imports/:batchId/issues', route(async (req, res) => {
    res.json(await req.importService.getIssues(req.params.batchId, req.query));
  }));

  router.post('/imports/:batchId/review', route(async (req, res) => {
    res.json(await req.importService.review(req.params.batchId, req.body, req.correlationId));
  }));

  router.post('/imports/:batchId/publish', route(async (req, res) => {
    res.json(await req.importService.publish(req.params.batchId, req.body, req.correlationId));
  }));

  router.get('/publications/current', route(async (req, res) => {
    res.json(await req.importService.getCurrentPublication(req.query));
  }));

  return router;
}
