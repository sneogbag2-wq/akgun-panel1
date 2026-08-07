import { rawExcelCache } from './uploadService';
import { isAdminAuthenticated } from './customRulesService';
import { runExcelVerificationTest } from './excelTestRunnerService';
import { parseCustomerMaster } from '../parsers/customerMasterParser';
import {
  getCustomerChequesSync,
  getAllCustomersForReportingSync,
  deleteManualCheque,
  updateManualCheque,
  initFromArchive,
  invalidateCache,
  waitForInit
} from './customerService';
import { supabase } from '../lib/supabaseClient';
import { syncDataFromApi } from './apiSyncService';
import { formatCurrency } from '../utils/formatters';
import { safeIsoDate } from '../utils/dateUtils';
import type {
  ReconcileChequesWithExcelArgs,
  RunExcelVerificationTestArgs,
  ImportCustomerMasterArgs,
  MapAndImportExcelArgs,
  AdvancedMapAndImportExcelArgs,
  ReadUploadedExcelDataArgs
} from '../types/ai';

type ExcelImportToolHandler = (args: any) => Promise<any> | any;
const excelImportToolHandlers = new Map<string, ExcelImportToolHandler>();

excelImportToolHandlers.set('reconcileChequesWithExcel', async (args: ReconcileChequesWithExcelArgs) => {
  let rows = rawExcelCache.get(args.fileName as string);
  if (!rows || rows.length === 0) {
    const cachedKeys = Array.from(rawExcelCache.keys());
    if (cachedKeys.length > 0) {
      rows = rawExcelCache.get(cachedKeys[cachedKeys.length - 1]);
    }
  }
  if (!rows || rows.length === 0) return { error: 'Karşılaştırılacak Excel dosyası bulunamadı.' };

  const excelDocNos = new Set<string>();
  const excelAmounts = new Set<number>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      const val = String(r[k] || '').trim();
      if (val) excelDocNos.add(val.toLowerCase());
      const num = parseFloat(String(r[k]).replace(/[^\d\.]/g, ''));
      if (!isNaN(num) && num > 0) excelAmounts.add(num);
    }
  }

  const allCheques = getCustomerChequesSync();
  const action = (args.action || 'IADE').toUpperCase();
  
  const processedCheques: any[] = [];
  let processedCount = 0;
  let totalProcessedAmount = 0;

  for (const ch of allCheques) {
    const docMatch = ch.docNo && excelDocNos.has(String(ch.docNo).toLowerCase());
    const amtMatch = ch.amount && excelAmounts.has(ch.amount);
    
    if (!docMatch && !amtMatch) {
      if (action === 'DELETE') {
        await deleteManualCheque(ch.id);
      } else {
        await updateManualCheque(ch.id, { status: 'IADE', description: 'Excel Karşılaştırma - İade Edildi' });
      }
      processedCount++;
      totalProcessedAmount += (ch.amount || 0);
      processedCheques.push(ch);
    }
  }

  await waitForInit();
  return {
    success: true,
    actionApplied: action === 'DELETE' ? 'SİLİNDİ' : 'İADE EDİLDİ',
    processedCount,
    totalProcessedAmount: formatCurrency(totalProcessedAmount),
    processedCheques: processedCheques.map(c => ({
      docNo: c.docNo,
      customerName: c.customerName,
      amount: formatCurrency(c.amount),
      status: action === 'DELETE' ? 'SİLİNDİ' : 'İADE'
    }))
  };
});

excelImportToolHandlers.set('runExcelVerificationTest', (args: RunExcelVerificationTestArgs) => {
  let inputRows = (args as any).rows;
  if (!inputRows || inputRows.length === 0) {
    const type = (args.fileType || 'SATIS').toUpperCase();
    if (type.includes('CEK') || type.includes('SENET')) {
      inputRows = getCustomerChequesSync();
    } else {
      inputRows = getAllCustomersForReportingSync();
    }
  }
  const res = runExcelVerificationTest(inputRows, args.fileType || 'AUTO', args.userScenarios || '');
  return {
    testReport: res.reportMarkdown,
    passed: res.passedCount,
    failed: res.failedCount,
    warnings: res.warningCount,
    summary: res.reportMarkdown
  };
});

