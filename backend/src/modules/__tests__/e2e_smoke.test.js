import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { createApp } from '../../../server.js';

test('E2E Smoke Test - Panel to Backend Routers', async (t) => {
  // Use a mocked config to avoid needing real environment variables for the smoke test
  const mockConfig = {
    appSecret: 'test-secret',
    supabaseUrl: 'https://test.supabase.co',
    supabaseServiceRoleKey: 'test-key',
    port: 3000
  };
  const mockSupabaseClients = {
    serviceClient: {},
    authClient: {
      auth: {
        getUser: async () => ({ data: { user: null }, error: new Error('mock') })
      }
    }
  };
  const app = createApp({ config: mockConfig, supabaseClients: mockSupabaseClients });

  await t.test('GET / (Root endpoint)', async () => {
    const response = await request(app).get('/');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.status, 'OK');
  });

  await t.test('GET /api/health (Health check)', async () => {
    const response = await request(app).get('/api/health');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.status, 'OK');
  });

  await t.test('GET /api/v2/reports/financial-health (Router connection)', async () => {
    const response = await request(app)
      .get('/api/v2/reports/financial-health')
      .set('x-app-secret', 'test-secret');
    
    // We expect either 200 (if it returns mock data) or 500 (if it fails connecting to real DB),
    // or 401/403. But NOT 404, which would mean the router is not connected.
    assert.notStrictEqual(response.status, 404, 'Router should be connected and not return 404');
  });
});
