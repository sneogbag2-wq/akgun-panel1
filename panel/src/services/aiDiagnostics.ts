/**
 * Geliştirme ortamındaki AI tanı kayıtları.
 * Bu modül kesinlikle kullanıcı sorusu, araç parametresi, müşteri/veri/belge
 * içeriği veya API anahtarı saklamaz.
 */

export type AiDiagnosticFallbackReason =
  | 'NO_API_KEY'
  | 'MODEL_FALLBACK_RESPONSE'
  | 'EMPTY_FINAL_RESPONSE'
  | 'ALL_MODELS_FAILED'
  | null;

export interface AiToolDiagnostic {
  toolName: string;
  durationMs: number;
  resultSizeBytes: number;
  status: 'SUCCESS' | 'ERROR' | 'PENDING_USER_CONFIRMATION';
}

export interface AiDiagnosticEntry {
  id: string;
  createdAt: string;
  intent: string;
  selectedTools: string[];
  executedTools: AiToolDiagnostic[];
  requestDurationMs: number;
  modelOutcome: 'TEXT' | 'EMPTY' | 'OFFLINE_FALLBACK' | 'MODEL_ERROR';
  modelFinishReason: string | null;
  followedByToolCall: boolean;
  fallbackReason: AiDiagnosticFallbackReason;
  responseLength: number;
  modelAttempts: number;
}

const STORAGE_KEY = 'akgun_ai_diagnostics_v1';
const CONSENT_KEY = 'akgun_ai_diagnostics_opt_in_v1';
const MAX_ENTRIES = 100;

function isDevelopmentEnvironment(): boolean {
  return Boolean(import.meta.env.DEV);
}

function isDiagnosticsEnabled(): boolean {
  if (isDevelopmentEnvironment()) return true;
  if (import.meta.env.VITE_AI_DIAGNOSTICS_ENABLED !== 'true' || typeof window === 'undefined') return false;
  return window.localStorage.getItem(CONSENT_KEY) === 'true';
}

/** Explicit, per-browser opt-in for anonymous production diagnostics. */
export function setAiDiagnosticsOptIn(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  if (enabled) window.localStorage.setItem(CONSENT_KEY, 'true');
  else window.localStorage.removeItem(CONSENT_KEY);
}

export function isAiDiagnosticsOptedIn(): boolean {
  return typeof window !== 'undefined' && window.localStorage.getItem(CONSENT_KEY) === 'true';
}

function readEntries(): AiDiagnosticEntry[] {
  if (!isDiagnosticsEnabled() || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as AiDiagnosticEntry[] : [];
  } catch {
    return [];
  }
}

/** Yalnızca şemada izinli, anonim alanları saklar. */
export function recordAiDiagnostic(entry: AiDiagnosticEntry): void {
  if (!isDiagnosticsEnabled() || typeof window === 'undefined') return;
  try {
    const existing = readEntries();
    const sanitized: AiDiagnosticEntry = {
      id: entry.id,
      createdAt: entry.createdAt,
      intent: entry.intent,
      selectedTools: entry.selectedTools,
      executedTools: entry.executedTools,
      requestDurationMs: entry.requestDurationMs,
      modelOutcome: entry.modelOutcome,
      modelFinishReason: entry.modelFinishReason,
      followedByToolCall: entry.followedByToolCall,
      fallbackReason: entry.fallbackReason,
      responseLength: entry.responseLength,
      modelAttempts: entry.modelAttempts
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, sanitized].slice(-MAX_ENTRIES)));

    // A configured endpoint receives only the same allow-listed anonymous schema.
    // Delivery is best-effort; diagnostics can never delay or fail an AI response.
    const endpoint = import.meta.env.VITE_AI_DIAGNOSTICS_ENDPOINT;
    if (!isDevelopmentEnvironment() && endpoint && navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([JSON.stringify(sanitized)], { type: 'application/json' }));
    }
  } catch {
    // Tanı kaydı hiçbir zaman kullanıcı yanıt akışını etkilemez.
  }
}

export function getAiDiagnostics(): AiDiagnosticEntry[] {
  return readEntries();
}

export function clearAiDiagnostics(): void {
  if (!isDiagnosticsEnabled() || typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Geliştirme ortamında anonim tanı günlüğünü JSON olarak indirir. */
export function downloadAiDiagnostics(): void {
  if (!isDiagnosticsEnabled() || typeof window === 'undefined') return;
  const blob = new Blob([JSON.stringify(getAiDiagnostics(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ai-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export interface AiDiagnosticsSummary {
  requestCount: number;
  averageRequestDurationMs: number;
  fallbackRate: number;
  toolUseRate: number;
  toolCounts: Record<string, number>;
}

export function getAiDiagnosticsSummary(): AiDiagnosticsSummary {
  const entries = getAiDiagnostics();
  const toolCounts: Record<string, number> = {};
  for (const entry of entries) {
    for (const tool of entry.executedTools) toolCounts[tool.toolName] = (toolCounts[tool.toolName] || 0) + 1;
  }
  const count = entries.length;
  return {
    requestCount: count,
    averageRequestDurationMs: count ? Math.round(entries.reduce((sum, entry) => sum + entry.requestDurationMs, 0) / count) : 0,
    fallbackRate: count ? entries.filter((entry) => entry.modelOutcome === 'OFFLINE_FALLBACK').length / count : 0,
    toolUseRate: count ? entries.filter((entry) => entry.executedTools.length > 0).length / count : 0,
    toolCounts
  };
}

declare global {
  interface Window {
    __aiDiagnostics?: {
      get: typeof getAiDiagnostics;
      clear: typeof clearAiDiagnostics;
      download: typeof downloadAiDiagnostics;
    };
  }
}

if (isDevelopmentEnvironment() && typeof window !== 'undefined') {
  window.__aiDiagnostics = {
    get: getAiDiagnostics,
    clear: clearAiDiagnostics,
    download: downloadAiDiagnostics
  };
}
