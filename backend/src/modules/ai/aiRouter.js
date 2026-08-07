import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

export function createAiRouter() {
  const router = Router();

  router.post('/chat', async (req, res) => {
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

        let parts;
        if (req.body.functionResponses && req.body.functionResponses.length > 0) {
          parts = req.body.functionResponses;
        } else {
          parts = [{ text: userMessage || 'Ekteki veriyi analiz et.' }];
          if (attachments && attachments.length > 0) {
            for (const att of attachments) {
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
        }

        const streamResult = await chat.sendMessageStream(parts);

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
            break;
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

    return res.status(500).json({
      error: lastErr?.message || 'Tüm Gemini modelleri yanıt vermede başarısız oldu.',
      type: 'error'
    });
  });

  return router;
}
