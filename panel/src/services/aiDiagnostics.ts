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
const MAX_ENTRIES = 100;

function isDevelopmentEnvironment(): boolean {
  return Boolean(import.meta.env.DEV);
}

function readEntries(): AiDiagnosticEntry[] {
  if (!isDevelopmentEnvironment() || typeof window === 'undefined') return [];
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
  if (!isDevelopmentEnvironment() || typeof window === 'undefined') return;
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
  } catch {
    // Tanı kaydı hiçbir zaman kullanıcı yanıt akışını etkilemez.
  }
}

export function getAiDiagnostics(): AiDiagnosticEntry[] {
  return readEntries();
}

export function clearAiDiagnostics(): void {
  if (!isDevelopmentEnvironment() || typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Geliştirme ortamında anonim tanı günlüğünü JSON olarak indirir. */
export function downloadAiDiagnostics(): void {
  if (!isDevelopmentEnvironment() || typeof window === 'undefined') return;
  const blob = new Blob([JSON.stringify(getAiDiagnostics(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ai-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
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
