// src/services/customerService/calculations.ts
import { formatCurrency, formatPercent } from './formatters';

export function calculateAverageTerm(invoices: any[], collections: any[]): number {
  if (!invoices.length) return 0;
  const totalSales = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  if (totalSales <= 0) return 0;
  const totalCollections = collections.reduce((sum, col) => sum + (col.amount || 0), 0);
  return Math.max(0, Math.round((totalSales - totalCollections) / (totalSales / 30)));
}

export function calculateRiskScore(balance: number, overdueAmount: number, maxCreditLimit: number): { score: number; level: string } {
  if (maxCreditLimit <= 0) return { score: 50, level: 'ORTA' };
  const utilization = (balance / maxCreditLimit) * 100;
  const overdueRatio = balance > 0 ? (overdueAmount / balance) * 100 : 0;
  
  const score = Math.min(100, Math.round(utilization * 0.5 + overdueRatio * 0.5));
  let level = 'DÜŞÜK';
  if (score > 75) level = 'YÜKSEK';
  else if (score > 40) level = 'ORTA';
  
  return { score, level };
}
