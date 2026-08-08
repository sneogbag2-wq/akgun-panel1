import { fetchApi } from '../lib/apiClient';
import { supabase } from '../lib/supabaseClient';
import { customerState, setSupabaseSyncedData } from './customerService';
import { invalidateCache, notifyListeners } from './customerService';
import { fetchTargetsFromApi } from './targetService';
import { getTodayDispatchSummary, getTodayDispatchOrders } from './todayDispatchService';
import { getDeliveredInvoiceOpenStack } from './deliveredInvoiceCheckService';
import { getCommercialStockSummary } from './commercialStockService';

export async function syncDataFromApi() {
  console.log('🔄 Syncing real data from Supabase/Backend API...');

  let mappedCustomers: any[] = [];
  let mappedInvoices: any[] = [];
  let mappedCollections: any[] = [];
  let mappedCheques: any[] = [];

  // 1. Fetch Customers
  const { data: customersData, error: custErr } = await supabase.from('customers').select('*');
  if (custErr) console.warn(`Customer sync warning: ${custErr.message}`);
  if (customersData && customersData.length > 0) {
    mappedCustomers = customersData.map((c: any) => ({
      customerId: c.customer_code,
      customerName: c.customer_code,
      signName: c.customer_code,
      customerStatus: 'Aktif',
    }));
    customerState.customers = mappedCustomers;
  }

  // 2. Fetch Advanced Sellout Events
  try {
    const selloutRes = await fetchApi('/sellout/advanced/events');
    if (selloutRes && selloutRes.data) {
      customerState.selloutRecords = selloutRes.data.map((e: any) => ({
        ...e,
        tarih: e.billing_date,
        faturaNo: e.document_id,
        musteriKodu: e.customer_id || 'UNKNOWN',
        litre: e.net_sales_litres || 0
      }));
    }
  } catch (e) {
    console.warn('Sellout events fetch skipped:', e);
  }

  // 3. Fetch Invoices
  const { data: invoiceData, error: invErr } = await supabase.from('invoices').select('id, customer_id, document_no, billing_date, amount, customers(customer_code)');
  if (invErr) console.warn(`Invoice sync warning: ${invErr.message}`);
  if (invoiceData && invoiceData.length > 0) {
    mappedInvoices = invoiceData.map((inv: any) => ({
      invoiceId: inv.id,
      customerId: inv.customers?.customer_code || inv.customer_id,
      invoiceDate: inv.billing_date,
      amount: Number(inv.amount || 0),
      eDocumentNo: inv.document_no
    }));
    (customerState as any).invoices = mappedInvoices;
  }

  // 4. Fetch Payments / Collections
  const { data: paymentData, error: payErr } = await supabase.from('temp_payment_signals').select('*');
  if (payErr) console.warn(`Payment sync warning: ${payErr.message}`);
  if (paymentData && paymentData.length > 0) {
    mappedCollections = paymentData.map((p: any) => ({
      collectionId: p.id,
      customerId: p.customer_id,
      date: p.payment_date,
      amount: Number(p.amount || 0),
      status: p.status || 'CREATED',
      method: 'HAVALE'
    }));
    customerState.collections = mappedCollections;
  }

  // 5. Fetch Cheques
  const { data: chequeData, error: chqErr } = await supabase.from('cheques').select('*');
  if (chqErr) console.warn(`Cheque sync warning: ${chqErr.message}`);
  if (chequeData && chequeData.length > 0) {
    mappedCheques = chequeData.map((c: any) => ({
      id: c.id,
      customerId: c.customer_id,
      amount: Number(c.amount || 0),
      issueDate: c.issue_date,
      dueDate: c.due_date,
      docNo: c.doc_no,
      subNo: c.sub_no,
      type: c.type,
      status: c.status
    }));
    customerState.cheques = mappedCheques;
  }

  setSupabaseSyncedData({
    customers: mappedCustomers,
    salesInvoices: mappedInvoices,
    collections: mappedCollections,
    cheques: mappedCheques
  });


  // 6. Data Quality Issues (CUS, ORG, DQ)
  try {
    const dqRes = await fetchApi('/customer-master/dq-issues');
    if (dqRes && dqRes.data) {
        (customerState as any).apiDqIssues = dqRes.data;
    }
  } catch (e) {
    console.warn('DQ issues fetch skipped:', e);
  }

  // 8. Fetch Today's Dispatch (Paket 07B)
  try {
    const summary = await getTodayDispatchSummary();
    const orders = await getTodayDispatchOrders();
    customerState.todayDispatchSummary = summary || null;
    customerState.todayDispatchOrders = orders || [];
  } catch (e) {
    console.warn('Today dispatch sync skipped:', e);
  }

  // 9. Fetch Delivered Invoice Open Stack (Paket 10A)
  try {
    const stack = await getDeliveredInvoiceOpenStack();
    customerState.deliveredInvoiceOpenStack = stack || [];
  } catch (e) {
    console.warn('Delivered invoice open stack sync skipped:', e);
  }

  // 10. Fetch Commercial Stock Summary (Paket 06A)
  try {
    const stock = await getCommercialStockSummary();
    customerState.commercialStockItems = stock || [];
  } catch (e) {
    console.warn('Commercial stock sync skipped:', e);
  }



  // usingSeedData disabled
  invalidateCache();

  
  // 7. Load targets
  await fetchTargetsFromApi();
  
  setTimeout(() => notifyListeners(), 100);
  
  console.log('✅ Successfully synced data from API.');
  return true;
}
