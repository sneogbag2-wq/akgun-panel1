const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, '..', 'VERİ', 'Sellout Raporu (2).xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });

const products = new Map();

for (const row of data) {
    const code = String(row['Malzeme Kodu'] || '').trim();
    const name = String(row['Malzeme Tnm.'] || '').trim();
    if (code && name && !products.has(code)) {
        products.set(code, name);
    }
}

console.log(`\nFound ${products.size} unique products.\n`);
console.log('--- Products containing *6, *12, *24, *5 ---');

for (const [code, name] of products.entries()) {
    if (name.match(/\*[0-9]+/) || name.match(/X[0-9]+/i) || name.includes('*') || name.includes('FIC') || name.toLowerCase().includes('fıçı') || name.toLowerCase().includes('fici')) {
        console.log(`${code} -> ${name}`);
    }
}

// Write all products
fs.writeFileSync(path.join(__dirname, 'sellout_products.json'), JSON.stringify(Object.fromEntries(products), null, 2));
console.log('\nSaved all products to sellout_products.json');
