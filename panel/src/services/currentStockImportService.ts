import type { CurrentStockPreview, CurrentStockStatus } from '../types/currentStock';
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const baseUrl = rawBaseUrl.replace(/\/api\/v2\/?$/, '').replace(/\/$/, '');
function headers(token: string) { if (!token) throw new Error('Anlık stok için yetkili v2 oturumu gerekli.'); return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }; }
async function call<T>(path: string, token: string, init?: RequestInit): Promise<T> { const response = await fetch(`${baseUrl}/api/v2${path}`, { ...init, headers: { ...headers(token), ...(init?.headers || {}) } }); const body = await response.json(); if (!response.ok) throw new Error(body.code || 'CURRENT_STOCK_REQUEST_FAILED'); return body as T; }
async function sha256(file: File): Promise<string> { const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer()); return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join(''); }
export const currentStockImportService = Object.freeze({
  parse: (batchId: string, token: string) => call<CurrentStockPreview>(`/imports/current-stock/${batchId}/parse`, token, { method: 'POST' }),
  validate: (batchId: string, token: string) => call<CurrentStockPreview>(`/imports/current-stock/${batchId}/validate`, token, { method: 'POST' }),
  preview: (batchId: string, token: string) => call<CurrentStockPreview>(`/imports/current-stock/${batchId}/preview`, token),
  publish: (batchId: string, token: string, input: { expectedValidationRunId: string; expectedActiveImportId?: string | null; idempotencyKey: string }) => call(`/imports/current-stock/${batchId}/publish`, token, { method: 'POST', body: JSON.stringify(input) }),
  status: (token: string) => call<CurrentStockStatus>('/current-stock/status', token),
  async uploadAndPreview(file: File, token: string) {
    const declaredSha256 = await sha256(file);
    const idempotencyKey = `current-stock-init-${crypto.randomUUID()}`;
    const initiated = await call<{ batchId: string; upload: { signedUrl: string } }>('/imports/initiate', token, { method: 'POST', body: JSON.stringify({ sourceKind: 'CURRENT_STOCK_AVAILABLE', originalFileName: file.name, byteSize: file.size, mimeType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', declaredSha256, scope: { warehouseCode: 'DEFAULT_WAREHOUSE' }, idempotencyKey }) });
    const upload = await fetch(initiated.upload.signedUrl, { method: 'PUT', headers: { 'x-upsert': 'false', 'content-type': file.type || 'application/octet-stream' }, body: file });
    if (!upload.ok) throw new Error('CURRENT_STOCK_STORAGE_UPLOAD_FAILED');
    await call(`/imports/${initiated.batchId}/complete-upload`, token, { method: 'POST' });
    await this.parse(initiated.batchId, token);
    const validation = await this.validate(initiated.batchId, token);
    const preview = await this.preview(initiated.batchId, token);
    const status = await this.status(token);
    return { batchId: initiated.batchId, validationRunId: validation.validationRunId, preview, activeImportId: status.currentStockImportId ?? null };
  },
});
