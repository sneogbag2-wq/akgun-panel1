// src/services/aiFallback/config.ts

export const config = {
  providers: {
    gemini: {
      keys: [], // VITE_GEMINI_API_KEY* has been retired; all models now route through the backend gateway.
      models: ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-2.0-flash'],
    }
  },
  retry: {
    maxRetriesPerKey: 1,
    baseDelayMs: 500
  },
  cache: {
    ttlSeconds: 600
  },
  circuitBreaker: {
    cooldownSeconds: 60
  }
};
