const fs = require('fs');
const path = require('path');
const https = require('https');

function getKeysFromEnv(filePath, envVar) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.startsWith(envVar + '=')) {
      const val = line.substring((envVar + '=').length).trim().replace(/^["']|["']$/g, '');
      return val.split(',').map(k => k.trim()).filter(Boolean);
    }
  }
  return [];
}

const rootDir = process.cwd();
const backendKeys = getKeysFromEnv(path.join(rootDir, 'backend', '.env'), 'GEMINI_API_KEYS');
const panelKeys = getKeysFromEnv(path.join(rootDir, 'panel', '.env'), 'VITE_GEMINI_API_KEY');

const allUniqueKeys = Array.from(new Set([...backendKeys, ...panelKeys]));

console.log(`Toplam ${allUniqueKeys.length} adet benzersiz Gemini API anahtarı bulundu.\n`);

function callGeminiRest(key, model) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      contents: [{ parts: [{ text: "ping" }] }]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body });
      });
    });

    req.on('error', (e) => {
      resolve({ statusCode: 500, error: e.message });
    });

    req.write(data);
    req.end();
  });
}

async function testKey(key, index) {
  const models = ['gemini-2.0-flash', 'gemini-flash-latest'];
  let finalStatus = 'UNTESTED';
  let detailInfo = '';

  for (const m of models) {
    const res = await callGeminiRest(key, m);
    if (res.statusCode === 200) {
      let txt = '';
      try {
        const json = JSON.parse(res.body);
        txt = json.candidates?.[0]?.content?.parts?.[0]?.text || 'OK';
      } catch (e) { txt = 'OK'; }
      finalStatus = 'ACTIVE (AKTİF)';
      detailInfo = `Model: ${m} | Yanıt: "${txt.trim().replace(/\n/g, ' ').substring(0, 30)}"`;
      break;
    } else if (res.statusCode === 429) {
      finalStatus = 'RATE_LIMITED (KOTA DOLU / 429)';
      detailInfo = `Anlık limit aşımı (${m})`;
    } else if (res.statusCode === 403) {
      finalStatus = 'INVALID_403 (PASİF / 403 FORBIDDEN)';
      detailInfo = `Erişim Engellendi / Proje Yetkisiz (${m})`;
    } else if (res.statusCode === 400) {
      let errMsg = '';
      try { errMsg = JSON.parse(res.body).error?.message || ''; } catch (e) {}
      finalStatus = 'INVALID_400 (GEÇERSİZ ANAHTAR)';
      detailInfo = `Bad Request / Anahtar Hatalı (${m}): ${errMsg.substring(0, 40)}`;
    } else {
      detailInfo = `HTTP ${res.statusCode} (${m})`;
    }
  }

  const masked = key.length > 20 ? `${key.substring(0, 14)}...${key.substring(key.length - 6)}` : key;
  console.log(`[KEY ${index + 1}] ${masked} -> ${finalStatus}`);
  console.log(`        Detay: ${detailInfo}\n`);
}

async function main() {
  for (let i = 0; i < allUniqueKeys.length; i++) {
    await testKey(allUniqueKeys[i], i);
  }
}

main();
