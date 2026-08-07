const REQUIRED_NAMES = [
  'APP_SECRET',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

function requiredValue(env, name) {
  const value = env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`MISSING_REQUIRED_ENV:${name}`);
  }
  return value.trim();
}

function readPositiveInteger(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`INVALID_ENV:${name}`);
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed > 3600) {
    throw new Error(`INVALID_ENV:${name}`);
  }
  return parsed;
}

export function loadRuntimeConfig(env = process.env) {
  for (const name of REQUIRED_NAMES) requiredValue(env, name);

  const url = requiredValue(env, 'SUPABASE_URL');
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('INVALID_ENV:SUPABASE_URL');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('INVALID_ENV:SUPABASE_URL');
  }

  const port = env.PORT === undefined || env.PORT === '' ? 3001 : Number(env.PORT);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('INVALID_ENV:PORT');
  }

  return Object.freeze({
    port,
    appSecret: requiredValue(env, 'APP_SECRET'),
    supabaseUrl: url,
    supabaseAnonKey: requiredValue(env, 'SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: requiredValue(env, 'SUPABASE_SERVICE_ROLE_KEY'),
    importSignedUrlTtlSeconds: readPositiveInteger(env, 'IMPORT_SIGNED_URL_TTL_SECONDS', 300),
  });
}
