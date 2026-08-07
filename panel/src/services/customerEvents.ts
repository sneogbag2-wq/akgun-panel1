/** UI-facing subscriptions for the customer data domain. */

export interface DashboardCustomer {
  customerId: string;
  customerName?: string;
  signName?: string;
  salesRep?: string;
  salesRepName?: string;
  balance?: number;
  averageVade?: number;
  [key: string]: unknown;
}

export interface DashboardFilters {
  page?: string;
  repFilter?: string;
  searchQuery?: string;
  riskFilter?: string;
  selectedDate?: string;
  modalCustomer?: DashboardCustomer | null;
  modalStartDate?: string;
  modalEndDate?: string;
}

const dataChangeListeners = new Set<() => void>();

export function notifyDataChange() {
  dataChangeListeners.forEach((listener) => listener());
}

export function subscribeDataChange(callback: () => void) {
  dataChangeListeners.add(callback);
  return () => {
    dataChangeListeners.delete(callback);
  };
}

let activeDashboardFilters: DashboardFilters = {
  page: 'dashboard',
  repFilter: 'ALL',
  searchQuery: '',
  riskFilter: 'ALL'
};
const dashboardFilterListeners = new Set<(filters: DashboardFilters) => void>();

export function setDashboardActiveFilters(filters: Partial<DashboardFilters>) {
  activeDashboardFilters = { ...activeDashboardFilters, ...filters };
  dashboardFilterListeners.forEach((listener) => {
    try {
      listener(activeDashboardFilters);
    } catch (error) {
      console.error(error);
    }
  });
}

export function getDashboardActiveFilters(): DashboardFilters {
  return activeDashboardFilters;
}

export function subscribeDashboardFilters(callback: (filters: DashboardFilters) => void) {
  dashboardFilterListeners.add(callback);
  try {
    callback(activeDashboardFilters);
  } catch {
    // A failing UI listener must not prevent future data updates.
  }
  return () => {
    dashboardFilterListeners.delete(callback);
  };
}
