import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { pathToFileURL } from 'node:url';
import { loadRuntimeConfig } from './src/config/env.js';
import { createRequireSupabaseUser } from './src/auth/requireSupabaseUser.js';
import { createSupabaseClients } from './src/db/supabaseClients.js';
import { createImportRepository } from './src/modules/imports/importRepository.js';
import { createImportRouter } from './src/modules/imports/importRouter.js';
import { createCustomerMasterRepository } from './src/modules/customer-master/customerMasterRepository.js';
import { createCustomerMasterRouter } from './src/modules/customer-master/customerMasterRouter.js';
import { createProductResolutionRepository } from './src/modules/products/productResolutionRepository.js';
import { createProductRouter } from './src/modules/products/productRouter.js';
import { createCurrentStockRepository } from './src/modules/current-stock/currentStockRepository.js';
import { createCurrentStockRouter } from './src/modules/current-stock/currentStockRouter.js';
import { createSelloutRouter } from './src/modules/sellout/selloutRouter.js';
import { createSelloutRepository } from './src/modules/sellout/selloutRepository.js';
import { createInstrumentRouter } from './src/modules/instruments/instrumentRouter.js';
import { createInstrumentRepository } from './src/modules/instruments/instrumentRepository.js';
import { createFknsRouter } from './src/modules/fkns/fknsRouter.js';
import { createInvoiceRouter } from './src/modules/invoice/invoiceRouter.js';
import { createPaymentRouter } from './src/modules/payment/paymentRouter.js';
import { createStockRouter } from './src/modules/stock/stockRouter.js';
import { createDispatchRouter } from './src/modules/dispatch/dispatchRouter.js';
import { createInvoiceControlRouter } from './src/modules/invoice-control/invoiceControlRouter.js';
import { createLedgerRouter } from './src/modules/ledger/ledgerRouter.js';
import { createReportsRouter } from './src/modules/reports/reportsRouter.js';
import { createEngineRouter } from './src/modules/engine/engineRouter.js';
import { createForecastRouter } from './src/modules/forecast/forecastRouter.js';
import { createMigrationRouter } from './src/modules/migration/migrationRouter.js';
import { createCutoverRouter } from './src/modules/engine/cutoverRouter.js';
import { createOpsDocStagingRouter } from './src/modules/imports/opsDocStagingRouter.js';
import { createStlMatchRouter } from './src/modules/engine/stlMatchRouter.js';
import { createSelloutHistoricalRouter } from './src/modules/sellout/selloutHistoricalRouter.js';
import { createCommercialStockRouter } from './src/modules/stock/commercialStockRouter.js';
import { createSalesOrderRouter } from './src/modules/dispatch/salesOrderRouter.js';
import { createTodayDispatchRouter } from './src/modules/dispatch/todayDispatchRouter.js';
import { createOfficialTakeoverRouter } from './src/modules/payment/officialTakeoverRouter.js';
import { createPromissoryNoteRouter } from './src/modules/instruments/promissoryNoteRouter.js';
import { createReturnServiceRouter } from './src/modules/ledger/returnServiceRouter.js';
import { createDeliveredInvoiceRouter } from './src/modules/ledger/deliveredInvoiceRouter.js';
import { createOverrideRouter } from './src/modules/ledger/overrideRouter.js';
import { createFinancialRouter } from './src/modules/financial/financialRouter.js';
import { createAiRouter } from './src/modules/ai/aiRouter.js';
import { createUploadSyncRouter } from './src/modules/upload-sync/uploadSyncRouter.js';
dotenv.config();

