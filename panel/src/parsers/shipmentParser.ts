// src/parsers/shipmentParser.ts
import { safeIsoDate } from '../utils/dateUtils';

export interface ParsedShipmentLitre {
  id: string; // Yükleme Kodu + Sipariş Kodu + Müşteri
  customerId: string;
  orderCode: string;
  loadCode: string;
  date: string;
  totalLiters: number;
  totalQuantity: number;
}

export interface ParsedShipmentLitreResult {
  records: ParsedShipmentLitre[];
  stats: {
    loadedRows: number;
    groupedShipments: number;
  };
}

export function parseShipmentLitre(rows: any[]): ParsedShipmentLitreResult {
  if (!rows || rows.length === 0) return { records: [], stats: { loadedRows: 0, groupedShipments: 0 } };
  
  // Group by customer and order to avoid too many small rows, 
  // or just return raw lines. Since a shipment has many products, 
  // it's better to group them by Customer and Order Code.
  
  const grouped = new Map<string, ParsedShipmentLitre>();
  
  for (const r of rows) {
    const custIdRaw = r['Müşteri Numarası'] || r['Müşteri No'];
    if (!custIdRaw) continue;
    
    const customerId = String(custIdRaw).trim();
    const orderCode = String(r['Sipariş Kodu'] || '').trim();
    const loadCode = String(r['Yükleme Kodu'] || '').trim();
    const dateStr = safeIsoDate(r['Yükleme Tarihi']);
    const liters = parseFloat(String(r['Litre Total'] || 0).replace(',', '.')) || 0;
    const quantity = parseFloat(String(r['Miktar Total'] || 0).replace(',', '.')) || 0;
    
    // Create a unique key for the shipment group (Customer + Order + Date)
    const key = `${customerId}_${orderCode}_${dateStr}`;
    
    if (grouped.has(key)) {
      const existing = grouped.get(key)!;
      existing.totalLiters += liters;
      existing.totalQuantity += quantity;
    } else {
      grouped.set(key, {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${key}`,
        customerId,
        orderCode,
        loadCode,
        date: dateStr || '',
        totalLiters: liters,
        totalQuantity: quantity
      });
    }
  }
  
  const records = Array.from(grouped.values());
  return {
    records,
    stats: {
      loadedRows: rows.length,
      groupedShipments: records.length,
    }
  };
}
