import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const APP_SECRET = process.env.APP_SECRET || 'akgun_secret_key_2026';

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
  const activeKeysCount = getApiKeys().length;
  res.json({
    status: 'OK',
    uptimeSeconds: Math.floor(process.uptime()),
    activeKeysCount,
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

// API Key Rotation & Lock State
function getApiKeys() {
  const keysStr = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  return keysStr.split(',').map(k => k.trim()).filter(Boolean);
}

const rateLimitedKeysMap = {};
const rateLimitedModelsMap = {};
const invalidModelsSet = new Set();
let keyRotationIndex = 0;

function getActiveApiKey() {
  const keys = getApiKeys();
  if (keys.length === 0) return null;
  const now = Date.now();

  for (let i = 0; i < keys.length; i++) {
    const candidateIndex = (keyRotationIndex + i) % keys.length;
    const candidateKey = keys[candidateIndex];

    if (!rateLimitedKeysMap[candidateKey] || rateLimitedKeysMap[candidateKey] < now) {
      keyRotationIndex = (candidateIndex + 1) % keys.length;
      return candidateKey;
    }
  }

  // All locked, pick the one expiring earliest
  let minExpireKey = keys[0];
  let minExpireTime = rateLimitedKeysMap[minExpireKey] || Infinity;
  for (const k of keys) {
    if ((rateLimitedKeysMap[k] || 0) < minExpireTime) {
      minExpireTime = rateLimitedKeysMap[k] || 0;
      minExpireKey = k;
    }
  }
  return minExpireKey;
}

const MAX_MODELS_PER_REQUEST = 3;

function getCandidateModelsForQuery(hasAttachments = false) {
  const now = Date.now();
  const baseModels = [
    'gemini-2.5-pro',
    'gemini-pro-latest',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-2.0-flash'
  ];

  const availableModels = baseModels.filter(m => 
    !invalidModelsSet.has(m) && (!rateLimitedModelsMap[m] || rateLimitedModelsMap[m] < now)
  );

  const finalList = availableModels.length > 0 ? availableModels : baseModels.filter(m => !invalidModelsSet.has(m));
  return finalList.slice(0, MAX_MODELS_PER_REQUEST);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Format history for Gemini API
function formatHistoryForGemini(history = []) {
  const recentHistory = history.slice(-10);
  return recentHistory
    .filter(msg => msg.role === 'user' || msg.role === 'model')
    .map(msg => {
      let rawText = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      const parts = [{ text: rawText }];
      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          if (att.base64 && att.mimeType && (att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf')) {
            parts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: att.base64
              }
            });
          } else if (att.textContent) {
            parts[0].text += `\n\n--- YÜKLENEN DOSYA METNİ/ÖZETİ (${att.fileName}) ---\n${att.textContent}`;
          }
        }
      }
      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts
      };
    });
}

// 3. AI Chat Endpoint (Server-Sent Events + Stateless Tool Call Handshake)
app.post('/api/ai/chat', async (req, res) => {
  const { userMessage, conversationHistory = [], attachments = [], declarations = [] } = req.body;

  const candidateModels = getCandidateModelsForQuery(attachments && attachments.length > 0);
  let lastErr = null;
  let attemptIndex = 0;

  for (const modelName of candidateModels) {
    const apiKey = getActiveApiKey();
    if (!apiKey) break;

    if (attemptIndex > 0) {
      await sleep(800 * attemptIndex);
    }
    attemptIndex++;

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const toolsList = declarations && declarations.length > 0 ? [{ functionDeclarations: declarations }] : undefined;

      const model = genAI.getGenerativeModel({
        model: modelName,
        tools: toolsList
      });

      const formattedHistory = formatHistoryForGemini(conversationHistory);
      const chat = model.startChat({
        history: formattedHistory
      });

      let userParts = [{ text: userMessage || 'Ekteki veriyi analiz et.' }];
      if (attachments && attachments.length > 0) {
        for (const att of attachments) {
          if (att.base64 && att.mimeType && (att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf')) {
            userParts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: att.base64
              }
            });
          } else if (att.textContent) {
            userParts[0].text += `\n\n--- YÜKLENEN DOSYA METNİ/ÖZETİ (${att.fileName}) ---\n${att.textContent}`;
          }
        }
      }

      const streamResult = await chat.sendMessageStream(userParts);

      // Setup SSE Headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let hasToolCall = false;
      let toolCallData = null;

      for await (const chunk of streamResult.stream) {
        const fCalls = chunk.functionCalls();
        if (fCalls && fCalls.length > 0) {
          hasToolCall = true;
          toolCallData = fCalls;
          break; // Stop stream immediately for stateless tool execution!
        }

        let txt = '';
        try {
          txt = chunk.text();
        } catch (e) {}

        if (txt) {
          res.write(`data: ${JSON.stringify({ type: 'text', text: txt })}\n\n`);
        }
      }

      if (hasToolCall && toolCallData) {
        // Stateless tool call payload back to client
        res.write(`data: ${JSON.stringify({ type: 'tool_call', functionCalls: toolCallData })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      return res.end();

    } catch (err) {
      lastErr = err;
      const isRateLimit = err.status === 429 || String(err).includes('429') || String(err).includes('RESOURCE_EXHAUSTED') || String(err).includes('quota');
      const isNotFound = err.status === 404 || String(err).includes('404') || String(err).includes('not found');

      if (isNotFound) {
        invalidModelsSet.add(modelName);
      } else if (isRateLimit) {
        rateLimitedModelsMap[modelName] = Date.now() + 15000;
        if (apiKey) rateLimitedKeysMap[apiKey] = Date.now() + 15000;
      }
    }
  }

  // If all failed, return error JSON
  return res.status(500).json({
    error: lastErr?.message || 'Tüm Gemini modelleri yanıt vermede başarısız oldu.',
    type: 'error'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 AKGÜN Panel Backend Sunucusu ${PORT} portunda çalışıyor.`);
});
