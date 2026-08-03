const xlsx = require('xlsx');
const fs = require('fs');

const filePath = 'c:\\Users\\monds\\Desktop\\test\\VERİ\\Sellout Raporu (2).xlsx';
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet);

const products = new Map();

for (const row of data) {
    const code = row['Malzeme Kodu'];
    const name = row['Malzeme Tnm.'] || row['Malzeme Tanımı'] || '';
    if (code) {
        products.set(String(code), String(name));
    }
}

console.log("Analyzing Products...");
console.log("Looking for 152101:");
console.log("152101:", products.get("152101") || "Not found");

console.log("\nLooking for *6 and *12 products:");
for (const [code, name] of products.entries()) {
    const lname = name.toLowerCase();
    if (lname.includes('*6') || lname.includes('* 6') || lname.includes('*12') || lname.includes('* 12') || lname.includes('fic') || lname.includes('fıçı') || lname.includes('kutu')) {
        console.log(`${code} -> ${name}`);
    }
}

console.log("\nTotal Unique Products:", products.size);
