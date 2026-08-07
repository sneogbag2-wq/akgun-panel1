/** Portfolio, representative, cheque, and risk reporting handlers. */
import {
  calculateCustomerDebtToCollectionRiskSync,
  getAllCustomersForReportingSync,
  getCustomerChequesSync,
  getDeepExecutiveAnalyticsOverviewSync,
  getTopCustomersBySalesVolumeSync,
  searchCustomersSync,
  executeDynamicAnalyticsQuerySync
} from './customerService';
import { formatCurrency, formatDate } from '../utils/formatters';
import type { AiToolArgs, AiToolHandler } from './aiReadToolRegistry';

function getString(args: AiToolArgs, key: string, fallback = ''): string {
  const value = args[key];
  return typeof value === 'string' ? value : fallback;
}

function getNumber(args: AiToolArgs, key: string, fallback: number): number {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const handlers: Record<string, AiToolHandler> = {
  getSalesRepSummary: () => {
    const repsByName: Record<string, { salesRep: string; customerCount: number; totalBalance: number }> = {};
    for (const customer of getAllCustomersForReportingSync()) {
      const salesRep = customer.salesRep || 'Temsilci Belirtilmemiş';
      repsByName[salesRep] ||= { salesRep, customerCount: 0, totalBalance: 0 };
      repsByName[salesRep].customerCount++;
      repsByName[salesRep].totalBalance += customer.balance || 0;
    }

    return {
      salesReps: Object.values(repsByName)
        .sort((left, right) => right.totalBalance - left.totalBalance)
        .map((rep) => ({
          salesRep: rep.salesRep,
          customerCount: rep.customerCount,
          totalBalance: formatCurrency(rep.totalBalance),
          rawBalance: rep.totalBalance
        }))
    };
  },

  getTopDebtors: (args) => {
    const topCustomers = getAllCustomersForReportingSync()
      .filter((customer) => (customer.balance || 0) > 0)
      .sort((left, right) => (right.balance || 0) - (left.balance || 0))
      .slice(0, getNumber(args, 'limit', 10));

    return {
      count: topCustomers.length,
      criteria: 'Borç Bazlı (Açık Pozitif Cari Bakiye)',
      debtors: topCustomers.map((customer, index) => ({
        rank: index + 1,
        customerId: customer.customerId,
        customerName: customer.customerName || customer.signName,
        signName: customer.signName || customer.customerName,
        salesRep: customer.salesRepName || customer.salesRep || 'Key Account',
        balance: formatCurrency(customer.balance),
        cekSenet: customer.cekSenet ? formatCurrency(customer.cekSenet) : '₺0,00',
        toplamRisk: formatCurrency(customer.toplamRisk || customer.balance),
        rawBalance: customer.balance
      }))
    };
  },

  getTopCustomersBySalesVolume: (args) => {
    const customers = getTopCustomersBySalesVolumeSync(args);
    return {
      count: customers.length,
      criteria: 'Ciro Bazlı (Satış Hacmi / SATIS Faturaları)',
      periodLabel: customers[0]?.periodLabel || 'Tüm Zamanlar Kümülatif',
      note: 'Bakiyesi alacaklı/sıfır olan yüksek cirolu müşteriler de dahildir.',
      customers
    };
  },

  getCustomerCheques: (args) => {
    let customerId = getString(args, 'customerId');
    const query = getString(args, 'query');
    if (!customerId && query) customerId = searchCustomersSync(query, true)[0]?.customerId || '';

    const cheques = getCustomerChequesSync(customerId || undefined);
    const totalRisk = cheques.reduce((sum: number, cheque: any) => sum + (cheque.amount || 0), 0);
    return {
      count: cheques.length,
      totalChequeRisk: formatCurrency(totalRisk),
      rawTotalRisk: totalRisk,
      cheques: cheques.map((cheque: any) => ({
        id: cheque.id,
        docNo: cheque.docNo,
        subNo: cheque.subNo,
        customerId: cheque.customerId,
        customerName: cheque.customerName,
        type: cheque.type,
        issueDate: formatDate(cheque.issueDate),
        dueDate: formatDate(cheque.dueDate),
        amount: formatCurrency(cheque.amount),
        rawAmount: cheque.amount,
        bankName: cheque.bankName || cheque.description || '-',
        status: cheque.status
      }))
    };
  },

  calculateCustomerDebtToCollectionRisk: (args) => {
    const query = getString(args, 'query').trim();
    if (query) {
      const customer = searchCustomersSync(query, true)[0];
      if (customer) {
        const risk = calculateCustomerDebtToCollectionRiskSync(customer);
        return {
          customerName: customer.signName || customer.customerName,
          balance: formatCurrency(risk.balance),
          monthlyAvgCollection: formatCurrency(risk.monthlyAvgCollection),
          coverageMonths: `${risk.coverageMonths} Ay`,
          coverageDays: `${risk.coverageDays} Gün`,
          riskLevel: risk.riskLevel,
          riskLabel: risk.riskLabel,
          actionAdvice: risk.actionAdvice
        };
      }
    }

    const overview = getDeepExecutiveAnalyticsOverviewSync();
    return {
      title: 'Genel Şirket Borç/Tahsilat Risk Özeti',
      risky30kGroup: overview.risky30kGroup,
      over60DaysOverdue: overview.over60DaysOverdue
    };
  },

  getDeepExecutiveAnalyticsOverview: () => getDeepExecutiveAnalyticsOverviewSync(),

  executeDynamicAnalyticsQuery: (args) => {
    return executeDynamicAnalyticsQuerySync(args || {});
  }
};

export function getAnalyticsReadToolHandler(toolName: string): AiToolHandler | undefined {
  return handlers[toolName];
}

export function getRegisteredAnalyticsReadToolNames(): string[] {
  return Object.keys(handlers);
}
