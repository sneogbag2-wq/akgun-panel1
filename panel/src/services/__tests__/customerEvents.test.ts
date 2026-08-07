import { describe, expect, it, vi } from 'vitest';
import {
  getDashboardActiveFilters,
  notifyDataChange,
  setDashboardActiveFilters,
  subscribeDashboardFilters,
  subscribeDataChange
} from '../customerEvents';

describe('customer event subscriptions', () => {
  it('notifies data subscribers until they unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDataChange(listener);

    notifyDataChange();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    notifyDataChange();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('publishes the current dashboard filters and merges updates', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDashboardFilters(listener);
    const initial = getDashboardActiveFilters();

    expect(listener).toHaveBeenLastCalledWith(initial);

    setDashboardActiveFilters({ page: 'fatura-kontrol', selectedDate: '2026-08-04' });
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 'fatura-kontrol',
      selectedDate: '2026-08-04',
      repFilter: initial.repFilter
    }));

    unsubscribe();
    setDashboardActiveFilters({ page: 'dashboard' });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
