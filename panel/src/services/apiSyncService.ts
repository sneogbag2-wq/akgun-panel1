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
    transform: (r) => ({ document_no: r.eDocumentNo || r.invoiceId, customer_id: r.customerId, billing_date: r.invoiceDate, amount: Number(r.amount) || 0 })
  },
  NAKIT_TAHSILAT: {
    table: 'payments',
    onConflict: 'id',
    transform: (r) => ({ id: r.collectionId, customer_id: r.customerId, amount: Number(r.amount) || 0, payment_date: r.date, status: r.status || 'CREATED' })
  },
  HAVALE_TAHSILAT: {
    table: 'payments',
    onConflict: 'id',
    transform: (r) => ({ id: r.collectionId, customer_id: r.customerId, amount: Number(r.amount) || 0, payment_date: r.date, status: r.status || 'CREATED' })
  },
  CEK: {
    table: 'cheques',
    onConflict: 'id',
    transform: (r) => ({ id: r.id, customer_id: r.customerId, amount: Number(r.amount) || 0, due_date: r.dueDate, doc_no: r.docNo, type: 'CEK', status: r.status })
  },
  SENET: {
    table: 'cheques',
    onConflict: 'id',
    transform: (r) => ({ id: r.id, customer_id: r.customerId, amount: Number(r.amount) || 0, due_date: r.dueDate, doc_no: r.docNo, type: 'SENET', status: r.status })
  },
  SELLOUT_VERISI: {
    table: 'sellout_staging_rows',
    onConflict: 'id',
    transform: (r) => ({ id: r.id || r.faturaNo, customer_id: r.musteriKodu, billing_date: r.tarih, net_sales_litres: Number(r.litre) || 0 })
  }
};

export async function writeUploadToSupabase(
  fileTypeKey: string,
  records: any[]
): Promise<string[]> {
  // Eski karmaşık tablolara yazma kodunu kaldırıyoruz.
  // Yerine tüm state'i buluta (panel_shared_state) senkronize edeceğiz.
  setTimeout(() => syncStateToCloud(), 1000);
  return [];
}

/**
 * Tüm IndexedDB durumunu (rich veriler dahil) Supabase bulutuna yedekler.
 * Böylece telefon, tablet, PC her yerde veri aynı görünür.
 */
export async function syncStateToCloud() {
  try {
    const payload = {
      customers: customerState.customers,
      invoices: (customerState as any).invoices || [],
      collections: customerState.collections,
      cheques: customerState.cheques,
      selloutRecords: customerState.selloutRecords,
      todayDispatchOrders: customerState.todayDispatchOrders,
      timestamp: new Date().toISOString()
    };

    const { error } = await supabase
      .from('panel_shared_state')
      .upsert({ id: 'global_state', payload, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    
    if (error) {
      console.warn('Cloud sync error (Tablo yok olabilir):', error.message);
    } else {
      console.log('☁️ State successfully backed up to Supabase Cloud!');
    }
  } catch (e) {
    console.warn('Cloud sync skipped:', e);
  }
}

/**
 * Başlangıçta Supabase'den ortak durumu çeker ve uygulamaya yükler.
 */
export async function syncDataFromApi() {
  console.log('🔄 Fetching global state from Supabase Cloud...');
  
  try {
    const { data, error } = await supabase
      .from('panel_shared_state')
      .select('payload')
      .eq('id', 'global_state')
      .single();

    if (error) {
      console.warn('Cloud fetch warning (Tablo eksik olabilir):', error.message);
      return false;
    }

    if (data && data.payload) {
      const p = data.payload;
      if (p.customers?.length) customerState.customers = p.customers;
      if (p.invoices?.length) (customerState as any).invoices = p.invoices;
      if (p.collections?.length) customerState.collections = p.collections;
      if (p.cheques?.length) customerState.cheques = p.cheques;
      if (p.selloutRecords?.length) customerState.selloutRecords = p.selloutRecords;
      if (p.todayDispatchOrders?.length) customerState.todayDispatchOrders = p.todayDispatchOrders;
      
      setSupabaseSyncedData({
        customers: p.customers || [],
        salesInvoices: p.invoices || [],
        collections: p.collections || [],
        cheques: p.cheques || []
      });
      
      invalidateCache();
      setTimeout(() => notifyListeners(), 100);
      console.log('✅ Global state loaded from Supabase Cloud!');
      return true;
    }
  } catch (e) {
    console.warn('Cloud state fetch skipped:', e);
  }
  
  return false;
}
