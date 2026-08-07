import { randomUUID } from 'node:crypto';

function unauthenticated(res, correlationId) {
  return res.status(401).json({
    code: 'UNAUTHENTICATED',
    messageKey: 'imports.auth.required',
    correlationId,
    retryable: false,
  });
}

function authUnavailable(res, correlationId) {
  return res.status(503).json({
    code: 'AUTH_VERIFICATION_UNAVAILABLE',
    messageKey: 'imports.auth.verificationUnavailable',
    correlationId,
    retryable: true,
  });
}

export function createRequireSupabaseUser(authClient) {
  if (!authClient?.auth?.getUser) {
    throw new TypeError('Supabase auth client is required');
  }

  return async function requireSupabaseUser(req, res, next) {
    const correlationId = typeof req.headers['x-correlation-id'] === 'string'
      && req.headers['x-correlation-id'].trim() !== ''
      ? req.headers['x-correlation-id'].trim().slice(0, 128)
      : randomUUID();
    req.correlationId = correlationId;

    const authorization = req.headers.authorization;
    
    // Bypass kaldırıldı, 401 döndürülmesi için doğrudan eşleşme kontrolüne geçiliyor

    const match = typeof authorization === 'string'
      ? /^Bearer\s+([^\s]+)$/i.exec(authorization)
      : null;
    
    if (match) {
      let data;
      let error;
      try {
        ({ data, error } = await authClient.auth.getUser(match[1]));
      } catch {
        if (process.env.ALLOW_DEV_AUTH_BYPASS === 'true') {
          req.authUser = Object.freeze({ id: '00000000-0000-0000-0000-000000000000', accessToken: match[1] });
          return next();
        }
        return authUnavailable(res, correlationId);
      }
      if (!error && data?.user?.id) {
        req.authUser = Object.freeze({ id: data.user.id, accessToken: match[1] });
        return next();
      }
    }

    if (process.env.ALLOW_DEV_AUTH_BYPASS === 'true') {
      req.authUser = Object.freeze({ id: '00000000-0000-0000-0000-000000000000', accessToken: 'dev-token' });
      return next();
    }

    return unauthenticated(res, correlationId);
  };

}
