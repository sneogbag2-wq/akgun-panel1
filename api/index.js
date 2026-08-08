// Vercel Serverless Function entry point.
// Wraps the existing Express app (backend/server.js) so it runs on Vercel
// instead of requiring a separately-hosted Node server on localhost:3001.
import { createApp } from '../backend/server.js';
import { loadRuntimeConfig } from '../backend/src/config/env.js';
import { createSupabaseClients } from '../backend/src/db/supabaseClients.js';

let cachedApp;

function getApp() {
  if (!cachedApp) {
    const runtimeConfig = loadRuntimeConfig(process.env);
    const supabaseClients = createSupabaseClients(runtimeConfig);
    cachedApp = createApp({ config: runtimeConfig, supabaseClients });
  }
  return cachedApp;
}

export default function handler(req, res) {
  return getApp()(req, res);
}
