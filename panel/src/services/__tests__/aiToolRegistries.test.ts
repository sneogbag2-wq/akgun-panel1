import { describe, it, expect } from 'vitest';
import { getMutationToolHandler } from '../aiMutationToolRegistry';
import { getAgentToolHandler } from '../aiAgentRegistry';
import { getExcelImportToolHandler } from '../aiExcelImportRegistry';

describe('AI Tool Registries', () => {
  it('should correctly register mutation tools', () => {
    const handler = getMutationToolHandler('addManualInvoice');
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
    
    expect(getMutationToolHandler('nonExistentTool')).toBeUndefined();
  });

  it('should correctly register agent tools', () => {
    const handler = getAgentToolHandler('defineSubagent');
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  it('should correctly register excel import tools', () => {
    const handler = getExcelImportToolHandler('mapAndImportExcel');
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });
});
