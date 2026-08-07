export interface CurrentStockPreview { batchId: string; validationRunId?: string; rowCount?: number; uniqueCodes?: number; sourceQuantity?: string; warnings?: string[]; }
export interface CurrentStockStatus { currentStockImportId?: string; asOfAt?: string; ageHours?: string; freshness: 'NO_ACTIVE_STOCK' | 'FRESH' | 'WARNING' | 'STALE'; }
