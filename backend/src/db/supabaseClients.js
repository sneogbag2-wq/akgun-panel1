import { createClient } from '@supabase/supabase-js';

const NO_SESSION_AUTH = Object.freeze({
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
});

export function createSupabaseClients(config) {
  const common = {
    auth: NO_SESSION_AUTH,
    global: { headers: { 'x-application-name': 'akgun-imports-v2' } },
  };
  const authClient = createClient(config.supabaseUrl, config.supabaseAnonKey, common);
  const serviceClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, common);

  return Object.freeze({
    authClient,
    serviceClient,
    createUserClient(accessToken) {
      return createClient(config.supabaseUrl, config.supabaseAnonKey, {
        ...common,
        global: {
          ...common.global,
          headers: {
            ...common.global.headers,
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });
    },
  });
}
