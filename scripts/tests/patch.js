const fs = require('fs');
const path = 'panel/src/services/customerService.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Change archiveService to supabaseArchiveService
content = content.replace(/\} from '\.\/archiveService';/, "} from './supabaseArchiveService';\nimport { syncDataFromApi } from './apiSyncService';");

// 2. Export notifyListeners
content = content.replace(/function notifyListeners\(\) \{/, 'export function notifyListeners() {');

// 3. Add syncDataFromApi call in saveUploadedData
content = content.replace(
  'const matchResult = await autoMatchAndClearChequesAndSenets();\n  invalidateCache();',
  'const matchResult = await autoMatchAndClearChequesAndSenets();\n  try { await syncDataFromApi(); } catch(e) { console.error(\'Error syncing data after upload:\', e); }\n  invalidateCache();'
);

// 4. Append customerState
if (!content.includes('export const customerState =')) {
  content += '\n\nexport const customerState = { get customers() { return mockCustomers; }, get salesInvoices() { return mockSalesInvoices; }, get collections() { return mockCollections; }, get cheques() { return mockCheques; }, get selloutRecords() { return mockSelloutRecords; }, set customers(v){mockCustomers=v}, set salesInvoices(v){mockSalesInvoices=v}, set collections(v){mockCollections=v}, set cheques(v){mockCheques=v}, set selloutRecords(v){mockSelloutRecords=v} };\n';
}

fs.writeFileSync(path, content, 'utf8');
console.log('Patch applied successfully.');
