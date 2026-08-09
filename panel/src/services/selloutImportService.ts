// panel/src/services/selloutImportService.ts
// Official Sellout Traditional Import Pipeline Service (v2)

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
const baseUrl = rawBaseUrl.replace(/\/api\/v2\/?$/, '').replace(/\/$/, '');

function headers(token: string) {
  if (!token) throw new Error('Sellout yüklemesi için yetkili v2 oturumu gerekli.');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function call<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}/api/v2${path}`, {
    ...init,
    headers: { ...headers(token), ...(init?.headers || {}) }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.code || body.error || 'SELLOUT_REQUEST_FAILED');
  return body as T;
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const selloutImportService = Object.freeze({
  parse: (batchId: string, token: string) => call(`/imports/sellout/${batchId}/parse`, token, { method: 'POST' }),
  validate: (batchId: string, token: string) => call(`/imports/sellout/${batchId}/validate`, token, { method: 'POST' }),
  publish: (batchId: string, token: string, input: { expectedValidationRunId: string; idempotencyKey: string }) => 
    call(`/imports/sellout/${batchId}/publish`, token, { method: 'POST', body: JSON.stringify(input) }),

  async uploadAndPreview(file: File, token: string) {
    const declaredSha256 = await sha256(file);
    const idempotencyKey = `sellout-init-${crypto.randomUUID()}`;

    // 1. Initiate Batch
    const initiated = await call<{ batchId: string; upload: { signedUrl: string } }>('/imports/initiate', token, {
      method: 'POST',
      body: JSON.stringify({
        sourceKind: 'SELLOUT_TRADITIONAL',
        originalFileName: file.name,
        byteSize: file.size,
        mimeType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        declaredSha256,
        scope: {},
        idempotencyKey
      })
    });

    // 2. Upload to Storage
    const upload = await fetch(initiated.upload.signedUrl, {
      method: 'PUT',
      headers: {
        'x-upsert': 'false',
        'content-type': file.type || 'application/octet-stream'
      },
      body: file
    });

    if (!upload.ok) throw new Error('SELLOUT_STORAGE_UPLOAD_FAILED');

    // 3. Complete Upload
    await call(`/imports/${initiated.batchId}/complete-upload`, token, { method: 'POST' });

    // 4. Parse & Validate
    await this.parse(initiated.batchId, token);
    const validation = await this.validate(initiated.batchId, token) as any;

    // 5. Publish
    await this.publish(initiated.batchId, token, {
      expectedValidationRunId: validation.validationRunId,
      idempotencyKey: `sellout-pub-${crypto.randomUUID()}`
    });

    return { batchId: initiated.batchId, validationRunId: validation.validationRunId };
  }
});
