import { describe, it, expect } from 'vitest';
import { generateClaims, sortClaimsByMateriality } from '../aiAnalysisEngine';
import { AiAnalysisClaim, MetricResultEnvelope } from '../../types/ai';

describe('aiAnalysisEngine', () => {
  describe('generateClaims', () => {
    it('should reject claims that have no supporting metric IDs', () => {
      const envelopes: MetricResultEnvelope[] = [
        { metric_result_id: 'mr_1', metric_id: 'FIN-001', metric_version: '1', calculation_run_id: 'r_1', value: 10, unit: 'TRY', value_type: 'numeric', status: 'SUCCESS' }
      ];

      const proposedClaims: AiAnalysisClaim[] = [
        { claim_id: 'c_1', claim_type: 'FACT', text: 'Valid claim', supporting_metric_result_ids: ['mr_1'], materiality: 'HIGH' },
        { claim_id: 'c_2', claim_type: 'INFERENCE', text: 'Hallucination claim without evidence', supporting_metric_result_ids: [], materiality: 'HIGH' },
        { claim_id: 'c_3', claim_type: 'INFERENCE', text: 'Another hallucination', materiality: 'MEDIUM' } // Missing property entirely
      ];

      const result = generateClaims(envelopes, proposedClaims);
      
      expect(result).toHaveLength(1);
      expect(result[0].claim_id).toBe('c_1');
    });

    it('should reject claims that reference non-existent metric IDs', () => {
      const envelopes: MetricResultEnvelope[] = [
        { metric_result_id: 'mr_1', metric_id: 'FIN-001', metric_version: '1', calculation_run_id: 'r_1', value: 10, unit: 'TRY', value_type: 'numeric', status: 'SUCCESS' }
      ];

      const proposedClaims: AiAnalysisClaim[] = [
        { claim_id: 'c_1', claim_type: 'FACT', text: 'References unknown metric', supporting_metric_result_ids: ['mr_999'], materiality: 'HIGH' },
      ];

      const result = generateClaims(envelopes, proposedClaims);
      expect(result).toHaveLength(0);
    });
  });

  describe('sortClaimsByMateriality', () => {
    it('should sort claims HIGH > MEDIUM > LOW', () => {
      const unsorted: AiAnalysisClaim[] = [
        { claim_id: 'c_low', claim_type: 'FACT', text: 'Low', materiality: 'LOW' },
        { claim_id: 'c_high', claim_type: 'FACT', text: 'High', materiality: 'HIGH' },
        { claim_id: 'c_medium', claim_type: 'FACT', text: 'Medium', materiality: 'MEDIUM' },
        { claim_id: 'c_none', claim_type: 'FACT', text: 'None' }, // Default should act as LOW
      ];

      const result = sortClaimsByMateriality(unsorted);
      
      expect(result[0].claim_id).toBe('c_high');
      expect(result[1].claim_id).toBe('c_medium');
      expect(result[2].claim_id).toBe('c_low');
      expect(result[3].claim_id).toBe('c_none');
    });
  });
});
