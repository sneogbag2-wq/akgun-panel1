import { customerState } from './customerService';
import { safeIsoDate } from '../utils/dateUtils';
import { isAdminAuthenticated } from './customRulesService';
import { ready, invalidateCache, autoMatchAndClearChequesAndSenets } from './customerService';
import { notifyDataChange } from './customerEvents';
import { supabase } from '../lib/supabaseClient';
import { syncDataFromApi } from './apiSyncService';

async function getCustomerUUID(customerCode: string) {
  try {
    const { data } = await supabase
      .from('customers')
      .select('customer_id')
      .eq('customer_code', customerCode)
      .single();
    return data?.customer_id;
  } catch {
    return null;
  }
}

export async function addManualInvoice({ customerId, invoiceDate, amount, eDocumentNo, description }: any) {
  await ready();
  if (!isAdminAuthenticated()) {
    throw new Error('🔒 Bu işlem yetki korumalıdır. Veritabanında ekleme, silme veya değişiklik yapmak için Admin Girişi yapılması gerekmektedir.');
  }
  const numAmount = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/\./g, '').replace(',', '.')) || 0;
  if (!customerId || numAmount <= 0) {
    throw new Error('Geçersiz müşteri veya fatura tutarı');
  }

  const docNo = eDocumentNo || `FAT-MAN-${Date.now().toString().slice(-6)}`;
  
  const uuid = await getCustomerUUID(customerId);
  if (!uuid) throw new Error('Müşteri bulunamadı (UUID)');

  const { error } = await supabase.from('invoices').insert({
    customer_id: uuid,
    document_no: docNo,
    billing_date: safeIsoDate(invoiceDate || new Date()),
    amount: numAmount,
    status: 'ACTIVE'
  });
  
  if (error) throw new Error(`Supabase invoice insert error: ${error.message}`);

  await syncDataFromApi();
  return { invoiceId: docNo };
}

export async function addManualCollection({ customerId, date, amount, method = 'NAKİT', eDocumentNo, description }: any) {
  await ready();
  if (!isAdminAuthenticated()) {
    throw new Error('🔒 Bu işlem yetki korumalıdır. Veritabanında ekleme, silme veya değişiklik yapmak için Admin Girişi yapılması gerekmektedir.');
  }
  const numAmount = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/\./g, '').replace(',', '.')) || 0;
  if (!customerId || numAmount <= 0) {
    throw new Error('Geçersiz müşteri veya tahsilat tutarı');
  }

  const docNo = eDocumentNo || `TAH-MAN-${Date.now().toString().slice(-6)}`;

  const { error } = await supabase.from('temp_payment_signals').insert({
    customer_id: customerId,
    amount: numAmount,
    payment_date: safeIsoDate(date || new Date()),
    status: 'ACTIVE'
  });

  if (error) throw new Error(`Supabase payment insert error: ${error.message}`);

  await syncDataFromApi();
  return { collectionId: docNo };
}

export async function addVirmanTransfer({ sourceCustomerId, targetCustomerId, date, amount, description }: any) {
  await ready();
  if (!isAdminAuthenticated()) {
    throw new Error('🔒 Bu işlem yetki korumalıdır. Veritabanında ekleme, silme veya değişiklik yapmak için Admin Girişi yapılması gerekmektedir.');
  }
  const numAmount = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/\./g, '').replace(',', '.')) || 0;
  if (!sourceCustomerId || !targetCustomerId || sourceCustomerId === targetCustomerId || numAmount <= 0) {
    throw new Error('Geçersiz virman kaynak/hedef müşterisi veya tutarı');
  }

  const vDocNo = `VRM-${Date.now().toString().slice(-6)}`;
  const vDate = safeIsoDate(date || new Date());

  const targetUuid = await getCustomerUUID(targetCustomerId);
  if (!targetUuid) throw new Error('Hedef müşteri bulunamadı (UUID)');

  const { error: invErr } = await supabase.from('invoices').insert({
    customer_id: targetUuid,
    document_no: vDocNo,
    billing_date: vDate,
    amount: numAmount,
    status: 'ACTIVE'
  });
  if (invErr) throw new Error(`Virman invoice insert error: ${invErr.message}`);

  const { error: crErr } = await supabase.from('credit_events').insert({
    customer_id: sourceCustomerId,
    amount: numAmount,
    event_type: 'RETURN',
    event_date: vDate
  });
  if (crErr) throw new Error(`Virman credit insert error: ${crErr.message}`);

  await syncDataFromApi();
  return { virmanDocNo: vDocNo };
}

