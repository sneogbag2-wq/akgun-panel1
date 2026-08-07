import {
  addManualInvoice,
  addManualCollection,
  addVirmanTransfer,
  deleteTransactionRecord,
  bulkDeleteTransactions,
  addManualCheque,
  updateManualCheque,
  deleteManualCheque,
  purgeTestImportRecords
} from './customerService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { isAdminAuthenticated } from './customRulesService';
import type {
  AddManualInvoiceArgs,
  AddManualCollectionArgs,
  AddVirmanTransferArgs,
  DeleteTransactionArgs,
  BulkDeleteTransactionsArgs,
  AddManualChequeArgs,
  UpdateManualChequeArgs,
  DeleteManualChequeArgs
} from '../types/ai';

type MutationToolHandler = (args: any) => Promise<any> | any;
const mutationToolHandlers = new Map<string, MutationToolHandler>();

mutationToolHandlers.set('addManualInvoice', async (args: AddManualInvoiceArgs) => {
  const inv = await addManualInvoice(args);
  return {
    success: true,
    message: `Manuel fatura başarıyla eklendi: ${inv.invoiceId}`,
    invoice: {
      invoiceId: inv.invoiceId,
      customerId: inv.customerId,
      amount: formatCurrency(inv.amount),
      date: formatDate(inv.invoiceDate)
    }
  };
});

mutationToolHandlers.set('addManualCollection', async (args: AddManualCollectionArgs) => {
  const col = await addManualCollection(args);
  return {
    success: true,
    message: `Manuel tahsilat başarıyla eklendi: ${col.collectionId}`,
    collection: {
      collectionId: col.collectionId,
      customerId: col.customerId,
      amount: formatCurrency(col.amount),
      method: col.method,
      date: formatDate(col.date)
    }
  };
});

mutationToolHandlers.set('addVirmanTransfer', async (args: AddVirmanTransferArgs) => {
  const res = await addVirmanTransfer(args);
  return {
    success: true,
    message: `Cariler arası virman transferi yapıldı (Belge No: ${res.virmanDocNo})`,
    virmanDocNo: res.virmanDocNo
  };
});

mutationToolHandlers.set('deleteTransaction', async (args: DeleteTransactionArgs) => {
  const res = await deleteTransactionRecord(args);
  return {
    success: true,
    message: `İşlem başarıyla silindi (ID: ${args.id})`,
    deletedId: args.id
  };
});

mutationToolHandlers.set('bulkDeleteTransactions', async (args: BulkDeleteTransactionsArgs) => {
  if (!isAdminAuthenticated()) return { error: 'Bu işlem için Admin girişi yapılması gereklidir.' };
  const res = await bulkDeleteTransactions(args);
  return {
    success: true,
    message: `Kriterlere uyan toplam ${res.deletedCount} adet işlem kalıcı olarak silindi.`,
    deletedCount: res.deletedCount
  };
});

mutationToolHandlers.set('addManualCheque', async (args: AddManualChequeArgs) => {
  const res = await addManualCheque(args);
  return {
    success: true,
    message: `${res.type} kaydı/güncellemesi başarıyla eklendi (${res.docNo})`,
    cheque: res
  };
});

mutationToolHandlers.set('updateManualCheque', async (args: UpdateManualChequeArgs) => {
  const res = await updateManualCheque(args.id as string, { status: args.status || 'IADE', description: args.description || 'AI Güncelleme' });
  return {
    success: true,
    message: `Çek/Senet durumu '${args.status || 'IADE'}' olarak güncellendi (ID: ${args.id})`,
    cheque: res
  };
});

mutationToolHandlers.set('deleteManualCheque', async (args: DeleteManualChequeArgs) => {
  await deleteManualCheque(args.id as string);
  return {
    success: true,
    message: `Çek/Senet kaydı veritabanından başarıyla silindi (ID: ${args.id})`
  };
});

mutationToolHandlers.set('purgeTestImportRecords', async () => {
  if (!isAdminAuthenticated()) return { error: 'Bu işlem için Admin girişi yapılması gereklidir.' };
  const res = await purgeTestImportRecords();
  return {
    success: true,
    deletedCount: res.deletedCount,
    message: `Veritabanı temizlendi! Toplam ${res.deletedCount} adet hatalı test/aktarım kaydı silindi.`
  };
});

export function getMutationToolHandler(toolName: string): MutationToolHandler | undefined {
  return mutationToolHandlers.get(toolName);
}
