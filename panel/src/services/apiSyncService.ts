import { fetchApi } from '../lib/apiClient';
import { supabase } from '../lib/supabaseClient';
import { customerState, setSupabaseSyncedData } from './customerService';
import { invalidateCache, notifyListeners } from './customerService';
import { fetchTargetsFromApi } from './targetService';
import { getTodayDispatchSummary, getTodayDispatchOrders } from './todayDispatchService';
import { getDeliveredInvoiceOpenStack } from './deliveredInvoiceCheckService';
import { getCommercialStockSummary } from './commercialStockService';

const TABLE_MAP: Record<string, { table: string; onConflict: string; transform: (r: any) => any }> = {
  MUSTERI_MASTER: {
    table: 'customers',
    onConflict: 'customer_code',
    transform: (r) => ({ customer_code: String(r.customerId || r.customer_code || '') })
  },
  SATIS: {
    table: 'invoices',
    onConflict: 'document_no',
    transform: (r) => ({ document_no: r.eDocumentNo || r.invoiceId, billing_date: r.invoiceDate, amount: Number(r.amount) || 0 })
  },
  NAKIT_TAHSILAT: {
    table: 'payments',
    onConflict: 'id',
    transform: (r) => ({ id: r.collectionId, amount: Number(r.amount) || 0, payment_date: r.date, status: r.status || 'CREATED' })
  },
  HAVALE_TAHSILAT: {
    table: 'payments',
    onConflict: 'id',
    transform: (r) => ({ id: r.collectionId, amount: Number(r.amount) || 0, payment_date: r.date, status: r.status || 'CREATED' })
  },
  CEK: {
    table: 'cheques',
    onConflict: 'id',
    transform: (r) => ({ id: r.id, amount: Number(r.amount) || 0, due_date: r.dueDate, doc_no: r.docNo, type: 'CEK', status: r.status })
  },
  SENET: {
    table: 'cheques',
    onConflict: 'id',
    transform: (r) => ({ id: r.id, amount: Number(r.amount) || 0, due_date: r.dueDate, doc_no: r.docNo, type: 'SENET', status: r.status })
  },
  SELLOUT_VERISI: {
    table: 'sellout_staging_rows',
    onConflict: 'id',
    transform: (r) => ({ id: r.id || r.faturaNo, billing_date: r.tarih, net_sales_litres: Number(r.litre) || 0 })
  }
};

/**
 * Excel yükleme sonrası veriyi Supabase'e yazar.
 * Önce backend API (/upload-sync) denenir. Backend kapalı veya canlı statik sitede ise
 * doğrudan Supabase istemcisi üzerinden yazılır.
 */
export async function writeUploadToSupabase(
  fileTypeKey: string,
  records: any[]
): Promise<string[]> {
  const errors: string[] = [];
  if (!records?.length) return errors;

  let apiSuccess = false;
  try {
    const result = await fetchApi('/upload-sync', {
      method: 'POST',
      body: JSON.stringify({ fileTypeKey, records }),
    });
    if (result?.ok || result?.skipped) {
      apiSuccess = true;
    }
  } catch (e) {
    // Backend çevrimdışı veya canlı sitede — doğrudan Supabase istemcisine geç
  }

  if (!apiSuccess) {
    const mapping = TABLE_MAP[fileTypeKey];
    if (mapping) {
      const transformed = records
        .map(mapping.transform)
        .filter(r => Object.values(r).some(v => v !== undefined && v !== null && v !== ''));

      if (transformed.length > 0) {
        const { error } = await supabase
          .from(mapping.table)
          .upsert(transformed, { onConflict: mapping.onConflict });
        if (error) {
          errors.push(`${fileTypeKey}: ${error.message}`);
        }
      }
    }
  }

  return errors;
}

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