export async function deleteTransactionRecord({ id, type, customerId }: any) {
  await ready();
  if (!isAdminAuthenticated()) {
    throw new Error('🔒 Bu işlem yetki korumalıdır. Veritabanında ekleme, silme veya değişiklik yapmak için Admin Girişi yapılması gerekmektedir.');
  }
  if (!id) throw new Error('Silinecek işlem ID belirtilmedi');

  const strType = String(type || '').toUpperCase();

  if (strType.includes('SATIŞ') || strType.includes('FATURA')) {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw new Error(`Invoice delete error: ${error.message}`);
  } else if (strType.includes('TAHSİLAT')) {
    const { error } = await supabase.from('temp_payment_signals').delete().eq('id', id);
    if (error) throw new Error(`Collection delete error: ${error.message}`);
  } else if (strType.includes('DEKONT') || strType.includes('VİRMAN') || strType.includes('İADE')) {
    const { error } = await supabase.from('credit_events').delete().eq('id', id);
    if (error) throw new Error(`Credit event delete error: ${error.message}`);
  } else {
    await Promise.all([
      supabase.from('invoices').delete().eq('id', id),
      supabase.from('temp_payment_signals').delete().eq('id', id),
      supabase.from('credit_events').delete().eq('id', id),
      supabase.from('cheques').delete().eq('id', id)
    ]);
  }

  await syncDataFromApi();
  return { success: true, deletedId: id };
}

export async function bulkDeleteTransactions({ year, customerId, type }: any) {
  await ready();
  throw new Error('Toplu silme işlemi veritabanı üzerinden desteklenmemektedir.');
}

export async function purgeTestImportRecords() {
  await ready();
  throw new Error('Test verilerini temizleme işlemi veritabanı üzerinden desteklenmemektedir.');
}

export async function addManualCheque(record: any) {
  await ready();
  if (!isAdminAuthenticated()) {
    throw new Error('🔒 Bu işlem yetki korumalıdır. Veritabanında ekleme, silme veya değişiklik yapmak için Admin Girişi yapılması gerekmektedir.');
  }
  const newId = record.id || `manual_cs_${Date.now()}`;
  const { error } = await supabase.from('cheques').insert({
    id: newId,
    customer_id: record.customerId,
    amount: Number(record.amount || 0),
    issue_date: record.issueDate,
    due_date: record.dueDate,
    doc_no: record.docNo,
    sub_no: record.subNo,
    status: 'CREATED',
    type: record.type || 'ÇEK'
  });
  if (error) throw new Error(`Cheque insert failed: ${error.message}`);
  
  await syncDataFromApi();
  return { id: newId };
}

export async function updateManualCheque(id: string, updatedFields: any) {
  await ready();
  if (!isAdminAuthenticated()) {
    throw new Error('🔒 Bu işlem yetki korumalıdır. Veritabanında ekleme, silme veya değişiklik yapmak için Admin Girişi yapılması gerekmektedir.');
  }
  const { error } = await supabase.from('cheques').update({
    amount: Number(updatedFields.amount || 0),
    issue_date: updatedFields.issueDate,
    due_date: updatedFields.dueDate,
    doc_no: updatedFields.docNo,
    sub_no: updatedFields.subNo,
    status: updatedFields.status,
    type: updatedFields.type
  }).eq('id', id);

  if (error) throw new Error(`Cheque update failed: ${error.message}`);
  
  await syncDataFromApi();
  return { id };
}

export async function deleteManualCheque(id: string) {
  await ready();
  if (!isAdminAuthenticated()) {
    throw new Error('🔒 Bu işlem yetki korumalıdır. Veritabanında ekleme, silme veya değişiklik yapmak için Admin Girişi yapılması gerekmektedir.');
  }
  const cleanId = String(id || '').trim();
  const { error } = await supabase.from('cheques').delete().eq('id', cleanId);
  if (error) throw new Error(`Cheque delete failed: ${error.message}`);
  
  await syncDataFromApi();
}
