import { describe, expect, it } from 'vitest';
import { deleteDynamicSubagent, listDynamicSubagents, upsertDynamicSubagent } from '../aiTools';

describe('dynamic subagent management', () => {
  it('creates, updates, lists and deletes a user-defined subagent', () => {
    const created = upsertDynamicSubagent({ name: 'cashFlowScout', role: 'Nakit Akışı Analisti', description: 'Tahsilat riski izler', systemPrompt: 'Sadece nakit akışını incele.' });
    expect(created.name).toBe('cashFlowScout');
    expect(listDynamicSubagents().some((agent) => agent.name === 'cashFlowScout')).toBe(true);

    const updated = upsertDynamicSubagent({ ...created, role: 'Kıdemli Nakit Akışı Analisti' });
    expect(updated.role).toBe('Kıdemli Nakit Akışı Analisti');
    expect(deleteDynamicSubagent('cashFlowScout')).toBe(true);
    expect(listDynamicSubagents().some((agent) => agent.name === 'cashFlowScout')).toBe(false);
  });

  it('does not delete built-in agents', () => {
    expect(deleteDynamicSubagent('researchSubagent')).toBe(false);
  });
});
