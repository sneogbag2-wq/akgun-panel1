import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getLedgerEntries, getAgingMigration, getStressScenarios } from '../ledgerService';
import * as apiClient from '../../lib/apiClient';

describe('ledgerService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls ledger endpoints via fetchApi', async () => {
    const mockData = { data: [{ id: '1', amount: 1000 }] };
    const fetchApiSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValue(mockData);

    const ledger = await getLedgerEntries();
    expect(fetchApiSpy).toHaveBeenCalledWith('/ledger');
    expect(ledger).toEqual(mockData);

    const aging = await getAgingMigration();
    expect(fetchApiSpy).toHaveBeenCalledWith('/ledger/aging-migration');
    expect(aging).toEqual(mockData);

    const stress = await getStressScenarios();
    expect(fetchApiSpy).toHaveBeenCalledWith('/ledger/stress-scenarios');
    expect(stress).toEqual(mockData);
  });
});
