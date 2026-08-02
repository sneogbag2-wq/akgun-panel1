---
globs: ["panel/src/parsers/**/*.js"]
---

# Parser Coding Rules

## Mandatory in every parser
1. Use `parseAmount()` for all numeric values — never `parseFloat()` directly
2. Use `filterCancelledPairs()` for two-pass CANCELLED removal
3. Group rows by document ID using a `Map` — never `push()` per row
4. Use the fixed column mappings from `columnMappings.js` — no fuzzy matching
5. Column names with Turkish characters must be exact (e.g., `Cari Kodu 2` vs `Cari Kodu2`)

## File Type Routing
- Sales: `Cari Kodu 2` (with space), excludes EFES rows
- Purchase: `Cari Kodu2` (no space), splits into purchase_invoices + customer_credit_notes
- Collections: `Cari Kodu 2`, method derived from Banka Kodu / Kasa Kodu
- Customer Master: `Müşteri`, phone validation `^5\d{9}$`
