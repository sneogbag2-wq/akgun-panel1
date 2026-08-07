import { REQUIRED_HEADERS } from '../modules/customer-master/customerMasterContract.js';

const fields = Object.keys(REQUIRED_HEADERS);

export const anonymousHeaderMap = Object.freeze(Object.fromEntries(fields.map((field, index) => [field, String.fromCharCode(65 + index)])));

export function anonymousMasterRow({
  rowNumber = 2,
  customerCode = '5000000001',
  customerCodeType = 'string',
  customerName = 'Anonim Market',
  storeName = 'Anonim Tabela',
  salesRep = 'Anonim Temsilci',
  distSalesChief = 'Anonim SSM',
  channel = 'Standart Açık',
  segment = 'Diamond',
  customerStatus = 'Aktif',
} = {}) {
  const values = { customerCode, customerName, storeName, salesRep, distSalesChief, channel, segment, customerStatus };
  const rawCells = {};
  for (const field of fields) {
    const address = `${anonymousHeaderMap[field]}${rowNumber}`;
    rawCells[address] = Object.freeze({ address, columnIndex: anonymousHeaderMap[field], rawValue: values[field], displayValue: String(values[field] ?? ''), sourceType: field === 'customerCode' ? customerCodeType : 'string' });
  }
  return Object.freeze({ rawCells, rowNumber });
}
