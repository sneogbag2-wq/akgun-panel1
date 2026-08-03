import * as xlsx from 'xlsx';
import * as fs from 'fs';

const filePath = 'c:\\Users\\monds\\Desktop\\test\\VERİ\\Sellout Raporu (2).xlsx';
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet);

const products = new Map<string, string>();

for (const row of data as any[]) {
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
    if (name.includes('*6') || name.includes('* 6') || name.includes('*12') || name.includes('* 12') || name.includes('FIC') || name.includes('FIÇI') || name.toLowerCase().includes('fıçı')) {
        console.log(`${code} -> ${name}`);
    }
}

console.log("\nTotal Unique Products:", products.size);
