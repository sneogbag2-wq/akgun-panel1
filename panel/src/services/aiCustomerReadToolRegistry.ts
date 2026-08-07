/** Customer and shipment reporting handlers kept out of the central dispatcher. */
import {
  getCustomerById,
  getCustomerStatement,
  getShipmentTrackingDataSync,
  searchCustomersSync,
  getGlobalHighestTransactionsSync,
  getAllCustomersForReportingSync,
  getInvoiceControlReportSync
} from './customerService';
import { formatCurrency, formatDate } from '../utils/formatters';
import type { AiToolArgs, AiToolHandler } from './aiReadToolRegistry';

function getString(args: AiToolArgs, key: string, fallback = ''): string {
  const value = args[key];
  return typeof value === 'string' ? value : fallback;
}

const handlers: Record<string, AiToolHandler> = {
  getShipmentTrackingReport: (args) => {
    const data = getShipmentTrackingDataSync(getString(args, 'date', new Date().toISOString().slice(0, 10)));
    let customers = data.customers || [];
    const salesRep = getString(args, 'salesRep');
    const query = getString(args, 'query');

    if (salesRep) {
      const normalizedRep = salesRep.toLowerCase().trim();
      customers = customers.filter((customer: any) => String(customer.salesRepName || '').toLowerCase().includes(normalizedRep));
    }
    if (query) {
      const normalizedQuery = query.toLowerCase().trim();
      customers = customers.filter((customer: any) =>
        String(customer.customerName || '').toLowerCase().includes(normalizedQuery) ||
        String(customer.customerId || '').toLowerCase().includes(normalizedQuery)
      );
    }

    return {
      stats: data.stats,
      customerCount: customers.length,
      topCustomers: customers.slice(0, 20).map((customer: any) => ({
        customerId: customer.customerId,
        customerName: customer.customerName,
        salesRepName: customer.salesRepName,
        siparisTotal: customer.invoiceTotal,
        emanetTotal: customer.emanetTotal,
        tahsilatTotal: customer.collectionTotal,
        balance: customer.balance,
        averageVade: customer.averageVade
      }))
    };
  },

  searchCustomers: (args) => {
    const results = searchCustomersSync(getString(args, 'query'), true);
    return {
      count: results.length,
      customers: results.slice(0, 15).map((customer: any) => ({
        customerId: customer.customerId,
        customerName: customer.customerName,
        signName: customer.signName,
        salesRep: customer.salesRep,
        cityDistrict: `${customer.province || ''}/${customer.district || ''}`,
        balance: formatCurrency(customer.balance || 0),
        rawBalance: customer.balance || 0,
        pendingOrderTotal: formatCurrency(customer.invoiceTotal || 0),
        consignmentOrderTotal: formatCurrency(customer.emanetTotal || 0)
      }))
    };
  },

  getCustomerDetails: async (args) => {
    const customerId = getString(args, 'customerId');
    const customer = await getCustomerById(customerId, true);
    if (!customer) return { error: `Müşteri bulunamadı: ${customerId}` };

    const mapsQuery = encodeURIComponent(`${customer.signName || customer.customerName} ${customer.district || ''} ${customer.province || ''}`);
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
    return {
      customerId: customer.customerId,
      customerName: customer.customerName,
      signName: customer.signName,
      salesRep: customer.salesRep,
      phone: customer.phone || 'Belirtilmedi',
      cityDistrict: `${customer.province || ''}/${customer.district || ''}`,
      googleMapsUrl,
      googleMapsLinkMarkdown: `[🗺️ Google Haritalar Konumunda Aç](${googleMapsUrl})`,
      status: customer.customerStatus,
      balance: formatCurrency(customer.balance || 0),
      rawBalance: customer.balance || 0,
      pendingOrderTotal: formatCurrency(customer.invoiceTotal || 0),
      consignmentOrderTotal: formatCurrency(customer.emanetTotal || 0)
    };
  },

  getCustomerStatement: async (args) => {
    const customerId = getString(args, 'customerId');
    const statement = await getCustomerStatement(customerId);
    if (!statement || !statement.customer) {
      return { error: `Müşteri bulunamadı veya işlem geçmişi yok: ${customerId}` };
    }

    return {
      customer: {
        customerId: statement.customer.customerId,
        name: statement.customer.customerName,
        signName: statement.customer.signName,
        balance: formatCurrency(statement.customer.balance || 0),
        pendingOrderTotal: formatCurrency(statement.customer.invoiceTotal || 0),
        consignmentOrderTotal: formatCurrency(statement.customer.emanetTotal || 0)
      },
      summary: {
        totalSales: formatCurrency(statement.summary.totalSales),
        totalCollections: formatCurrency(statement.summary.totalCollections),
        totalCreditNotes: formatCurrency(statement.summary.totalCreditNotes)
      },
      aging: {
        current: formatCurrency(statement.aging.current),
        days30: formatCurrency(statement.aging.days30),
        days60: formatCurrency(statement.aging.days60),
        days90Plus: formatCurrency(statement.aging.days90 + statement.aging.over90),
        averageVade: statement.aging.averageVade ? `${statement.aging.averageVade} gün` : 'Vade aşımı yok'
      },
      openInvoiceCount: (statement.openInvoices || []).length,
      totalOpenAmount: formatCurrency((statement.openInvoices || []).reduce((sum: number, invoice: any) => sum + invoice.openAmount, 0)),
      openInvoices: (statement.openInvoices || []).map((invoice: any) => ({
        invoiceDate: formatDate(invoice.invoiceDate),
        eDocumentNo: invoice.eDocumentNo,
        originalAmount: formatCurrency(invoice.originalAmount),
        openAmount: formatCurrency(invoice.openAmount),
        daysOverdue: `${invoice.daysOverdue} gün`,
        isPartial: invoice.isPartial
      })),
      recentTransactions: (statement.transactions || []).slice(-10).map((transaction: any) => ({
        rawDate: typeof transaction.date === 'string' ? transaction.date.slice(0, 10) : transaction.date,
        date: formatDate(transaction.date),
        docNo: transaction.docNo,
        type: transaction.type,
        amount: formatCurrency(transaction.credit || transaction.debit),
        runningBalance: formatCurrency(transaction.balance || 0)
      })),
      exportButtonsMarkdown: `\n\n### 📥 Kurumsal Çıktı & Döküm İşlemleri\n[🖨️ PDF / A4 Yazdır](https://action-pdf-${statement.customer.customerId}) [📊 Excel İndir (.xlsx)](https://action-excel-${statement.customer.customerId}) [🏢 Ekstre Modalı Aç](https://action-modal-${statement.customer.customerId})\n`
    };
  },

  queryTransactions: async (args: AiToolArgs) => {
    const query = getString(args, 'query').trim();
    const transactionType = getString(args, 'transactionType', 'ALL').toUpperCase();
    const sortBy = getString(args, 'sortBy', 'LATEST').toUpperCase();
    let limitValue = args['limit'];
    const limit = typeof limitValue === 'number' ? limitValue : (parseInt(String(limitValue)) || 10);

    if (!query && sortBy === 'HIGHEST_AMOUNT') {
      const targetType = (transactionType === 'SATIS' || transactionType === 'SALE' || transactionType === 'FATURA') ? 'SATIS' : 'TAHSILAT';
      const globalHighest = getGlobalHighestTransactionsSync({ type: targetType, limit });
      const top = globalHighest[0] || null;

      return {
        searchType: 'GLOBAL_TOP_TRANSACTIONS',
        transactionType: targetType,
        totalCount: globalHighest.length,
        highestRecord: top,
        summary: top
          ? `Tüm veritabanı genelinde en yüksek ${targetType} işlemi: ${top.formattedAmount} (Müşteri: ${top.customerName}, Tarih: ${top.formattedDate})`
          : 'Kayıt bulunamadı',
        transactions: globalHighest.map((t: any) => ({
          rank: t.rank,
          customerName: t.customerName,
          signName: t.signName,
          salesRep: t.salesRep,
          amount: t.formattedAmount,
          rawAmount: t.amount,
          date: t.formattedDate,
          methodOrDocNo: t.method || t.eDocumentNo || '-'
        }))
      };
    }

    let matchedCustomers: any[] = [];
    if (query) {
      const cleanedQuery = query
        .replace(/\b(\d{1,2})\s+([a-zA-ZğüşıöçĞÜŞİÖÇ]+)(?:\s+(\d{4}))?\b/gi, '')
        .replace(/\b\d{4}[-/. ]\d{1,2}[-/. ]\d{1,2}\b/g, '')
        .replace(/(faturası|fatura|tarihli|tahsilatı|tahsilat|ödemesi|ödeme|dekontu|ekstresi|son|geçmiş|açık)/gi, '')
        .trim();

      const searchQuery = cleanedQuery.length >= 2 ? cleanedQuery : query;
      matchedCustomers = searchCustomersSync(searchQuery, true);
      if (matchedCustomers.length === 0 && searchQuery !== query) {
        matchedCustomers = searchCustomersSync(query, true);
      }
      if (matchedCustomers.length === 0) {
        const all = getAllCustomersForReportingSync();
        const qLower = searchQuery.toLowerCase();
        matchedCustomers = all.filter((c: any) =>
          c.customerId.includes(qLower) ||
          (c.customerName || '').toLowerCase().includes(qLower) ||
          (c.signName || '').toLowerCase().includes(qLower) ||
          (c.salesRep || '').toLowerCase().includes(qLower)
        );

        if (matchedCustomers.length === 0) {
          const tokens = searchQuery.split(/\s+/).filter((t: string) => t.length >= 3 && !['shop', 'ltd', 'şti', 'gıda', 'ticaret', 'market', 'büfe'].includes(t));
          for (const token of tokens) {
            const tokenMatches = all.filter((c: any) =>
              (c.customerName || '').toLowerCase().includes(token) ||
              (c.signName || '').toLowerCase().includes(token)
            );
            if (tokenMatches.length > 0) {
              matchedCustomers = tokenMatches;
              break;
            }
          }
        }
      }
    }

    if (matchedCustomers.length === 0) {
      return {
        status: 'CUSTOMER_NOT_FOUND',
        searchedQuery: query,
        message: `Veritabanı arşivinde "${query}" aramasına uygun bir müşteri kaydı bulunamadı.`,
        instruction: 'Kullanıcıya bu isimde bir müşteri bulunamadığını söyle. SAKIN getGlobalHighestTransactions ÇAĞIRMA veya şirket rekorlarını sunma!'
      };
    }

    const results: any[] = [];

    for (const cust of matchedCustomers.slice(0, 5)) {
      const stmt = await getCustomerStatement(cust.customerId);
      if (!stmt) continue;

      if (transactionType === 'ACIK_FATURA' || transactionType === 'OPEN_INVOICE') {
        const openInvoices = stmt.openInvoices || [];
        results.push({
          customer: {
            customerId: cust.customerId,
            customerName: cust.customerName,
            signName: cust.signName,
            balance: formatCurrency(cust.balance || 0),
            rawBalance: cust.balance || 0
          },
          averageVade: stmt.aging?.averageVade ? `${stmt.aging.averageVade} gün` : 'Vade aşımı yok (Bakiye ≤ 0)',
          openInvoiceCount: openInvoices.length,
          totalOpenAmount: formatCurrency(openInvoices.reduce((sum: number, i: any) => sum + i.openAmount, 0)),
          openInvoices: openInvoices.map((inv: any) => ({
            invoiceDate: formatDate(inv.invoiceDate),
            eDocumentNo: inv.eDocumentNo,
            originalAmount: formatCurrency(inv.originalAmount),
            openAmount: formatCurrency(inv.openAmount),
            daysOverdue: `${inv.daysOverdue} gün`,
            isPartial: inv.isPartial
          }))
        });
        continue;
      }

      if (!stmt.transactions) continue;
      let txs = [...stmt.transactions];

      if (transactionType === 'TAHSILAT' || transactionType === 'COLLECTION') {
        txs = txs.filter(t => (t.type || '').includes('TAHSİLAT'));
      } else if (transactionType === 'SATIS' || transactionType === 'SALE') {
        txs = txs.filter(t => (t.type || '') === 'SATIŞ');
      } else if (transactionType === 'DEKONT' || transactionType === 'CREDIT_NOTE') {
        txs = txs.filter(t => (t.type || '').includes('ALACAK DEKONTU'));
      }

      const dateMatch = query.match(/\b(\d{1,2})\s+([a-zA-ZğüşıöçĞÜŞİÖÇ]+)(?:\s+(\d{4}))?\b/i);
      if (dateMatch) {
        const day = parseInt(dateMatch[1], 10);
        const monthNames = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
        const mIdx = monthNames.indexOf(dateMatch[2].toLowerCase());
        if (day && mIdx !== -1) {
          const padDay = String(day).padStart(2, '0');
          const padMonth = String(mIdx + 1).padStart(2, '0');
          const targetPattern = `-${padMonth}-${padDay}`;
          const dateFiltered = txs.filter(t => String(t.date).includes(targetPattern));
          
          if (dateFiltered.length === 0) {
            const targetDateFormatted = `2026-${padMonth}-${padDay}`;
            const ctrlReport = getInvoiceControlReportSync({ date: targetDateFormatted, query: cust.customerName || cust.signName });
            const matchedInReport = (ctrlReport.customers || []).find((c: any) =>
              c.customerId === cust.customerId ||
              (c.customerName || '').toLowerCase().includes((cust.customerName || '').toLowerCase()) ||
              (c.signName || '').toLowerCase().includes((cust.signName || '').toLowerCase())
            );

            if (matchedInReport && (matchedInReport.invoiceTotal > 0 || matchedInReport.collectionTotal > 0)) {
              txs = [{
                date: targetDateFormatted,
                type: matchedInReport.invoiceTotal > 0 ? 'SATIŞ' : 'TAHSİLAT',
                docNo: 'FATURA_KONTROL',
                debit: matchedInReport.invoiceTotal || 0,
                credit: matchedInReport.collectionTotal || 0,
                description: `Fatura Kontrol Kaydı (${targetDateFormatted}) - Fatura: ${formatCurrency(matchedInReport.invoiceTotal || 0)}, Tahsilat: ${formatCurrency(matchedInReport.collectionTotal || 0)}`
              }];
            } else {
              results.push({
                customer: {
                  customerId: cust.customerId,
                  customerName: cust.customerName,
                  signName: cust.signName,
                  balance: formatCurrency(cust.balance || 0)
                },
                requestedDate: dateMatch[0],
                transactionCount: 0,
                message: `"${cust.signName || cust.customerName}" için ${dateMatch[0]} tarihinde herhangi bir işlem kaydı bulunamadı.`,
                instruction: 'Kullanıcıya bu müşterinin belirtilen tarihte faturası olmadığını net olarak söyle. SAKIN başka müşterinin veya şirket rekorlarının faturalarını gösterme!'
              });
              continue;
            }
          } else {
            txs = dateFiltered;
          }
        }
      }

      if (sortBy === 'LATEST') {
        txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      } else if (sortBy === 'OLDEST') {
        txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      } else if (sortBy === 'HIGHEST_AMOUNT') {
        txs.sort((a, b) => (b.credit || b.debit) - (a.credit || a.debit));
      }

      const slicedTxs = txs.slice(0, limit).map(t => ({
        date: formatDate(t.date),
        rawDate: t.date,
        type: t.type,
        docNo: t.docNo,
        amount: formatCurrency(t.credit || t.debit),
        rawAmount: t.credit || t.debit,
        description: t.description
      }));

      results.push({
        customer: {
          customerId: cust.customerId,
          customerName: cust.customerName,
          signName: cust.signName,
          balance: formatCurrency(cust.balance || 0)
        },
        averageVade: stmt.aging?.averageVade ? `${stmt.aging.averageVade} gün` : 'Vade aşımı yok',
        transactionCount: txs.length,
        transactions: slicedTxs
      });
    }

    return {
      matchedCustomerCount: matchedCustomers.length,
      query: query,
      results
    };
  }
};

export function getCustomerReadToolHandler(toolName: string): AiToolHandler | undefined {
  return handlers[toolName];
}

export function getRegisteredCustomerReadToolNames(): string[] {
  return Object.keys(handlers);
}
