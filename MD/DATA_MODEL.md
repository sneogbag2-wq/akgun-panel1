# Data Model

> Status: Stage 1 analysis complete. This model was derived by inspecting the real
> uploaded Excel files.
>
> **Language note:** this document is in English, but **Excel column names and enum values
> are quoted verbatim in Turkish** (`Cari Kodu 2`, `Fatura Durum`, `NAKİT`, `CREATED`, …).
> Never translate them — parsers match these strings exactly (Decision #10).

---

## Files Analysed (Stage 1)

| # | File | Rows | Cols | Date range | Represents |
|---|---|---|---|---|---|
| 1 | Transfer collections (Havale Tahsilat) | 1,506 | 27 | 2025-08-12 → 2026-07-18 | Collections received by bank transfer |
| 2 | Cash collections (Nakit Tahsilat) | 24,493 | 27 | 2025-08-13 → 2026-07-29 | Collections received in cash / by card |
| 3 | Purchases (Satın Alma) | 8,914 | 21 | 2025-04-06 → 2026-07-29 | Purchases from suppliers + returns |
| 4 | Sales (Satış) | 29,174 | 34 | 2025-08-13 → 2026-07-29 | Sales invoices issued to customers + returns |

All files contain a single sheet (`ExportData`) — these are standard export reports from an
ERP/accounting system.

**Critical observation:** the sales and purchase files are **invoice-header level** records —
there is no product/line-item/quantity/brand information. So these four files are:
- sufficient to compute customer balances (debt from sales − credit from collections)
- **not** sufficient for stock or product-level analysis. The stock module will need a
  separate source (a stock-movement or product-level sales report). Still an open question.

---

## CORE PRINCIPLE #1 — "Derive From Master" (Decision #8)

**This rule applies to every transaction file uploaded and every report written.**

Transaction collections (`sales_invoices`, `purchase_invoices`, `collections`,
`customer_credit_notes`, and any collection added later) store **no descriptive customer
fields** — no customer name, sales-rep name, phone, province, district or sales channel.
They carry only `customerId` (= `Cari Kodu 2`, the `5000XXXXXX` code) as a **foreign key**.

Whenever descriptive data is needed — on screen, in a report, or in an AI assistant answer —
it is read from `customers` via a standard foreign-key join. It is never duplicated into the
transaction record.

**The master file's real role (user clarification):** the Customer Master file is **not** a
live external dependency that reports re-read every time. Its function is:

> **Customer Master = the source for customer creation and update (upsert/sync).**
> When this file is processed, records in `customers` are either **created** (a new
> `customerId` document) or **updated** (fields overwritten on an existing document).
> After that, `customers` is a **standalone, persistent source of truth** — the master file
> itself is never read again.

The flow: master file uploaded → `customers` documents created/updated → from then on, any
transaction file's `Cari Kodu 2` matches an existing `customerId`. As long as that match
holds, everything works; reports read descriptive data from `customers` via a normal join.

**Practical consequences:**
- Master upload uses **upsert** semantics: create if the `customerId` is absent, update if present.
- **Unmatched customer rule (user decision):** if a transaction file's `Cari Kodu 2` has no
  counterpart in `customers`, the system does **not** silently reject or skip the row — it
  shows an explicit warning meaning *"this customer code was not found in Customer Master;
  please update and re-upload the Master file."* Completing customer data from a transaction
  file, or auto-creating a default customer, is **never** done.

**Rationale:** normalisation + a single source of truth. Because `customers` is standalone
and persistent, queries stay fast and simple; the master file is only the feed/sync
mechanism, not a live dependency.

---

## CORE PRINCIPLE #2 — CANCELLED Records Are Excluded **In Pairs** (Decision #11)

**This applies to every file type that has a `Kayıt Tipi` / `Fatura Durum` field.**

When a CANCELLED record is found, not only that row but **its CREATED/normal twin sharing
the same document number** (`Fatura No` / `Belge Numarası`) is removed entirely. In the raw
data a cancellation always exists as **two** rows (original + cancellation) carrying the same
amount. Skipping only the CANCELLED row leaves the CREATED row looking valid, and the
cancelled amount leaks into the balance/statement.

**Verified with a real example:** in the transfer-collection file, document `72651490`,
amount `72,651,490 ₺` — present as both `CREATED` and `CANCELLED`. The old (incorrect) code
skipped only the CANCELLED row, so the CREATED row kept appearing in the statement.

**Implementation rule (two-pass, for every file type):**
```
1. Scan the entire file; collect the document numbers of all CANCELLED rows into a Set.
2. Remove EVERY row whose document number is in that Set — the CANCELLED row AND its
   matching CREATED/normal twin.
3. Process the remaining rows normally (balance, statement, reports).
```

**Scope — which field in which file:**
| File | Document-no field | Status field |
|---|---|---|
| Sales | `Fatura No` | `Fatura Durum` |
| Purchase | `Fatura No` | `Fatura Durum` |
| Cash collection | `Belge Numarası` | `Kayıt Tipi` |
| Transfer collection | `Belge Numarası` | `Kayıt Tipi` |

**Architectural consequence:** a shared helper in the `calculations/` layer (e.g.
`getCancelledDocSet(rows, docField)`) is called before each file is processed and returns the
Set of cancelled document numbers; row-level processing cross-checks against that Set. A
simple single-row `if (status === "CANCELLED") continue;` filter is considered
**insufficient and incorrect**, and code review will look for and fix that pattern.

**Real-file verification (2026-07-30):** earlier sample slices contained no CREATED twins, so
this rule's practical effect was unverified. On the **full files** the twins do exist:

| File | Rows | Cancelled docs | Rows removed | Remaining |
|---|---|---|---|---|
| Cash collections | 24,493 | 34 | 58 | 24,435 |
| Transfer collections | 1,506 | 46 | 84 | 1,422 |

Removed rows are roughly twice the cancelled-document count, confirming that each cancelled
document really does have a CREATED twin. With a naive single-row filter, 24 cancelled rows
(cash) and 38 (transfer) would have leaked into the balances.

---

## Common Key (Foreign Key)

The field linking all four files: **`Cari Kodu 2`**

- Format: `5000XXXXXX` (10 digits, numeric string starting `5000`) → normal customers
- Special value: `EFES` (2,432 records in the sales file) → the company's own main
  producer/supplier account, not a regular customer. Handled separately.
- The `Cari Kodu` column (without the "2") is mostly empty or holds a short categorical code
  (`Z001`, `2222`) — **not a reliable key**. Always use `Cari Kodu 2`.
- Cross-file matching tested: sample code `5000266833` was found in both the transfer
  collection and sales files → **the key is consistent and reliable.**

**Decision:** `Cari Kodu 2` (normalised to a string) is the document ID of the `customers`
collection in Firestore.

### Column-Name Spelling — Verified Per File (CLOSED)

The previously open inconsistency (`Cari Kodu 2` vs `Cari Kodu2`) was resolved by
programmatically listing columns from the real files:

| File | Actual column name | Verification |
|---|---|---|
| Cash collections | `Cari Kodu 2` (with space) | Verified on the real file |
| Transfer collections | `Cari Kodu 2` (with space) | Verified on the real file |
| Purchases | `Cari Kodu2` (no space) | Verified on the real file |
| Sales | `Cari Kodu 2` (with space) | **Verified on the real file** — the earlier assumption was confirmed correct |
| Customer Master | no such column | The corresponding field is `Müşteri` |

**Implementation rule (Decision #10):** the parser is configured with a **fixed mapping** per
file type. Dynamic "column-name guessing" is **never** done:
```
NAKİT_TAHSİLAT   → "Cari Kodu 2"
HAVALE_TAHSİLAT  → "Cari Kodu 2"
SATIŞ            → "Cari Kodu 2"
SATIN_ALMA       → "Cari Kodu2"
MÜŞTERİ_MASTER   → "Müşteri"
```
All five normalise to the same Firestore field (`customerId`), so the application and report
layers never deal with differing names.

---

## Document Number and Record Type (Cancellation Handling)

In the collection files a document can appear **twice**: once `CREATED` and once `CANCELLED`
(same amount, same document number), representing a cancelled transaction.

**Rule:** only rows with `Kayıt Tipi = 'CREATED'` **and no** corresponding `CANCELLED`
record count towards balances. Equivalently and more robustly: if any `CANCELLED` record
exists for a `Belge Numarası`, the whole document is excluded (net effect zero).

The same logic applies to sales invoices via the `Fatura Durum` field.

---

## Amount Sign and Return Logic

All `Tutar` / `Satış Tutarı` values are **always positive** — there are no negative values.
Returns are indicated by a separate categorical field, not by sign:

- Sales file → `Tip`: `SATIS` | `IADE` | `HIZMET`
- Purchase file → `Tip`: `SATIN ALMA` | `IADE` | `HIZMET`

**Rule (critical for the calculation layer):** when computing balances/turnover, rows with
`Tip = 'IADE'` must be treated as **negative** (stored positive, but they reduce customer
debt in business terms).

---

## Collection Design (Firestore)

### 1. `customers` — from the Customer Master file

**Source:** a separate "Customer Master" Excel file (3,600 rows, 40 columns). This is the
source of customer **creation** — it carries the customer's own identity/definition data,
unlike transaction files where `Cari Kodu 2` appears only as a reference.

**User decision:** the following 13 columns must be preserved on customer creation. The
other 27 columns (tax type, taxpayer status, TAPDK number, credit limit, cheque/note risk
ratio, etc.) are out of scope at this stage.

| Field (Firestore) | Type | Source column | Note |
|---|---|---|---|
| `customerId` (doc id) | string | `Müşteri` | 10-digit `5000XXXXXX` (3,557/3,600 rows) |
| `salesManagerName` | string | `Dist Satış Şefi Adı` | Never empty |
| `salesRepName` | string | `Satış Temsilcisi Adı` | Empty in 43 rows |
| `salesChannel` | string | `Satış Kanalı Tanımı` | Never empty |
| `volumeSegment` | string | `Müşteri Hacim Segmenti` | Empty in 30 rows |
| `signName` | string | `Tabela Adı` | Never empty |
| `customerName` | string | `Müşteri Adı` | Never empty |
| `province` | string | `İl` | Never empty |
| `district` | string | `İlçe` | Never empty |
| `shippingAddress` | string | `Sevk Adresi` | Never empty |
| `phone` | string \| null | `Telefon` | **Subject to the validation rule below** |
| `customerStatus` | enum: `Aktif (A)`\|`Pasif (P)`\|`İptal (C)` | `Müşteri Durumu` | Never empty |
| `workPeriod` | string \| null | `Çalışma Dönemi` | Empty in 195 rows (`Standart`/`Yazlık`/`Kışlık`) |

**Phone validation rule (Decision #7):**

The raw data has 3,265 non-empty phone values, but not all are valid Turkish mobile numbers:

```
VALID_PHONE(t) = t, if it matches ^5\d{9}$  (starts with 5, 10 digits total)
                    AND t ∉ {"5999999999", "5559999999"}  (known placeholders)
                 otherwise → null (stored empty)
```

Leading `90` (country code) and `0` prefixes are stripped before validation.

Observed breakdown in the real data:

| Case | Rows |
|---|---|
| Valid (stored) | 2,813 |
| Placeholder (`5999999999`/`5559999999`) → nulled | 364 |
| Malformed (not starting with 5, e.g. `9053349363`, `2825181718`) → nulled | 88 |
| Already empty | 335 |

So `phone` ends up populated in **2,813 / 3,600** rows.

**Known exception — 6-digit `Müşteri` codes (definitively out of scope):** 43 rows have a
6-digit short code (e.g. `284947`); all are Migros chain stores (`Migros Ticaret A.Ş.`).
**User decision: these 43 rows are entirely out of scope** — not now, not later, and no
matching against `Cari Kodu 2` in other files.

### 2. `sales_invoices` — from the Sales file

> **Decision:** only the fields below are used. Other columns (tax office, plate, driver,
> warehouse, department, factory, etc.) were **removed** from the model — most were empty.

| Field | Type | Source column | Note |
|---|---|---|---|
| `invoiceId` (doc id) | string | `Fatura No` | Unique — 29,174 distinct values in 29,174 rows |
| `invoiceDate` | timestamp | `Fatura Tarihi` | |
| `customerId` | string (FK) | `Cari Kodu 2` | Joins to `customers` |
| `amount` | number | `Satış Tutarı` | Always positive |
| `eDocumentNo` | string | `EDOCUMENTNO` | E-document reference |
| `type` | enum: `SATIS`\|`IADE`\|`HIZMET` | `Tip` | Filtering only |
| `status` | enum: `CREATED`\|`CANCELLED` | `Fatura Durum` | Filtering only |

**Firm rule:** `sales_invoices` uses **7 fields total** — 5 core fields plus `Tip` and
`Fatura Durum`, which exist purely to filter out EFES/CANCELLED rows during
upload/calculation. **No other column in the sales file is read** (including `Vade Tarihi`).

---

## EFES and CANCELLED Rules — Sales (Verified)

### 1. EFES records — excluded entirely

`EFES` is the main producer/supplier the company buys beer/spirits from (EFES Pazarlama ve
Dağıtım Ticaret A.Ş.), **not** a regular customer. EFES rows are therefore excluded from
customer-balance calculations.

Verified across all 29,174 rows:

| `Tip` | Rows | EFES? |
|---|---|---|
| `SATIS` | 25,695 | None — all real customers |
| `HIZMET` | 2,432 | **All** have `Cari Kodu 2 = "EFES"` |
| `IADE` | 1,047 | `Cari Kodu 2` is **empty (NaN)** but `Cari Adı` contains "EFES PAZARLAMA..." |

**Exclusion filter:**
```
Treat as EFES and exclude if:
    Cari Kodu 2 == "EFES"
    OR
    Cari Adı contains "EFES PAZARLAMA" (case-insensitive)
```
This covers all `HIZMET` (2,432) and all `IADE` (1,047) rows — 3,479 rows excluded from
balance calculations. The remaining **25,695 rows** (`Tip=SATIS`, non-EFES) are the real
customer sales.

> **The name check is mandatory:** `IADE` rows have an empty customer code but a populated
> `Cari Adı`. A code-only filter misses them.

### 2. CANCELLED records — reversal / re-issued invoice

All 56 rows with `Fatura Durum = CANCELLED` were verified: each matches another `CREATED`
row with the same `EDOCUMENTNO` (same amount, same customer, different `Fatura No`). This
indicates "invoice cancelled and re-issued against the same e-document reference" — an
accounting/system correction rather than a genuine return.

**Correct rule (Decision #11):** see CORE PRINCIPLE #2. Exclusion is keyed on
`Fatura No` / `Belge Numarası` (the field the cancelled pair shares), two-pass. The
`EDOCUMENTNO` match was used for verification only.

### Final sales filter (rows used in balance calculations)

```
VALID SALES ROW =
      Fatura No NOT IN the set of CANCELLED document numbers   (CORE PRINCIPLE #2)
  AND Cari Kodu 2 != "EFES"
  AND Cari Adı NOT LIKE "%EFES PAZARLAMA%"
```
Note: `Fatura Durum == CREATED` alone is **not** sufficient — a CREATED row whose
`Fatura No` has a CANCELLED twin must also be excluded. Rows passing this filter
automatically have `Tip = SATIS`.

### 3. `purchase_invoices` — from the Purchase file

| Field | Type | Source column | Note |
|---|---|---|---|
| `invoiceId` (doc id) | string | `Fatura No` | Unique — 8,914 distinct values in 8,914 rows |
| `invoiceDate` | timestamp | `Fatura Tarihi` | |
| `customerId` | string (FK) | `Cari Kodu2` | Here it is actually the supplier |
| `amount` | number | `Tutar` | Always positive |
| `type` | enum: `SATIN ALMA`\|`IADE`\|`HIZMET` | `Tip` | Used for routing — see below |
| `eDocumentNo` | string | `EDOCUMENTNO` | |

**Firm rule:** 6 fields total. No other column in the purchase file is read.

---

## Purchase File — Routing, EFES and CANCELLED (Decision #5)

### CANCELLED — absent from current data, but the rule stays in code

All 8,914 rows are `Fatura Durum = CREATED`; there are no CANCELLED records, so the paired
mechanism could not be observed in this dataset. The two-pass rule is nonetheless kept in
code so it activates automatically if future uploads contain cancellations. Its practical
effect on the current dataset is zero (0/8,914).

### `HIZMET` and `IADE` rows are CUSTOMER movements, not supplier movements

**This corrected an earlier, wrong model.** Verified on a fresh 213-row slice:

- `Tip = HIZMET` (`Fatura Tipi = YV02`) and `Tip = IADE` (`Fatura Tipi = Z104`) rows
  **all** carry a **customer** code in `Cari Kodu2` (`5000XXXXXX` format) — not a supplier
  code, not `EFES`. `Cari Adı` is a real dealer/customer name (e.g. "BİNBAY RESTAURANT").
- Only `Tip = SATIN ALMA` (`Fatura Tipi = RD`) rows have `Cari Kodu2 = EFES` — so the
  **only real supplier movement is `SATIN ALMA`**.
- **Business interpretation:** `HIZMET` and `IADE` invoices are issued *to the customer* and
  **reduce** the customer's outstanding debt. Functionally they behave like a collection —
  the instrument is an invoice rather than cash/card/transfer.

### Current routing

```
purchase_invoices      (supplier debt) =
      Tip == "SATIN ALMA"
  AND Fatura Durum == "CREATED"

customer_credit_notes  (customer credit note) =
      Tip IN ("HIZMET", "IADE")
  AND Fatura Durum == "CREATED"
```

The `Cari Kodu2 == "EFES"` filter is no longer needed for `purchase_invoices` (in the sample,
`SATIN ALMA` was 9/9 EFES), but it is kept defensively so a non-EFES `SATIN ALMA` row would
still route correctly if the supplier base diversifies.

### 4. `collections` — Cash + Transfer combined

**Fields read from Cash collections (6):** `Belge Numarası`, `Fatura Tarihi` (= collection
date), `Cari Kodu 2`, `Kasa Kodu`, `Tutar`, `Kayıt Tipi`.

**Fields read from Transfer collections (5):** `Belge Numarası`, `Fatura Tarihi`,
`Cari Kodu 2`, `Tutar`, `Kayıt Tipi`. The transfer file has **no `Kasa Kodu`** column — it
has `Banka Kodu`/`Banka Adı` instead.

**No other column is read** in either file (`Cari Adı`, `Satış Temsilcisi Adı`, `Telefon`,
`İl`, `İlçe`, `Vergi Dairesi`, `Vergi No`, `Kimlik No`, `Banka Adı`, `Hesap No`,
`Tahsilatçı Adı Soyadı`, etc.). Rationale: all of that is derived from the Customer Master
via `Cari Kodu 2` (see CORE PRINCIPLE #1).

**Collection method (`method`) detection — data-driven, not file-driven (Decision #9):**

```
method(row) =
    "HAVALE",        if Banka Kodu is non-empty
    "NAKİT",         if Kasa Kodu == 11
    "KREDİ_KARTI",   if Kasa Kodu == 12
```

This lets both files merge into one `collections` collection without depending on which file
a row came from. `Kasa Kodu` meanings: `11` = cash, `12` = credit card.

| Field (Firestore) | Type | Source column | Note |
|---|---|---|---|
| `collectionId` (doc id) | string | `Belge Numarası` | |
| `date` | timestamp | `Fatura Tarihi` | The column is named "Fatura Tarihi" but semantically it is the collection date |
| `customerId` | string (FK) | `Cari Kodu 2` | Joins to `customers`; all values are `5000XXXXXX` |
| `amount` | number | `Tutar` | Always positive |
| `method` | enum: `NAKİT`\|`KREDİ_KARTI`\|`HAVALE` | derived (see rule above) | Source file name is never used |
| `status` | enum: `CREATED`\|`CANCELLED` | `Kayıt Tipi` | Pair-wise filtering applies (CORE PRINCIPLE #2) |

### 5. `customer_credit_notes` — Customer Credit Notes

Source: the Purchase file, rows where `Tip IN (HIZMET, IADE)`.

**Why a separate collection rather than `collections`:** these rows do not represent cash or
bank inflow — they are documents (invoice-type, with an `EDOCUMENTNO`) that offset customer
debt. Since `collections` semantically means "cash/bank inflow", keeping the two sources
apart preserves traceability (the question "where did this amount come from?" stays
answerable). **However, in the calculation/report layer** — balance, collection performance,
aging — this collection is treated **together with** `collections` as a single
"debt-reducing pool". They are distinguished only by the method/type value
(`NAKİT`/`HAVALE`/`KREDİ_KARTI` vs `IADE_FATURASI`/`HIZMET_FATURASI`) — see Decision #20.

| Field | Type | Source column | Note |
|---|---|---|---|
| `creditNoteId` (doc id) | string | `Fatura No` | |
| `customerId` | string (FK) | `Cari Kodu2` | Joins to `customers` |
| `date` | timestamp | `Fatura Tarihi` | Used for aging, same semantics as `collections.date` |
| `amount` | number | `Tutar` | Always positive; applied in the debt-reducing direction |
| `type` | enum: `IADE_FATURASI`\|`HIZMET_FATURASI` | `Tip` (`IADE`→`IADE_FATURASI`, `HIZMET`→`HIZMET_FATURASI`) | Behaves like a "collection method" |
| `invoiceType` | string | `Fatura Tipi` | `Z104` (return) / `YV02` (service) — kept as a raw reference |
| `status` | enum: `CREATED`\|`CANCELLED` | `Fatura Durum` | Pair-wise filtering applies |
| `eDocumentNo` | string | `EDOCUMENTNO` | |
| `salesRepId` | string | `Satış Per. No` | |

---

## Customer Balance Formula (Current)

> **Change summary:** the earlier formula used only `sales_invoices` and `collections`.
> `customer_credit_notes` is now included as a debt-reducing item, because those rows are
> effectively a form of collection/offset made via return/service invoices (Decision #5).

```
VALID_SALES(customerId) =
    sales_invoices
    WHERE customerId = X
      AND status = 'CREATED'
      AND Fatura No NOT IN cancelled-document set
      AND customerId != 'EFES'
      AND NOT (customerName LIKE '%EFES PAZARLAMA%')

TOTAL_COLLECTED(customerId) =
    SUM(collections.amount            WHERE customerId=X AND status='CREATED')
  + SUM(customer_credit_notes.amount  WHERE customerId=X AND status='CREATED')

Customer Balance(customerId) =
    SUM(VALID_SALES(X).amount) - TOTAL_COLLECTED(customerId)
```

Positive = the customer owes money. Negative = the customer is in credit.

> **Diagnostic note (2026-07-30):** if most customers show large **negative** balances and
> total collections vastly exceed total sales, that means the **sales side is incompletely
> loaded** — not that the formula is wrong. Aging buckets then correctly return `₺0.00`
> (Decision #12). Check the sales file upload first.

### Collection Performance and Aging — Principle

All financial reports (customer summary, rep-level collection performance, aging reports)
follow this principle: a customer's "collections" means real cash/bank inflows
(`collections`) **together with** debt offsets made via return/service invoices
(`customer_credit_notes`). They differ only in the method/type field. In aging calculations
`customer_credit_notes.date` is used exactly like `collections.date` — as the date the debt
was reduced.

This must be implemented as **one shared function** in the `calculations/` layer (e.g.
`getAllCollectionEvents(customerId)` → merged, date-sorted list) so the panel and the
AI assistant use identical logic (Decision #1).

**Aging principle (Decision #6):** no fixed "due date" field is used (`Vade Tarihi` is
ignored). Overdue status is computed from the number of days elapsed since `Fatura Tarihi`
("45 days overdue", "0–30 days", "31–60 days", …). This applies to `sales_invoices`,
`customer_credit_notes` and `collections` alike.

**Bucket boundaries (Decision #19):** the calculation returns **five** buckets —
`current` (0–30), `days30` (31–60), `days60` (61–90), `days90` (91–120), `over90` (120+) —
while the UI shows **four** cards, where `> 90 days` = `days90 + over90`. It also returns a
`distribution` field (unpaid amounts per bucket, sorted descending) that feeds the mini bar
charts in the statement detail.

> Note: `purchase_invoices` represents the company's **own** debt to its suppliers — a
> separate account from customer balances. Two distinct concepts exist: **Customer
> Receivable Balance** and **Supplier Payable Balance**.

---

## Data Quality Notes

1. **Phone field type inconsistency:** `float64` in transfer collections, `str` in cash
   collections and sales. Normalise everything to string on load (risk of losing a leading 0).
2. **`EFES` customer code:** appears in 2,432 sales rows and does not match the normal dealer
   code format. Likely an internal/producer offset record. Flagged separately during upload
   so it never causes an error.
3. **`Cari Kodu` (without "2") is nearly always empty/unreliable** — never used in the model.
4. **Purchase `Fatura Tipi` codes** (`YV02`, `Z104`, `RD`, `Z101`, `Z103`) are ERP-specific.
   Marked unimportant by the user; not in the schema, not investigated.
5. **CANCELLED records exist as row pairs:** these pairs are stripped automatically on load —
   if a CANCELLED record exists for a document number, **both** the CANCELLED and the
   matching CREATED row are removed (two-pass, CORE PRINCIPLE #2). Skipping only the
   CANCELLED row is **incorrect** — this was found as a real bug and fixed.

---

## Open Questions

- [ ] **Data completeness check (highest priority):** balances currently read as large
      negatives, implying the sales file is missing or partially loaded while collections are
      complete. Re-upload the sales file and confirm balances turn positive before trusting
      the aging and dashboard figures.
- [ ] What is the data source for the stock module? The user mentioned a separate stock
      report Excel; not yet uploaded.
- [ ] How many users/roles will there be? (admin, field sales, accounting, …)

### Closed

- [x] ~~What do `EFES` records mean?~~ → Main producer/supplier, not a customer, excluded entirely.
- [x] ~~How are return/cancelled invoices included in balances?~~ → CANCELLED rows excluded
      **in pairs**; `IADE` in the sales file belongs to EFES.
- [x] ~~Will the purchase file get the same EFES/return/cancellation analysis?~~ → Done;
      routing defined in Decision #5.
- [x] ~~Meaning of purchase `Fatura Tipi` codes~~ → Closed; marked unimportant by the user.
- [x] ~~Is due-date tracking based on `Vade Tarihi`?~~ → **No.** Days-elapsed since
      `Fatura Tarihi` is used instead (Decision #6).
- [x] ~~Column-name inconsistency (`Cari Kodu 2` vs `Cari Kodu2`)~~ → Verified on real files;
      fixed per-file mapping table created. The sales file's spaced spelling was confirmed.
- [x] ~~Coding the CANCELLED rule for the purchase file~~ → Kept in code; zero practical
      effect on current data (0/8,914).
- [x] ~~Which 13 columns are preserved from Customer Master?~~ → Specified and applied to the
      `customers` schema.
- [x] ~~How is the phone field validated?~~ → `^5\d{9}$` + placeholder rejection (Decision #7).
- [x] ~~The 43 six-digit Migros `Müşteri` codes~~ → Permanently out of scope.

---

## Change History

- **2026-07-29:** First four files analysed. Common key (`Cari Kodu 2`), return/cancellation
  logic and the draft Firestore schema established.
- **2026-07-29:** `sales_invoices` core fields chosen. EFES exclusion and CANCELLED reversal
  behaviour confirmed against real data (56/56 CANCELLED matches, 3,479/3,479 EFES rows).
  `Tip` and `Fatura Durum` added back to the schema — proven necessary for the balance formula.
- **2026-07-29:** Purchase file analysed; 6 core fields chosen. No CANCELLED records found
  (0/8,914).
- **2026-07-30:** **Critical correction.** Purchase `HIZMET`/`IADE` rows are customer
  movements that reduce customer debt, not supplier movements. New collection
  `customer_credit_notes` added; `purchase_invoices` now takes only `Tip = SATIN ALMA`. The
  balance formula was updated so credit notes are deducted alongside collections. This logic
  applies to **all** financial reports, not just the balance.
- **2026-07-30:** Customer Master analysed (3,600 rows, 40 columns). 13 preserved fields
  defined; phone validation rule finalised (2,813/3,600 valid). 43 six-digit Migros codes
  found and excluded.
- **2026-07-30:** Decision #11 — two-pass CANCELLED filtering documented as CORE PRINCIPLE #2
  after a real bug was found (a cancelled 72,651,490 ₺ transfer still counted in the balance).
- **2026-07-30:** Real-file verification closed two open questions — the sales column-name
  assumption was confirmed, and Decision #11 was proven to have real effect on the collection
  files (58 and 84 rows removed).
- **2026-07-30:** Decision #19 (5 buckets / 4 cards + `distribution`) and Decision #20
  (5 collection slices) recorded. Diagnostic note added about negative balances indicating an
  incomplete sales load.
- **2026-07-30:** Document converted to English at the user's request. Excel column names and
  enum values deliberately kept in Turkish.
