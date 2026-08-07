// src/services/customerService/state.ts

export interface CustomerState {
  customers: any[];
  invoices: any[];
  collections: any[];
  salesReps: any[];
  cheques: any[];
  senets: any[];
  creditNotes: any[];
  overrides: any[];
  salesOrders: any[];
  commercialStock: any[];
  todayDispatch: any[];
  deliveredInvoiceCheck: any[];
  returnServiceCredit: any[];
  promissoryNoteTemplates: any[];
  officialCollections: any[];
  reconciliationSummary: any;
  customRules: any[];
  isLoaded: boolean;
  lastUpdated: string | null;
}

export const customerState: CustomerState = {
  customers: [],
  invoices: [],
  collections: [],
  salesReps: [],
  cheques: [],
  senets: [],
  creditNotes: [],
  overrides: [],
  salesOrders: [],
  commercialStock: [],
  todayDispatch: [],
  deliveredInvoiceCheck: [],
  returnServiceCredit: [],
  promissoryNoteTemplates: [],
  officialCollections: [],
  reconciliationSummary: null,
  customRules: [],
  isLoaded: false,
  lastUpdated: null,
};

export const listeners = new Set<() => void>();

export function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function subscribeToCustomerState(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

let _initPromise: Promise<void> | null = null;

export function getInitPromise() {
  return _initPromise;
}

export function setInitPromise(promise: Promise<void> | null) {
  _initPromise = promise;
}

export async function ready() {
  if (_initPromise) await _initPromise;
}
