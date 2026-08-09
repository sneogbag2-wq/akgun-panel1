// panel/src/services/paymentImportService.ts
// Official Payment Import Pipeline Service (v2)

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
const baseUrl = rawBaseUrl.replace(/\/api\/v2\/?$/, '').replace(/\/$/, '');

function headers(token: string) {
  if (!token) throw new Error('Tahsilat yüklemesi için yetkili v2 oturumu gerekli.');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function call<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}/api/v2${path}`, {
    ...init,
    headers: { ...headers(token), ...(init?.headers || {}) }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.code || body.error || 'PAYMENT_REQUEST_FAILED');
  return body as T;
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const paymentImportService = Object.freeze({
  parse: (batchId: string, token: string, rows: any[] = []) => 
    call(`/imports/payments/${batchId}/parse`, token, { method: 'POST', body: JSON.stringify({ rows }) }),
  validate: (batchId: string, token: string) => call(`/imports/payments/${batchId}/validate`, token, { method: 'POST' }),
  publish: (batchId: string, token: string, input: { expectedValidationRunId: string; idempotencyKey: string }) => 
    call(`/imports/payments/${batchId}/publish`, token, { method: 'POST', body: JSON.stringify(input) }),

  async uploadAndPreview(file: File, token: string, parsedRows: any[] = [], sourceKind: 'NAKIT_TAHSILAT' | 'HAVALE_TAHSILAT' = 'NAKIT_TAHSILAT') {
    const declaredSha256 = await sha256(file);
    const idempotencyKey = `payment-init-${crypto.randomUUID()}`;

    const initiated = await call<{ batchId: string; upload: { signedUrl: string } }>('/imports/initiate', token, {
      method: 'POST',
      body: JSON.stringify({
        sourceKind,
        originalFileName: file.name,
        byteSize: file.size,
        mimeType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        declaredSha256,
        scope: {},
        idempotencyKey
      })
    });

    const upload = await fetch(initiated.upload.signedUrl, {
      method: 'PUT',
      headers: { 'x-upsert': 'false', 'content-type': file.type || 'application/octet-stream' },
      body: file
    });
    if (!upload.ok) throw new Error('PAYMENT_STORAGE_UPLOAD_FAILED');

    await call(`/imports/${initiated.batchId}/complete-upload`, token, { method: 'POST' });
    await this.parse(initiated.batchId, token, parsedRows);
    const validation = await this.validate(initiated.batchId, token) as any;
    await this.publish(initiated.batchId, token, {
      expectedValidationRunId: validation.validationRunId,
      idempotencyKey: `payment-pub-${crypto.randomUUID()}`
    });

    return { batchId: initiated.batchId, validationRunId: validation.validationRunId };
  }
});
