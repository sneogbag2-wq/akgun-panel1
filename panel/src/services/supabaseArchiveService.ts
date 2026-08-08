import { supabase } from '../lib/supabaseClient';
import { customerState } from './customerService';
import {
  archivePurchaseInvoices as localArchivePurchaseInvoices,
  archiveCreditNotes as localArchiveCreditNotes,
  archiveShipmentBelgeler as localArchiveShipmentBelgeler,
  archiveShipmentSiparisler as localArchiveShipmentSiparisler,
  archiveSelloutData as localArchiveSelloutData,
  loadAllCreditNotes as localLoadAllCreditNotes,
  loadAllPurchaseInvoices as localLoadAllPurchaseInvoices,
  loadAllShipmentBelgeler as localLoadAllShipmentBelgeler,
  loadAllShipmentSiparisler as localLoadAllShipmentSiparisler,
  loadAllSelloutData as localLoadAllSelloutData,
  deleteSalesInvoiceRecord as localDeleteSalesInvoiceRecord,
  deleteCollectionRecord as localDeleteCollectionRecord,
  deleteCreditNoteRecord as localDeleteCreditNoteRecord,
  deleteChequeRecord as localDeleteChequeRecord,
  updateChequesInArchive as localUpdateChequesInArchive,
} from './archiveService';

export const hasArchivedData = async () => true;

// Loaders (Delegates to the synced state)
export const loadCustomers = async () => customerState.customers || [];
export const loadAllSalesInvoices = async () => customerState.salesInvoices || [];
export const loadAllCollections = async () => customerState.collections || [];
export const loadAllCreditNotes = async () => localLoadAllCreditNotes();
export const loadAllPurchaseInvoices = async () => localLoadAllPurchaseInvoices();
export const loadAllCheques = async () => customerState.cheques || [];
export const loadAllShipmentBelgeler = async () => localLoadAllShipmentBelgeler();
export const loadAllShipmentSiparisler = async () => localLoadAllShipmentSiparisler();

// Combine API and local sellout data so uploaded files show up even if API fails
export const loadAllSelloutData = async () => {
  const apiData = customerState.selloutRecords || [];
  const localData = await localLoadAllSelloutData();
  return [...apiData, ...localData];
};

export const clearAllArchive = async () => {
    console.warn('clearAllArchive called, but Supabase data should not be cleared locally.');
};

export const addUploadLogEntry = async (entry: any) => {
    console.log('Upload Log:', entry);
};

// Archivers (Upload to Supabase)

export const archiveCustomers = async (records: any[]) => {
    if (!records || records.length === 0) return { added: 0 };
    
    const payload = records.map(r => ({
        customer_code: r.customerId,
    }));

    const { error } = await supabase.from('customers').upsert(payload, { onConflict: 'customer_code' });
    if (error) console.error('Error archiving customers:', error);
    
    return { added: records.length, skippedDuplicate: 0, cancelledRemoved: 0 };
};

export const archiveSalesInvoices = async (records: any[]) => {
    if (!records || records.length === 0) return { added: 0 };

    const codes = [...new Set(records.map(r => r.customerId))].filter(Boolean);
    if (codes.length > 0) {
      await supabase.from('customers').upsert(
        codes.map(c => ({ customer_code: c })),
        { onConflict: 'customer_code' }
      );
    }

    const { data: customers } = await supabase.from('customers').select('customer_id, customer_code').in('customer_code', codes);
    const codeToId = new Map((customers || []).map(c => [c.customer_code, c.customer_id]));

    const payload = records.map(r => ({
        customer_id: codeToId.get(r.customerId),
        document_no: r.eDocumentNo || String(r.invoiceId),
        billing_date: r.invoiceDate,
        amount: r.amount
    })).filter(p => p.customer_id);

    const { error } = await supabase.from('invoices').upsert(payload, { onConflict: 'document_no,customer_id' });
    if (error) console.error('Error archiving invoices:', error);

    return { added: records.length, skippedDuplicate: 0, cancelledRemoved: 0 };
};

export const archiveCollections = async (records: any[]) => {
    if (!records || records.length === 0) return { added: 0 };

    const codes = [...new Set(records.map(r => r.customerId))].filter(Boolean);
    if (codes.length > 0) {
      await supabase.from('customers').upsert(
        codes.map(c => ({ customer_code: c })),
        { onConflict: 'customer_code' }
      );
    }

    const { data: customers } = await supabase.from('customers').select('customer_id, customer_code').in('customer_code', codes);
    const codeToId = new Map((customers || []).map(c => [c.customer_code, c.customer_id]));

    const payload = records.map(r => ({
        customer_id: codeToId.get(r.customerId),
        payment_date: r.date,
        amount: r.amount,
        status: r.status || 'CREATED',
    })).filter(p => p.customer_id);

    const { error } = await supabase.from('temp_payment_signals').upsert(payload);
    if (error) console.error('Error archiving collections:', error);

    return { added: records.length, skippedDuplicate: 0, cancelledRemoved: 0 };
};

export const archiveCheques = async (records: any[]) => {
    if (!records || records.length === 0) return { added: 0 };

    const codes = [...new Set(records.map(r => r.customerId))].filter(Boolean);
    if (codes.length > 0) {
      await supabase.from('customers').upsert(
        codes.map(c => ({ customer_code: c })),
        { onConflict: 'customer_code' }
      );
    }

    const { data: customers } = await supabase.from('customers').select('customer_id, customer_code').in('customer_code', codes);
    const codeToId = new Map((customers || []).map(c => [c.customer_code, c.customer_id]));

    const payload = records.map(r => ({
        customer_id: codeToId.get(r.customerId),
        amount: r.amount,
        issue_date: r.issueDate,
        due_date: r.dueDate,
        doc_no: r.docNo || 'NO-DOC',
        sub_no: r.subNo || 'NO-SUB',
        type: r.type || 'CEK',
        status: r.status || 'CREATED'
    })).filter(p => p.customer_id);

    const { error } = await supabase.from('cheques').upsert(payload);
    if (error) console.error('Error archiving cheques:', error);

    return { added: records.length, skippedDuplicate: 0, cancelledRemoved: 0 };
};

// Fallback to IndexedDB for unmapped schemas to prevent data loss during upload
export const archivePurchaseInvoices = localArchivePurchaseInvoices;
export const archiveCreditNotes = localArchiveCreditNotes;
export const archiveShipmentBelgeler = localArchiveShipmentBelgeler;
export const archiveShipmentSiparisler = localArchiveShipmentSiparisler;
export const archiveSelloutData = localArchiveSelloutData;

export const deleteSalesInvoiceRecord = localDeleteSalesInvoiceRecord;
export const deleteCollectionRecord = localDeleteCollectionRecord;
export const deleteCreditNoteRecord = localDeleteCreditNoteRecord;
export const deleteChequeRecord = localDeleteChequeRecord;
export const updateChequesInArchive = localUpdateChequesInArchive;
