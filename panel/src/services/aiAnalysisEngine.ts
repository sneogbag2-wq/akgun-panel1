import { AiAnalysisClaim, MetricResultEnvelope } from '../types/ai';

const MATERIALITY_ORDER: Record<string, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/**
 * Engine to produce evidence-bound claims from a set of metrics.
 * This simulates the strict policy that a claim MUST be backed by a metric.
 */
export function generateClaims(
  envelopes: MetricResultEnvelope[],
  proposedClaims: AiAnalysisClaim[] // In reality, this might come from an LLM response or deterministic rule sets
): AiAnalysisClaim[] {
  // Policy 1: Reject any claim that has no supporting metrics (hallucination prevention)
  const evidenceBoundClaims = proposedClaims.filter((claim) => {
    return claim.supporting_metric_result_ids && claim.supporting_metric_result_ids.length > 0;
  });

  // Policy 2: Ensure that the supporting metrics actually exist in the provided envelopes
  const validEnvelopeIds = new Set(envelopes.map((e) => e.metric_result_id));
  
  const verifiedClaims = evidenceBoundClaims.filter((claim) => {
    // Check if every supporting ID is present in our verified metric results
    return claim.supporting_metric_result_ids!.every((id) => validEnvelopeIds.has(id));
  });

  return sortClaimsByMateriality(verifiedClaims);
}

/**
 * Sorts claims based on their materiality (HIGH > MEDIUM > LOW).
 */
export function sortClaimsByMateriality(claims: AiAnalysisClaim[]): AiAnalysisClaim[] {
  return [...claims].sort((a, b) => {
    const valA = MATERIALITY_ORDER[a.materiality?.toUpperCase() || 'LOW'] || 0;
    const valB = MATERIALITY_ORDER[b.materiality?.toUpperCase() || 'LOW'] || 0;
    
    // Sort descending
    return valB - valA;
  });
}
