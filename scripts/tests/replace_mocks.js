const fs = require('fs');
const path = require('path');

const replacements = [
  { search: /mockCustomers/g, replace: 'customers' },
  { search: /mockSalesInvoices/g, replace: 'salesInvoices' },
  { search: /mockCollections/g, replace: 'collections' },
  { search: /mockCreditNotes/g, replace: 'creditNotes' },
  { search: /mockPurchaseInvoices/g, replace: 'purchaseInvoices' },
  { search: /mockCheques/g, replace: 'cheques' },
  { search: /mockShipmentBelgeler/g, replace: 'shipmentBelgeler' },
  { search: /mockShipmentSiparisler/g, replace: 'shipmentSiparisler' },
  { search: /mockSelloutRecords/g, replace: 'selloutRecords' },
];

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      for (const req of replacements) {
        if (content.match(req.search)) {
          content = content.replace(req.search, req.replace);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory('panel/src');
console.log('Done.');
