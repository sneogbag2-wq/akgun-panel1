import { formatCurrency } from '../utils/formatters';

export interface CheckWarehouseStockArgs {
  productName: string;
}

export interface CheckCustomerCommercialStockArgs {
  customerId: string;
  productName?: string;
}

export async function handleCheckWarehouseStock(args: CheckWarehouseStockArgs): Promise<any> {
  // Gerçek senaryoda veritabanı veya Excel verisinden okunacaktır.
  const { productName } = args;
  const mockQuantity = Math.floor(Math.random() * 500) + 100; // 100-600 arası
  
  return {
    status: 'SUCCESS',
    stockType: 'WAREHOUSE_CURRENT',
    productName: productName || 'Belirtilmeyen Ürün',
    availableQuantity: mockQuantity,
    unit: 'Adet',
    location: 'Merkez Depo',
    note: 'Bu miktar satılabilir (rezerve edilmemiş) anlık fiziki depomuzdaki stoku ifade eder.'
  };
}

export async function handleCheckCustomerCommercialStock(args: CheckCustomerCommercialStockArgs): Promise<any> {
  // Müşterideki emanet/konsinye (ticari) stok sorgusu
  const { customerId, productName } = args;
  const mockQuantity = Math.floor(Math.random() * 50) + 10;
  const mockValue = mockQuantity * 1500; 
  
  return {
    status: 'SUCCESS',
    stockType: 'CUSTOMER_COMMERCIAL',
    customerId,
    productName: productName || 'Tüm Emanet Ürünler',
    consignmentQuantity: mockQuantity,
    unit: 'Adet',
    estimatedValue: formatCurrency(mockValue),
    note: 'Bu miktar fiziki depomuzdan çıkmış, müşterinin mülkiyetinde / sorumluluğunda olan ticari stoku ifade eder.'
  };
}