excelImportToolHandlers.set('importCustomerMaster', async (args: ImportCustomerMasterArgs) => {
  if (!isAdminAuthenticated()) return { error: 'Bu işlem için Admin girişi yapılması gereklidir.' };
  let rows = rawExcelCache.get(args.fileName as string);
  if (!rows || rows.length === 0) {
    const cachedKeys = Array.from(rawExcelCache.keys());
    if (cachedKeys.length > 0) {
      rows = rawExcelCache.get(cachedKeys[cachedKeys.length - 1]);
    }
  }
  if (!rows || rows.length === 0) return { error: 'Önbellekte yüklü Müşteri Master Excel verisi bulunamadı. Lütfen önce Müşteri Master Excel dosyanızı ekleyiniz.' };

  const parsed = parseCustomerMaster(rows);
  let added = 0;
  for (const c of parsed.records) {
    if (c.customerId) {
      const { error } = await supabase.from('customers').insert({
        customer_code: c.customerId,
        id: `cust-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      });
      if (!error) added++;
    }
  }
  
  await syncDataFromApi();
  await waitForInit();
  return {
    success: true,
    added: added,
    skippedDuplicate: parsed.records.length - added,
    warnings: parsed.warnings,
    summaryReport: `📊 **Veritabanı İnceleme ve Eşleştirme Raporu (Müşteri Master Listesi):**\n\n• 🛡️ **Mükerrer Kayıt Koruması:** **${parsed.records.length - added} Adet** kayıt veritabanında zaten var olduğu için **görmezden gelindi (korundu).**\n• 📥 **Yeni Eklenen Cariler:** **${added} Adet** veritabanında olmayan yeni müşteri sisteme **kaydedildi!**`
  };
});
excelImportToolHandlers.set('processCustomerMasterImport', excelImportToolHandlers.get('importCustomerMaster')!);

excelImportToolHandlers.set('mapAndImportExcel', async (args: MapAndImportExcelArgs) => {
  if (!isAdminAuthenticated()) return { error: 'Bu işlem için Admin girişi yapılması gereklidir.' };
  let rows = rawExcelCache.get(args.fileName as string);
  if (!rows || rows.length === 0) {
    const cachedKeys = Array.from(rawExcelCache.keys());
    if (cachedKeys.length > 0) {
      rows = rawExcelCache.get(cachedKeys[cachedKeys.length - 1]);
    }
  }
  if (!rows || rows.length === 0) return { error: 'Dosya önbellekte bulunamadı veya boş.' };
  
  const mappedRecords: any[] = [];
  let skipped = 0;

  let index = 0;
  for (const row of rows) {
    const cid = row[args.customerIdField as string];
    const amount = row[args.amountField as string];
    if (!cid || amount === undefined) {
      skipped++;
      continue;
    }
    
    index++;
    if (args.targetType === 'SATIS') {
      mappedRecords.push({
        invoiceId: `MANUAL-EXCEL-${Date.now()}-${index}-${Math.random().toString(36).substr(2,5)}`,
        customerId: String(cid).trim(),
        amount: parseFloat(amount) || 0,
        invoiceDate: args.defaultDate || new Date().toISOString().split('T')[0],
        eDocumentNo: 'ÖZEL_AKTARIM',
        description: args.defaultDescription || 'Tanımsız Excel Aktarımı'
      });
    } else if (args.targetType === 'TAHSILAT') {
      mappedRecords.push({
        collectionId: `MANUAL-EXCEL-${Date.now()}-${index}-${Math.random().toString(36).substr(2,5)}`,
        customerId: String(cid).trim(),
        amount: parseFloat(amount) || 0,
        date: args.defaultDate || new Date().toISOString().split('T')[0],
        method: 'HAVALE',
        eDocumentNo: 'ÖZEL_AKTARIM',
        description: args.defaultDescription || 'Tanımsız Excel Aktarımı'
      });
    } else if (args.targetType === 'CEK') {
      mappedRecords.push({
        id: `MANUAL-EXCEL-${Date.now()}-${index}-${Math.random().toString(36).substr(2,5)}`,
        docNo: 'ÖZEL_AKTARIM',
        customerId: String(cid).trim(),
        amount: parseFloat(amount) || 0,
        issueDate: args.defaultDate || new Date().toISOString().split('T')[0],
        dueDate: args.defaultDate || new Date().toISOString().split('T')[0],
        type: 'ÇEK',
        status: 'PORTFOY'
      });
    }
  }
  
  if (mappedRecords.length > 0) {
    if (args.targetType === 'SATIS') {
      for (const r of mappedRecords) {
        const { error } = await supabase.from('invoices').insert({ customer_id: r.customerId, document_no: r.eDocumentNo, billing_date: r.invoiceDate, amount: r.amount, status: 'ACTIVE' });
        if (error) throw new Error('Fatura eklenemedi: ' + error.message);
      }
    } else if (args.targetType === 'TAHSILAT') {
      for (const r of mappedRecords) {
        const { error } = await supabase.from('temp_payment_signals').insert({ customer_id: r.customerId, amount: r.amount, payment_date: r.date, status: 'ACTIVE' });
        if (error) throw new Error('Tahsilat eklenemedi: ' + error.message);
      }
    } else if (args.targetType === 'CEK') {
      for (const r of mappedRecords) {
        const { error } = await supabase.from('cheques').insert({ id: r.id, customer_id: r.customerId, amount: r.amount, issue_date: r.issueDate, due_date: r.dueDate, doc_no: r.docNo, type: r.type, status: 'CREATED' });
        if (error) throw new Error('Çek eklenemedi: ' + error.message);
      }
    }
    
    await syncDataFromApi();
    await waitForInit();
    return { success: true, processed: mappedRecords.length, addedRecords: mappedRecords.length, skipped, message: `BAŞARILI! Toplam ${mappedRecords.length} kayıt veritabanına eklendi.` };
  } else {
    return { error: 'Geçerli müşteri/tutar bilgisi içeren satır bulunamadı.', skipped };
  }
});

excelImportToolHandlers.set('advancedMapAndImportExcel', async (args: AdvancedMapAndImportExcelArgs) => {
  if (!isAdminAuthenticated()) return { error: 'Bu işlem için Admin girişi yapılması gereklidir.' };
  let rows = rawExcelCache.get(args.fileName as string);
  if (!rows || rows.length === 0) {
    const cachedKeys = Array.from(rawExcelCache.keys());
    if (cachedKeys.length > 0) {
      rows = rawExcelCache.get(cachedKeys[cachedKeys.length - 1]);
    }
  }
  if (!rows || rows.length === 0) return { error: 'Dosya önbellekte bulunamadı veya boş.' };
  
  let processor: Function;
  try {
    processor = new Function('row', args.jsFunctionBody as string);
  } catch (err: any) {
    return { error: 'Oluşturulan JS kodu derlenemedi: ' + err.message };
  }

  const parseAmountHelper = (val: any) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let str = String(val).replace(/[^\d\.,\-]/g, '').trim();
    if (str.includes('.') && str.includes(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',')) {
      str = str.replace(',', '.');
    }
    return parseFloat(str) || 0;
  };

  const getRowValueHelper = (row: any, targetKey: string) => {
    if (!row || !targetKey) return undefined;
    if (row[targetKey] !== undefined) return row[targetKey];
    const normTarget = String(targetKey).replace(/[\s\u00A0]+/g, '').toLowerCase();
    
    const tutarKeywords = ['tutar', 'bakiye', 'borc', 'borç', 'alacak', 'tahsilat', 'ödeme', 'odeme', 'amount', 'net'];
    const isTutarSearch = tutarKeywords.some(kw => normTarget.includes(kw));
    
    const cariKeywords = ['cari', 'müşteri', 'musteri', 'kod', 'id'];
    const isCariSearch = cariKeywords.some(kw => normTarget.includes(kw));

    for (const k of Object.keys(row)) {
      const normK = String(k).replace(/[\s\u00A0]+/g, '').toLowerCase();
      if (normK === normTarget || normK.includes(normTarget)) return row[k];
      if (isTutarSearch && tutarKeywords.some(kw => normK.includes(kw))) return row[k];
      if (isCariSearch && cariKeywords.some(kw => normK.includes(kw))) return row[k];
    }
    return undefined;
  };

  const mappedSales: any[] = [];
  const mappedCollections: any[] = [];
  const mappedCreditNotes: any[] = [];
  const mappedCheques: any[] = [];
  let successCount = 0;
  let errorCount = 0;

  let index = 0;
  for (const rawRow of rows) {
    try {
      index++;
      const proxyRow = new Proxy({ ...rawRow }, {
        get(target, prop) {
          if (typeof prop === 'string') {
            const val = getRowValueHelper(target, prop);
            if (val !== undefined) return val;
          }
          return target[prop as keyof typeof target];
        }
      });

      const results = processor(proxyRow);
      if (Array.isArray(results)) {
        for (const res of results) {
          if (!res) continue;

          let cid = res.customerId ? String(res.customerId).trim() : '';
          if (!cid || !/^5000\d{6}$/.test(cid)) {
            for (const k of Object.keys(rawRow)) {
              const valStr = String(rawRow[k] || '').trim();
              if (/^5000\d{6}$/.test(valStr)) {
                cid = valStr;
                break;
              }
            }
          }
          if (!cid) continue;

          const amount = Math.abs(parseAmountHelper(res.amount));
          if (amount <= 0) continue;

          const rawDate = safeIsoDate(res.date);
          const d = rawDate ? rawDate.split('T')[0] : new Date().toISOString().split('T')[0];
          const desc = res.description || 'AI Gelişmiş Excel Aktarımı';
          
          if (res.type === 'DEVIR_BORC' || res.type === 'DEVIR') {
            const originalAmt = parseAmountHelper(res.amount);
            if (originalAmt < 0) {
              mappedCollections.push({ collectionId: `ADV-DEV-${Date.now()}-${index}-${Math.random().toString(36).substr(2,5)}`, customerId: cid, amount: Math.abs(originalAmt), date: d, method: 'HAVALE', eDocumentNo: 'DEVIR_ALACAK', status: 'CREATED', type: 'DEVIR_ALACAK', description: desc });
            } else {
              mappedSales.push({ invoiceId: `ADV-DEV-${Date.now()}-${index}-${Math.random().toString(36).substr(2,5)}`, customerId: cid, amount: Math.abs(originalAmt), invoiceDate: d, eDocumentNo: 'DEVIR_BORC', status: 'CREATED', type: 'DEVIR_BORC', description: desc });
            }
          } else if (res.type === 'DEVIR_ALACAK') {
            mappedCollections.push({ collectionId: `ADV-DEV-${Date.now()}-${index}-${Math.random().toString(36).substr(2,5)}`, customerId: cid, amount, date: d, method: 'HAVALE', eDocumentNo: 'DEVIR_ALACAK', status: 'CREATED', type: 'DEVIR_ALACAK', description: desc });
          } else if (res.type === 'VIRMAN_BORC' || res.type === 'VIRMAN') {
            const originalAmt = parseAmountHelper(res.amount);
            if (originalAmt < 0) {
              mappedCollections.push({ collectionId: `ADV-VIR-${Date.now()}-${index}-${Math.random().toString(36).substr(2,5)}`, customerId: cid, amount: Math.abs(originalAmt), date: d, method: 'HAVALE', eDocumentNo: 'VIRMAN_ALACAK', status: 'CREATED', type: 'VIRMAN_ALACAK', description: desc });
            } else {
              mappedSales.push({ invoiceId: `ADV-VIR-${Date.now()}-${index}-${Math.random().toString(36).substr(2,5)}`, customerId: cid, amount: Math.abs(originalAmt), invoiceDate: d, eDocumentNo: 'VIRMAN_BORC', status: 'CREATED', type: 'VIRMAN_BORC', description: desc });
            }
          } else if (res.type === 'VIRMAN_ALACAK') {
            mappedCollections.push({ collectionId: `ADV-VIR-${Date.now()}-${index}-${Math.random().toString(36).substr(2,5)}`, customerId: cid, amount, date: d, method: 'HAVALE', eDocumentNo: 'VIRMAN_ALACAK', status: 'CREATED', type: 'VIRMAN_ALACAK', description: desc });
          } else if (res.type === 'SATIS') {
            mappedSales.push({ invoiceId: `ADV-EXC-${Date.now()}-${index}-${Math.random().toString(36).substr(2,5)}`, customerId: cid, amount, invoiceDate: d, eDocumentNo: 'SATIS_FATURASI', status: 'CREATED', type: 'SATIS', description: desc });
          } else if (res.type === 'TAHSILAT') {
            mappedCollections.push({ collectionId: `ADV-EXC-${Date.now()}-${index}-${Math.random().toString(36).substr(2,5)}`, customerId: cid, amount, date: d, method: 'HAVALE', eDocumentNo: 'TAHSILAT', status: 'CREATED', type: 'TAHSILAT', description: desc });
          } else if (res.type === 'CEK' || res.type === 'ÇEK' || res.type === 'SENET') {
            const docType = (res.type === 'SENET' || String(res.type).toUpperCase().includes('SENET')) ? 'SENET' : 'ÇEK';
            mappedCheques.push({
              id: `ADV-EXC-${Date.now()}-${index}-${Math.random().toString(36).substr(2,5)}`,
              docNo: res.docNo || res.documentNo || `EVR-${Date.now()}-${index}`,
              customerId: cid,
              amount,
              issueDate: d,
              dueDate: res.dueDate ? safeIsoDate(res.dueDate)?.split('T')[0] : d,
              type: docType,
              bankName: res.bankName || res.bank || 'Portföy Çek/Senet',
              description: desc,
              status: 'PORTFOY'
            });
          } else if (res.type === 'IADE' || res.type === 'DEKONT') {
            mappedCreditNotes.push({ creditNoteId: `ADV-EXC-${Date.now()}-${index}-${Math.random().toString(36).substr(2,5)}`, customerId: cid, amount, date: d, documentNo: 'ALACAK_DEKONTU', status: 'CREATED', type: 'ALACAK_DEKONTU', description: desc });
          }
          successCount++;
        }
      }
    } catch (e) {
      errorCount++;
    }
  }
  
  const custGroups: Record<string, any[]> = {};
  const allItems = [
    ...mappedSales.map(s => ({ ...s, _kind: 'SATIS', _net: s.amount })),
    ...mappedCollections.map(c => ({ ...c, _kind: 'TAHSILAT', _net: -c.amount })),
    ...mappedCreditNotes.map(cn => ({ ...cn, _kind: 'IADE', _net: -cn.amount }))
  ];

  allItems.forEach(item => {
    if (!custGroups[item.customerId]) custGroups[item.customerId] = [];
    custGroups[item.customerId].push(item);
  });

  const finalSales: any[] = [];
  const finalCollections: any[] = [];
  const finalCreditNotes: any[] = [];

  Object.values(custGroups).forEach(group => {
    const positives = group.filter(x => x._net > 0);
    const negatives = group.filter(x => x._net < 0);

    const cancelledPos = new Set<number>();
    const cancelledNeg = new Set<number>();

    positives.forEach((pos, pIdx) => {
      negatives.forEach((neg, nIdx) => {
        if (!cancelledPos.has(pIdx) && !cancelledNeg.has(nIdx) && Math.abs(pos.amount - neg.amount) < 0.01) {
          cancelledPos.add(pIdx);
          cancelledNeg.add(nIdx);
        }
      });
    });

    group.forEach((item) => {
      const isPos = item._net > 0;
      const pIdx = positives.indexOf(item);
      const nIdx = negatives.indexOf(item);

      if (isPos && cancelledPos.has(pIdx)) return;
      if (!isPos && cancelledNeg.has(nIdx)) return;

      if (item._kind === 'SATIS') finalSales.push(item);
      else if (item._kind === 'TAHSILAT') finalCollections.push(item);
      else if (item._kind === 'IADE') finalCreditNotes.push(item);
    });
  });

  if (finalSales.length) {
    for (const r of finalSales) {
      const { error } = await supabase.from('invoices').insert({ customer_id: r.customerId, document_no: r.eDocumentNo, billing_date: r.invoiceDate, amount: r.amount, status: 'ACTIVE' });
      if (error) throw new Error('Fatura eklenemedi: ' + error.message);
    }
  }
  if (finalCollections.length) {
    for (const r of finalCollections) {
      const { error } = await supabase.from('temp_payment_signals').insert({ customer_id: r.customerId, amount: r.amount, payment_date: r.date, status: 'ACTIVE' });
      if (error) throw new Error('Tahsilat eklenemedi: ' + error.message);
    }
  }
  if (finalCreditNotes.length) {
    for (const r of finalCreditNotes) {
      const { error } = await supabase.from('credit_events').insert({ customer_id: r.customerId, amount: r.amount, event_type: 'RETURN', event_date: r.date });
      if (error) throw new Error('İade eklenemedi: ' + error.message);
    }
  }
  if (mappedCheques.length) {
    for (const r of mappedCheques) {
      const { error } = await supabase.from('cheques').insert({ id: r.id, customer_id: r.customerId, amount: r.amount, issue_date: r.issueDate, due_date: r.dueDate, doc_no: r.docNo, type: r.type, status: 'CREATED' });
      if (error) throw new Error('Çek eklenemedi: ' + error.message);
    }
  }
  
  const finalCount = finalSales.length + finalCollections.length + finalCreditNotes.length + mappedCheques.length;
  if (finalCount > 0) {
    await syncDataFromApi();
    await initFromArchive();
    invalidateCache();
  }
  
  return { 
    success: true, 
    processedRecords: finalCount, 
    addedRecords: finalCount,
    skippedCancelledPairs: successCount - finalCount,
    errors: errorCount, 
    message: finalCount > 0 ? `BAŞARILI: Veritabanına TAM ${finalCount} adet yeni kayıt başarıyla YAZILDI!` : 'Aktarılacak net kayıt bulunamadı (birbirini götüren virmanlar elendi).',
    debugGeneratedCode: args.jsFunctionBody 
  };
});

excelImportToolHandlers.set('readUploadedExcelData', (args: ReadUploadedExcelDataArgs) => {
  let rows = rawExcelCache.get(args.fileName as string);
  if (!rows || rows.length === 0) {
    const cachedKeys = Array.from(rawExcelCache.keys());
    if (cachedKeys.length > 0) {
      rows = rawExcelCache.get(cachedKeys[cachedKeys.length - 1]);
    }
  }
  if (!rows || rows.length === 0) return { error: 'Geçici bellekte okunacak Excel dosyası bulunamadı.' };

  const limit = args.limit || 50;
  return {
    success: true,
    totalRows: rows.length,
    returnedRows: Math.min(rows.length, limit),
    data: rows.slice(0, limit)
  };
});

export function getExcelImportToolHandler(toolName: string): ExcelImportToolHandler | undefined {
  return excelImportToolHandlers.get(toolName);
}
