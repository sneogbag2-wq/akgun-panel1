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
  if (!records || !records.length) return [];

  const config = TABLE_MAP[fileTypeKey];
  if (!config) {
    console.warn(`[Supabase Direct Write] No table map for ${fileTypeKey}, skipping cloud sync.`);
    return [];
  }

  try {
    const transformed = records.map(config.transform);
    console.log(`[Supabase Direct Write] Uploading ${transformed.length} rows to '${config.table}'...`);

    const { error } = await supabase
      .from(config.table)
      .upsert(transformed, { onConflict: config.onConflict });

    if (error) {
      console.warn(`[Supabase Direct Write Error] ${config.table}:`, error.message);
      return [fileTypeKey];
    }

    console.log(`[Supabase Direct Write] Successfully written to '${config.table}'!`);
  } catch (e: any) {
    console.error(`[Supabase Direct Write Exception] ${fileTypeKey}:`, e);
    return [fileTypeKey];
  }

  return [];
}

/**
 * Tüm IndexedDB durumunu Supabase'den günceller (Sadece okuma).
 */
export async function syncDataFromApi() {
  console.log('Fetching official data from Supabase Cloud...');
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Müşteri verilerini resmi View'dan (customer_master_current_public_v2) çek
    const { data: customersData } = await supabase.from('customer_master_current_public_v2').select('*').limit(1000);
    
    // Profilleri çek (İsim ve ünvan için - import.audit yetkisi gerektirir)
    const { data: profilesData } = await supabase.from('customer_profile_versions').select('customer_id, profile_data').is('valid_to', null).limit(1000);
    const profileMap = new Map();
    if (profilesData) {
       profilesData.forEach((p: any) => {
          profileMap.set(p.customer_id, p.profile_data);
       });
    }

    // Diğer tablolar (Eğer RLS izin veriyorsa)
    const { data: paymentsData } = await supabase.from('payments').select('*').limit(1000);
    const { data: chequesData } = await supabase.from('cheques').select('*').limit(1000);

    let updated = false;

    if (customersData && customersData.length > 0) {
      // customer_master_current_public_v2 uses different column names like customer_code, customer_id
      const mappedCustomers = customersData.map(c => {
        const existing = customerState.customers?.find(ex => ex.customerId === c.customer_code);
        const profile = profileMap.get(c.customer_id);
        
        return {
          customerId: c.customer_code,
          customerName: profile?.customerName || existing?.customerName || c.customer_id, // Gecici isim
          unvan: profile?.storeName || existing?.unvan || '',
          vergiDairesi: existing?.vergiDairesi || '',
          vergiNo: existing?.vergiNo || '',
          address: existing?.address || ''
        };
      });
      customerState.customers = mappedCustomers;
      updated = true;
    }

    if (paymentsData && paymentsData.length > 0) {
      customerState.collections = paymentsData.map(p => ({
        collectionId: p.id,
        customerId: p.customer_id,
        amount: Number(p.amount) || 0,
        date: p.payment_date,
        type: 'NAKIT_TAHSILAT',
        status: p.status
      }));
      updated = true;
    }

    if (chequesData && chequesData.length > 0) {
      customerState.cheques = chequesData.map(c => ({
        id: c.id,
        customerId: c.customer_id,
        amount: Number(c.amount) || 0,
        dueDate: c.due_date,
        docNo: c.doc_no,
        type: c.type || 'CEK',
        status: c.status
      }));
      updated = true;
    }

    if (updated) {
      setSupabaseSyncedData({
        customers: customerState.customers || [],
        salesInvoices: [], // invoices omitted for brevity
        collections: customerState.collections || [],
        cheques: customerState.cheques || []
      });
      invalidateCache();
      setTimeout(() => notifyListeners(), 100);
      console.log('Global state loaded from Official Supabase Tables!');
      return true;
    }
  } catch (e) {
    console.warn('Official state fetch skipped:', e);
  }
  
  return false;
}