export function createApp({ config, supabaseClients, customerMasterV2Enabled = process.env.CUSTOMER_MASTER_V2_ENABLED === 'true', productCatalogV2Enabled = process.env.PRODUCT_CATALOG_V2_ENABLED === 'true', currentStockV2Enabled = process.env.CURRENT_STOCK_V2_ENABLED === 'true', selloutEventsV2Enabled = process.env.SELLOUT_EVENTS_V2_ENABLED === 'true' } = {}) {
const runtimeConfig = config ?? loadRuntimeConfig(process.env);
const clients = supabaseClients ?? createSupabaseClients(runtimeConfig);
const app = express();
const APP_SECRET = runtimeConfig.appSecret;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// 1. IP-based Rate Limiter (Max 15 requests per minute)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { error: 'Çok fazla istek gönderildi. Lütfen 1 dakika bekleyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// Package 01 routes are deliberately before the legacy x-app-secret middleware.
// Package 02 remains server-side and default-off until an explicit cutover package.
app.use('/api/v2', createCustomerMasterRouter({
  requireSupabaseUser: createRequireSupabaseUser(clients.authClient),
  enabled: customerMasterV2Enabled === true,
  createRepositoryForAccessToken(accessToken) {
    return createCustomerMasterRepository({
      userClient: clients.createUserClient(accessToken),
      serviceClient: clients.serviceClient,
    });
  },
}));

// Package 03 is parallel and fail-closed until the Package 15 UI cutover.
app.use('/api/v2', createProductRouter({
  requireSupabaseUser: createRequireSupabaseUser(clients.authClient),
  enabled: productCatalogV2Enabled === true,
  createRepositoryForAccessToken(accessToken) {
    return createProductResolutionRepository({
      userClient: clients.createUserClient(accessToken),
      serviceClient: clients.serviceClient,
    });
  },
}));

// Package 03A remains independently feature-flagged and bearer authenticated.
  app.use('/api/v2', createCurrentStockRouter({
  requireSupabaseUser: createRequireSupabaseUser(clients.authClient),
  enabled: currentStockV2Enabled === true,
  createRepositoryForAccessToken(accessToken) {
    return createCurrentStockRepository({
      userClient: clients.createUserClient(accessToken),
      serviceClient: clients.serviceClient,
    });
  },
  }));
app.use('/api/v2', createSelloutRouter({
  requireSupabaseUser: createRequireSupabaseUser(clients.authClient),
  enabled: selloutEventsV2Enabled === true,
  createRepositoryForAccessToken(accessToken) {
    return createSelloutRepository({
      userClient: clients.createUserClient(accessToken),
      serviceClient: clients.serviceClient,
    });
  },
}));

app.use('/api/v2', createImportRouter({
  requireSupabaseUser: createRequireSupabaseUser(clients.authClient),
  createRepositoryForAccessToken(accessToken) {
    return createImportRepository({
      userClient: clients.createUserClient(accessToken),
      serviceClient: clients.serviceClient,
      signedUrlTtlSeconds: runtimeConfig.importSignedUrlTtlSeconds,
    });
  },
}));

app.use('/api/v2/instruments', createInstrumentRouter({
  requireSupabaseUser: createRequireSupabaseUser(clients.authClient),
  enabled: true,
  createRepositoryForAccessToken(accessToken) {
    return createInstrumentRepository({
      userClient: clients.createUserClient(accessToken),
      serviceClient: clients.serviceClient,
    });
  },
}));

// Yorumlar kaldırılarak ilgili router'lar sisteme dahil edilmiştir
app.use('/api/v2/fkns', createFknsRouter({
  // metricEngineService: metricEngineService // Bağımlılıklar burada verilebilir
}));
app.use('/api/v2/invoice', createInvoiceRouter({
  requireSupabaseUser: createRequireSupabaseUser(clients.authClient),
}));
app.use('/api/v2/payment', createPaymentRouter({
  requireSupabaseUser: createRequireSupabaseUser(clients.authClient),
}));
app.use('/api/v2/stock', createStockRouter({
  requireSupabaseUser: createRequireSupabaseUser(clients.authClient),
  createRepositoryForAccessToken(accessToken) {
    // Requires importing createCommercialStockRepository
    // But handled inside stockRouter or dynamically
    return accessToken ? {} : null; 
  }
}));
app.use('/api/v2', createDispatchRouter({
  requireSupabaseUser: createRequireSupabaseUser(clients.authClient),
  createRepositoryForAccessToken(accessToken) {
    return accessToken ? {} : null; 
  }
}));
app.use('/api/v2', createInvoiceControlRouter({
  requireSupabaseUser: createRequireSupabaseUser(clients.authClient),
  createRepositoryForAccessToken(accessToken) {
    return accessToken ? {} : null; 
  }
}));

app.use('/api/v2/ledger', createLedgerRouter({
  requireSupabaseUser: createRequireSupabaseUser(clients.authClient),
}));
app.use('/api/v2/reports', createReportsRouter());
app.use('/api/v2/engine', createEngineRouter());
app.use('/api/v2/forecast', createForecastRouter());
app.use('/api/v2/migration', createMigrationRouter());
app.use('/api/v2/cutover', createCutoverRouter({ clients }));
app.use('/api/v2/imports/ops-doc', createOpsDocStagingRouter({ clients }));
app.use('/api/v2/engine/stl-match', createStlMatchRouter({ clients }));
app.use('/api/v2/sellout/historical', createSelloutHistoricalRouter({ clients }));
app.use('/api/v2/stock/commercial', createCommercialStockRouter({ clients }));
app.use('/api/v2/dispatch/sales-orders', createSalesOrderRouter({ clients }));
app.use('/api/v2/dispatch/today', createTodayDispatchRouter({ clients }));
app.use('/api/v2/payment/official-takeover', createOfficialTakeoverRouter({ clients }));
app.use('/api/v2/instruments/promissory-note', createPromissoryNoteRouter({ clients }));
app.use('/api/v2/ledger/return-service-credit', createReturnServiceRouter({ clients }));
app.use('/api/v2/ledger/delivered-invoice', createDeliveredInvoiceRouter({ clients }));
app.use('/api/v2/ledger/override', createOverrideRouter({ clients }));
app.use('/api/v2/financial', createFinancialRouter({ clients }));
app.use('/api/v2/upload-sync', createUploadSyncRouter({
  requireSupabaseUser: createRequireSupabaseUser(clients.authClient),
  createRepositoryForAccessToken: (token) => clients.createUserClient(token),
}));

// Friendly root endpoint for browser inspection
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    service: 'AKGÜN Panel Backend API',
    message: 'Backend API aktif olarak çalışıyor. Kullanıcı arayüzüne erişmek için lütfen http://localhost:5173 adresini açınız.',
    endpoints: {
      chat: 'POST /api/ai/chat'
    }
  });
});

// Health check endpoint (bypasses auth header requirement)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// 2. Soft Auth Middleware (Check x-app-secret header)
app.use('/api/', (req, res, next) => {
  if (req.path === '/health') return next();
  const clientSecret = req.headers['x-app-secret'];
  if (clientSecret !== APP_SECRET) {
    return res.status(401).json({ error: 'Yetkisiz Erişim (Geçersiz App Secret)' });
  }
  next();
});

app.use('/api/ai', createAiRouter());

return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION:', error);
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
  });

  const runtimeConfig = loadRuntimeConfig(process.env);
  const app = createApp({ config: runtimeConfig, supabaseClients: createSupabaseClients(runtimeConfig) });
  app.listen(runtimeConfig.port, () => {
    console.log(`AKGÜN Panel Backend Sunucusu ${runtimeConfig.port} portunda çalışıyor.`);
  });
}
