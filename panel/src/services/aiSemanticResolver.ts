import { SemanticQueryPlan } from '../types/ai';

export interface SemanticResolutionResult {
  plan: SemanticQueryPlan | null;
  error?: string;
  isAmbiguous: boolean;
}

const METRIC_DICTIONARY: Record<string, string[]> = {
  'ACT-004': ['satış', 'satis', 'ciro', 'hacim', 'satislar'],
  'FIN-006': ['tahsilat', 'ödeme', 'odeme', 'tahsil', 'koleksiyon'],
  'FIN-015': ['risk', 'sağlık', 'saglik', 'risk skoru'],
  'STK-005': ['stok', 'envanter', 'depo', 'bulunurluk'],
  'FKNS-001': ['kapsam', 'penetrasyon', 'dagilim', 'yayginlik', 'bulunurluk', 'fkns']
};

const TURKISH_FOLD_MAP: Record<string, string> = {
  'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'İ': 'i',
  'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u'
};

function normalizeText(text: string): string {
  return String(text)
    .toLocaleLowerCase('tr-TR')
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (char) => TURKISH_FOLD_MAP[char] || char)
    .replace(/[^a-z0-9\s]+/g, ' ')
    .trim();
}

function resolveMetrics(normalizedQuery: string): string[] {
  const resolvedMetrics = new Set<string>();
  const words = normalizedQuery.split(/\s+/);
  
  for (const word of words) {
    for (const [metricId, keywords] of Object.entries(METRIC_DICTIONARY)) {
      if (keywords.some(kw => word.includes(kw) || kw.includes(word))) {
        resolvedMetrics.add(metricId);
      }
    }
  }
  return Array.from(resolvedMetrics);
}

function resolveEntities(normalizedQuery: string): string[] {
  const entities: string[] = [];
  // Basic mock heuristics for entities: 10 digit numbers for customers, 6 for products
  const words = normalizedQuery.split(/\s+/);
  for (const word of words) {
    if (/^\d{10}$/.test(word)) {
      entities.push(`CUST:${word}`);
    } else if (/^\d{6}$/.test(word)) {
      entities.push(`PROD:${word}`);
    }
  }
  return entities;
}

export function resolveSemanticQuery(userMessage: string): SemanticResolutionResult {
  const normalized = normalizeText(userMessage);
  const metrics = resolveMetrics(normalized);
  const entities = resolveEntities(normalized);
  const ambiguities: string[] = [];
  
  // Rule: If we detect multiple conflicting domains or cannot figure out exactly what metric they want
  if (metrics.length > 2) {
    ambiguities.push('Sorgu birden fazla farklı finansal ve operasyonel metrik içeriyor. Tam olarak hangisine odaklanılmalı?');
  } else if (metrics.length === 0 && entities.length === 0) {
    ambiguities.push('Sorguda belirli bir metrik veya varlık (müşteri/ürün) bulunamadı.');
  }

  const isAmbiguous = ambiguities.length > 0;

  const plan: SemanticQueryPlan = {
    intent_id: isAmbiguous ? 'UNKNOWN' : 'RESOLVED',
    domain: metrics.includes('FIN-006') || metrics.includes('FIN-015') ? 'FINANCE' : 'SALES',
    metric_ids: metrics,
    entity_refs: entities,
    confidence: isAmbiguous ? 0.4 : 0.9,
    ambiguities: ambiguities.length > 0 ? ambiguities : undefined
  };

  return {
    plan: isAmbiguous ? null : plan, // Fail-closed or return with ambiguity
    error: isAmbiguous ? ambiguities.join(' ') : undefined,
    isAmbiguous
  };
}
