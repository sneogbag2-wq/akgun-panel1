# Project Decisions Log

> This file records every architectural, technical and business decision taken during the
> project, in chronological order. Updated each session. **Nothing is deleted — only appended.**
>
> Language note: these docs are in English; the **application UI stays Turkish**. Never
> translate Excel column names or enum values (`NAKİT`, `HAVALE`, `CREATED`, `CANCELLED`, …) —
> they must match the source data exactly.

---

## Project Summary

**What we are building:** an operational management panel for an alcoholic-beverage
distribution company.

**Known modules:**
- Customer account (receivable/payable) tracking
- Stock management (including days-of-stock)
- Sales data / order tracking
- Financial reporting

**End goal:**
- Firebase integration (Firestore + Cloud Functions)
- An AI-assisted WhatsApp bot that answers natural-language questions using the panel's
  data and formulas, without opening the panel

**Working principles:**
- Multi-session project. These markdown files are updated every session.
- Progress is staged; the user manually tests at the end of each stage.
- Performance and code quality come first; session/token cost is not a constraint.
- Best practices apply throughout.

---

## Decision #1 — Technology Stack (2026-07-29)

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React + Vite | A panel that grows modularly needs component architecture. Vanilla JS becomes a maintenance burden as the project grows. |
| Backend/DB | Firebase (Firestore + Cloud Functions) | This is the target architecture anyway. Building the schema for it from the start avoids a migration cost later. |
| Business logic / formulas | Central calculation layer (shared module, later inside Cloud Functions) | The panel and the WhatsApp bot call the SAME functions. Duplicated formulas = inconsistency risk. The bot's requirement of "access to every formula" is solved this way. |
| Bot | WhatsApp Business API + AI layer | Final stage. Designed to depend on the panel's data/calculation layer. |

---

## Decision #5 — Purchase File Splits Into Two Targets (2026-07-30)

The purchase file's `HIZMET` (service) and `IADE` (return) rows are **not** supplier
movements — they are invoices issued to the **customer** that **reduce** the customer's
debt. Functionally they behave like a collection; only the instrument differs.

```
purchase_invoices       = Tip == "SATIN ALMA"      (real supplier debt)
customer_credit_notes   = Tip IN ("HIZMET","IADE") (reduces customer debt)
```

Verified on real data: `HIZMET`/`IADE` rows all carry a real customer code
(`5000XXXXXX`), while `SATIN ALMA` rows are all `EFES` (the main supplier).

**Consequence:** every financial report — balance, collection performance, aging —
treats `customer_credit_notes` together with `collections` as one "collection pool".
They differ only in the method/type field.

---

## Decision #6 — Days Elapsed Instead of a Due Date (2026-07-30)

No fixed `Vade Tarihi` (due-date) column is used. Overdue status is computed as the number
of days elapsed from the invoice date to today (0–30, 31–60, 61–90, 90+).

---

## Decision #7 — Customer Master: 13 Fields + Phone Rule (2026-07-30)

13 columns are preserved on customer creation (see `DATA_MODEL.md`).

**Phone validation:** valid only if it matches `^5\d{9}$` **and** is not a known
placeholder (`5999999999`, `5559999999`). Anything else is stored as `null` — never
invented. Leading `90` / `0` prefixes are stripped first.

**Out of scope:** 43 rows whose `Müşteri` code is 6 digits are Migros chain stores.
Permanently excluded — no matching against other files either.

---

## Decision #8 — "Derive From Master" (2026-07-30)

Transaction collections (`sales_invoices`, `purchase_invoices`, `collections`,
`customer_credit_notes`, and any future collection) store **no descriptive customer
fields** — no customer name, sales rep, phone, province, district, or channel. They carry
only `customerId` as a foreign key.

Descriptive data is read from `customers` via a standard foreign-key join, whether for the
screen, a report, or a bot answer.

**The master file's real role:** it is *not* a live dependency that reports read each time.
It is the **upsert/sync source** for customer creation and updates. Once processed, the
`customers` collection is a **standalone, persistent source of truth** and the master file
is not read again.

**Unmatched customer rule:** when a transaction file contains a `customerId` that does not
exist in `customers`, the system does **not** silently skip it — it warns the user to
re-upload an up-to-date Master file. Auto-creating customers or filling in customer data
from transaction files is never done.

---

## Decision #9 — Collection Method Derived From Data (2026-07-30)

The method is determined by the row's own content, **not** by the source file name:

```
method(row) =
    "HAVALE",        if Banka Kodu is non-empty
    "NAKİT",         if Kasa Kodu == 11
    "KREDİ_KARTI",   if Kasa Kodu == 12
```

This lets the Nakit and Havale files merge safely into one `collections` collection.

---

## Decision #10 — Column Names Are Hardcoded (2026-07-30)

Column names are fixed per file type in `columnMappings.js`. **No fuzzy matching or
column-name guessing** — it produces errors that cannot be traced or controlled.

Note the real inconsistency in the source files: Sales/Nakit/Havale use `Cari Kodu 2`
(with a space), Purchase uses `Cari Kodu2` (no space), Customer Master uses `Müşteri`.

---

## Decision #11 — CANCELLED Rule: The Matching CREATED Row Must Also Be Excluded (2026-07-30)

When a document is cancelled, the raw data holds **two** rows — CREATED and CANCELLED —
both carrying the same amount. Skipping only the CANCELLED row leaves the CREATED row
looking like a valid transaction, and the cancelled amount leaks into the balance.

**Two-pass filtering is mandatory:**
```
1. Scan the whole file; collect the document numbers of all CANCELLED rows into a Set.
2. Remove EVERY row whose document number is in that Set — the CANCELLED row AND its
   matching CREATED row.
3. Process the remaining rows normally.
```

A single-row `if (status === "CANCELLED") continue;` filter is **insufficient and wrong**.

Verified with a real example: transfer document `72651490`, amount `72,651,490 ₺`,
present as both CREATED and CANCELLED.

| File | Document-no field | Status field |
|---|---|---|
| Sales | `Fatura No` | `Fatura Durum` |
| Purchase | `Fatura No` | `Fatura Durum` |
| Cash collection | `Belge Numarası` | `Kayıt Tipi` |
| Transfer collection | `Belge Numarası` | `Kayıt Tipi` |

---

## Decision #12 — FIFO Aging and Balance Cache (2026-07-30)

1. **Balance check:** if a customer's net balance is `≤ 0` (they owe nothing / are in
   credit), **all** aging buckets must be `₺0.00`. An overdue receivable cannot be reported
   for a customer who is in credit.
2. **FIFO offsetting:** in `getAgingBuckets(sales, collections, creditNotes)` all
   collections and credit notes are applied against the **oldest invoices first**. Only the
   remaining unpaid amount is placed into a bucket, based on the invoice date.
3. **Balance map cache:** customer balances are computed in a single pass and cached in
   `customerService.js`; `invalidateCache()` resets it on every write.

> **Important consequence:** if the aging cards show `₺0.00`, check the balance sign first.
> All-zero buckets for a negative balance is *correct behaviour*, not a UI bug.

---

## Decision #13 — Hiding Passive/Cancelled Customers vs. Including Them in Reports (2026-07-30)

1. **UI listing rule:** customers whose `customerStatus` contains "İptal"/"(C)" or
   "Pasif"/"(P)" **and** whose balance is under 30 TL are filtered out by
   `searchCustomers()`. They never appear in search results, customer tables or pickers.
2. **Reporting:** this hiding rule binds the search/render list **only**. Their historical
   invoices, collections and credit notes remain fully included in background financial
   analysis (total sales, total collections, sell-out analysis, BI reports).
   `getAllCustomersForReporting()` and `getGlobalFinancialSummary()` include them 100%.

---

## Decision #14 — IndexedDB Archive (2026-07-30)

Uploaded data is archived in IndexedDB (500MB+ capacity), so a page reload does not lose
data. `archiveService.js` keeps the same function signatures Firestore will use, so the
migration is a swap rather than a rewrite.

---

## Decision #15 — Sales Reps With Fewer Than 10 Customers Are Hidden (2026-07-30)

The rep filter only lists reps with 10 or more customers, to reduce noise from tiny
portfolios.

---

## Decision #16 — Search Behaviour (2026-07-30)

Search is `useDebounce(value, 300)` over three fields: `customerId`, `customerName`,
`signName`. Dashboard and CariPage behave identically.

---

## Decision #17 — Seed Data and Real Data Never Coexist (2026-07-30)

The app opens with seed (demo) data when the archive is empty. **The moment the first real
file is uploaded, seed data is discarded entirely** (`usingSeedData` flag becomes false).

**Rationale (a real bug):** previously, uploading the Customer Master left the seed rows in
memory. Those rows were not in the archive, so on the next page reload — where
`hasArchivedData()` now returns true and seed is skipped — those customers vanished and
balances dropped silently. The user reported this as "data loss when switching tabs".

---

## Decision #18 — Re-read the In-Memory Store From the Archive After Upload (2026-07-30)

Inside `saveUploadedData()`, the in-memory arrays are **never hand-merged**. After writing
to the archive, the store is fully re-read via `loadAll*()` / `loadCustomers()`.

**Rationale:** the `MUSTERI_MASTER` branch hand-merged while every other branch re-read.
That asymmetry produced silent drift between archive and memory (see Decision #17). Any new
file-type branch must follow this rule.

---

## Decision #19 — Aging: 5 Computed Buckets, 4 Visible Cards (2026-07-30)

`getAgingBuckets()` computes five buckets: `current` (0–30), `days30` (31–60),
`days60` (61–90), `days90` (91–120), `over90` (120+). The UI shows **four** cards, and the
`> 90 days` card is **always `days90 + over90`**.

**Rationale (a real bug):** CariPage's "90+ days" box read only `over90`, so debt aged
91–120 days appeared in no box at all and the card silently showed `₺0.00`.

`getAgingBuckets()` also returns a `distribution` field — the unpaid invoice amounts per
bucket, sorted descending — which feeds the mini bar charts in the statement detail.
Distribution totals always equal the corresponding bucket total.

---

## Decision #20 — Collection Breakdown Has 5 Separate Slices (2026-07-30)

The collection distribution chart shows five distinct slices:

| Slice | Source |
|---|---|
| Nakit | `collections`, method `NAKİT` |
| Havale | `collections`, method `HAVALE` |
| Kredi Kartı | `collections`, method `KREDİ_KARTI` |
| Hizmet Faturası | `customer_credit_notes`, type `HIZMET_FATURASI` |
| İade Faturası | `customer_credit_notes`, type `IADE_FATURASI` |

Service and return invoices **count as collections** (Decision #5) because they reduce
customer debt — but they must remain visually distinguishable from real cash/bank inflows,
so they get their own slices rather than being merged into a generic bucket. Slices with a
zero value are hidden so the chart stays readable.

Chart centre labels must be **computed from data**. Hardcoded labels (the dashboard
previously showed a fixed "%82 Başarı", "%25 Riskli", "3 Dilim") silently misreport
whatever the data actually says.

---

## Decision #21 — No Fabricated Fallback Values in the UI (2026-07-30)

When real data is absent or zero, the UI shows **0** (or hides the element). It must never
fall back to an invented number.

**Rationale (a real bug the user caught):** the dashboard contained several hardcoded
placeholders that looked like genuine metrics and did not change with the data:

| Element | Was | Now |
|---|---|---|
| Toplam Tahsilat KPI | `?? 212000` → showed ₺212K | Real value, 0 if absent |
| Vadesi Geçen Alacak KPI | `overdue \|\| 96700.5` → showed ₺97K | Real value, 0 if absent |
| Donut centre labels | `3 Dilim`, `%25 Riskli`, `%82 Başarı` | Computed from data (Decision #20) |
| Açık Fatura | `24 Adet` | Computed — invoices of customers with a positive balance |
| Bugün Gelen Tahsilat | `₺45.200` | Computed — today's collections + credit notes |
| Ortalama Vade | `42 Gün` (labelled "sector") | Computed — portfolio average, weighted by unpaid amount |
| Aylık Tahsilat Hedefi | `₺250.000 / ₺205.000 (%82)` | **Removed** — no data source exists for a target |

A fabricated fallback is worse than an empty state: it cannot be distinguished from real data,
so it silently misreports. Where no data source exists (a collection target), the element is
removed rather than faked; it can return when target entry is implemented.

---

## Decision #22 — Parallel Loads Must Be Committed as One Snapshot (2026-07-30)

Pages that load several service calls must run them in a single `Promise.all` and write state
**once**, guarded by a run-id so only the most recent round can commit.

**Rationale (a real bug):** `DashboardPage` fired five independent, unawaited promises inside
`load()`, and `subscribeDataChange` re-triggered `load()` on every data change. Overlapping
rounds meant a slow response from an older round could overwrite a newer one — last writer
wins. The visible symptom was **KPI cards showing ₺0 / 0 while the donut charts on the same
page showed correct values (₺7K / ₺522.9M)**, because the charts happened to commit late and
the cards early.

The same run-id guard was applied to `CariPage`'s search effect.

> Note: this was the actual cause of the reported "values reset when switching tabs". The
> `await ready()` gate added earlier (see `CODING_GUIDE.md`) was a genuine fix for a different
> race, but it did not address this one.

---

## Decision #23 — `parseAmount()` Must Handle Both TR and EN Number Formats (2026-07-30)

All parsers (`salesParser`, `purchaseParser`, `collectionParser`) must use `parseAmount()` instead of raw `parseFloat()`.

**Rationale (a real bug):** JavaScript's native `parseFloat("1.004.519,20")` stops at the second period and evaluates to `1`. This caused multi-million TL sales invoices to be stored as 1 TL invoices, resulting in massive data loss and wildly negative balances. `parseAmount()` detects whether dot or comma is the decimal separator and safely parses formatted strings.

---

## Decision #24 — Parsers Deduplicate Line Items per Invoice using a Map (2026-07-30)

`salesParser` and `purchaseParser` group Excel rows by `invoiceId` using a `Map` before generating records, summing line-item amounts into a single invoice total.

**Rationale (a real bug):** Invoices in Excel exports contain multiple product line items under the same `invoiceId`. Because IndexedDB uses `invoiceId` as the primary key (`keyPath`), calling `store.put()` for each raw row caused subsequent line items to overwrite earlier ones, keeping only the final line item's amount.

---

## Decision #25 — `hasArchivedData()` Checks All 5 IndexedDB Stores (2026-07-30)

`hasArchivedData()` in `archiveService.js` queries `idbCount()` across all five stores (`customers`, `satis`, `collections`, `purchase`, `credit_notes`) and returns true if the sum > 0.

**Rationale (a real bug):** Previously it checked only `idbCount('customers')`. When a user uploaded Sales or Collections without uploading Customer Master first, `customers` remained 0, causing `hasArchivedData()` to return false on page refresh. This triggered `loadSeedData()`, mixing demo data into live uploaded data on every F5.

---

## Decision #26 — Synthetic Customer Master Integrity (`ensureCustomerMasterIntegrity`) (2026-07-30)

`ensureCustomerMasterIntegrity()` runs automatically after archive init and after uploads. It scans sales, collections, and credit notes for any `customerId` missing from `mockCustomers` and synthesizes placeholder customer records.

**Rationale:** If a user uploads sales or collections without uploading Customer Master, `mockCustomers` remained empty. Functions relying on `mockCustomers` (e.g. `getActiveCustomerCount()`, `getAllCustomersForReporting()`, balance map calculations) evaluated to 0/empty, causing top KPI cards to display ₺0 / 0 customers.

---

## Decision #27 — Synchronous Getters for Instant Component Initialisation (2026-07-30)

All read services in `customerService.js` expose a **Sync** variant (e.g., `getGlobalFinancialSummarySync()`, `getActiveCustomerCountSync()`) that reads directly from in-memory arrays without `await ready()`. React page components use these Sync functions inside `useState(() => getSync())` lazy initialisers.

**Rationale (a real bug):** On React Router page transitions (e.g., `/cari` → `/`), components unmounted and remounted. Because states were initialized to `0` or `null` while async `load()` promises resolved, cards flashed `₺0` and `0` on every tab switch. Initialising from in-memory data on frame 1 completely eliminates tab-switch flashing.

---

## Decision #28 — Pivot from External WhatsApp Bot to Embedded In-App AI Assistant (2026-07-30)

The plan to build a separate WhatsApp Business API bot was replaced with an **in-app AI Assistant** embedded directly within the React web application interface.

**Rationale:** An embedded AI assistant provides an immediate, zero-friction reporting interface for users already in the web application. It eliminates external messaging dependency and webhook maintenance while giving the AI direct access to panel functions, rich tables, interactive Markdown reports, and floating overlay chat (`AiChatPanel.jsx`) alongside full-page chat (`AiChatPage.jsx`).

---

## Decision #29 — Function Calling Architecture for AI Data Access (2026-07-30)

The AI assistant integrates with LLMs (Google Gemini API with Gemini 1.5/2.0 Flash) using **Function Calling (Tools)** and a client-side analytical fallback.

```
aiService.js → Gemini API (Function Calling) → aiTools.js → customerService.js & calculations/
                                             ↳ Fallback Analytical Engine (if offline/no key)
```

**Rationale:** Providing full database dumps in system prompts is expensive and exceeds token limits. Function calling allows the AI to inspect system state via `buildSystemPrompt()` data summaries, and dynamically invoke granular functions (`getTopDebtors`, `getCustomerStatement`, `getGlobalFinancialSummary`, `getAgingBreakdown`, `searchCustomers`) only when needed.

---

## Decision #30 — Gemini 3.6 Flash Routing and Granular Transaction Tools (`queryTransactions`) (2026-07-30)

380: 1. **Model Selection:** `gemini-3.6-flash` was selected as the primary API model for Function Calling with `AQ.Ab8...` API keys, with fallback order `['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-2.0-flash']`.
381: 2. **Granular Transaction Querying:** Added `queryTransactions` tool to `aiTools.js` enabling natural language queries targeting specific customer transactions (e.g. "X'in son tahsilatı", "last sales of Y", "credit notes"). Supports filtering by transaction type (`TAHSILAT`, `SATIS`, `DEKONT`) and date/amount sorting (`LATEST`, `OLDEST`, `HIGHEST_AMOUNT`).
382: 3. **Sales Rep Summaries:** Added `getSalesRepSummary` tool for sales rep portfolio analysis.
383: 
384: ---
385: 
386: ## Decision #31 — Manual Transaction Entry, Virman Transfers & Transaction Deletion (2026-07-30)
387: 
1. **Model Selection:** `gemini-3.6-flash` was selected as the primary API model for Function Calling with `AQ.Ab8...` API keys, with fallback order `['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-2.0-flash']`.
2. **Granular Transaction Querying:** Added `queryTransactions` tool to `aiTools.js` enabling natural language queries targeting specific customer transactions (e.g. "X'in son tahsilatı", "last sales of Y", "credit notes"). Supports filtering by transaction type (`TAHSILAT`, `SATIS`, `DEKONT`) and date/amount sorting (`LATEST`, `OLDEST`, `HIGHEST_AMOUNT`).
3. **Sales Rep Summaries:** Added `getSalesRepSummary` tool for sales rep portfolio analysis.

---

## Decision #31 — Manual Transaction Entry, Virman Transfers & Transaction Deletion (2026-07-30)

Integrated manual transaction management directly inside **Cari Yönetimi** (`/cariler`) statement view rather than creating a separate panel:

1. **Manual Invoice Entry (`addManualInvoice`):** Creates sales invoices updating customer debt, aging, and IndexedDB archive.
2. **Manual Collection Entry (`addManualCollection`):** Creates collection entries with payment methods (`NAKİT`, `HAVALE`, `KREDİ_KARTI`) decreasing debt.
3. **Virman Transfer Between Customers (`addVirmanTransfer`):** Creates two linked accounting entries (`VRM-XXXXXX`): a Credit Note for Source Customer (decreasing Source debt) and a Debit Invoice for Target Customer (increasing Target debt).
4. **Transaction Deletion (`deleteTransactionRecord`):** Trash icon on every ekstre row with confirmation, updating running balance and aging.
5. **AI Tools Integration:** Exposed `addManualInvoice`, `addManualCollection`, `addVirmanTransfer`, `deleteTransaction` to Gemini AI Assistant function calling.

---

## Decision #32 — Dashboard Reference Open Invoices Modal & Dynamic 6-Metric Bar (2026-07-30)

1. **Dashboard Open Invoices Modal:** Added a `Detay ↗` button to each customer card on the Dashboard, opening a reference-styled popup modal featuring:
   - Dark slate header with customer initials avatar circle, customer code & sales rep pill badges.
   - Light cream table listing open invoices: `Belge No`, `Fatura Tarihi`, `Orijinal Tutar`, `Kalan Açık Bakiye`, and `Gün` (red text if >60).
   - Summary footer: `Toplam Kalan Borç`, `Ort. Vade` (always RED matching reference image), and `Ort. Vade Tarihi`.
   - Backdrop click-to-close behavior (`onClick` on `popup-modal-overlay`).

2. **6-Metric Bar with Dynamic Sales Representative Filtering:**
   - Replaced old 4-card metric bar with 6-Card Metric Bar: `Toplam Kalan Borç`, `Ortalama Vade`, `Toplam Risk`, `Çek / Senet Riski`, `Alınan Tahsilat`, `Tahsilat Oranı`.
   - Placed Sales Representative (`activeRepFilter`) select dropdown in `chip-filters`.
   - Selecting a representative dynamically re-calculates ALL 6 metric cards for that representative's portfolio.

3. **Global Typography:** Set global font-family to Google Font `'Plus Jakarta Sans'` across index.html & index.css.

---

## Change History

- **2026-07-29:** Decision #1 — technology stack chosen.
- **2026-07-30:** Decisions #5–#11 — data model and file rules finalised after real-file analysis.
- **2026-07-30:** Decision #12 added. FIFO aging offsetting documented, balance cache introduced.
- **2026-07-30:** Decision #13 added. Cancelled/passive + <30 TL hiding rule defined, with reporting totals protected.
- **2026-07-30:** Decisions #14–#16 added (IndexedDB archive, rep filter threshold, search behaviour).
- **2026-07-30:** The user selected `panel` as the single working application; the comparison project `panel-b` was deleted.
- **2026-07-30:** Decisions #17, #18, #19 added — all three came from root-cause analysis of two real bugs the user reported (data loss on tab switch, empty aging cards).
- **2026-07-30:** Decision #20 added — collection breakdown split into 5 slices; hardcoded chart centre labels replaced with computed values.
- **2026-07-30:** Decisions #21 and #22 added. KPI cards reset on tab switch fixed (#22); hardcoded placeholders removed (#21).
- **2026-07-30:** Documentation files converted to English.
- **2026-07-30:** Decisions #23–#27 added. Fixed `parseFloat` 1 TL bug (#23), invoice line-item overwrite bug (#24), IndexedDB multi-store check (#25), synthetic customer integrity (#26), and tab-switch 0-flash via Sync getters (#27).
- **2026-07-30:** Decisions #28–#29 added. Embedd- **2026-07-30:** Decision #31 added. Manual invoice/collection entry, Virman transfers, and transaction deletion in Cari Management.
- **2026-07-30:** Decision #32 added. Dashboard Open Invoices Modal, Plus Jakarta Sans typography, and 6-Metric Bar with dynamic sales rep filtering.
- **2026-07-31:** Decision #33 & #34 added. AI JS Injection for unknown Excel files, Proxy Row normalization, Virman financial report isolation, and automatic test rollback tooling.

## Decision #31 — Strict LLM Prompt Alignment & Function Call ID Mapping (2026-07-31)

To support advanced language models like **Gemini 3.1 Pro**, the AI service layer (aiService.js) was updated to map id fields strictly inside FunctionResponse packets. Furthermore, systemic safeguards (Prompt Alignment) were added to aiContext.js to prevent Language Model (LLM) hallucinations.

**Rationale (Real Bug):** When a user queried "my highest collection", the AI received global company-wide JSON data. Because it interpreted the possessive suffix "my" as a personal user profile constraint that it couldn't find in the global JSON, the AI panicked and fabricated a fake error message ("I am encountering a technical error"). 
By injecting explicit semantic rules (Rule 6: "my collection" means the entire company) and explicitly prohibiting fake error apologies when data is retrieved, the LLM was forced to reliably format and render the JSON without hallucinating failures.

## Decision #32 — The AI As The Foundational Source of Truth (2026-07-31)

The AI Assistant is no longer just a "chatbot" layer. It is the fundamental building block and source of truth for complex financial calculations (such as Average Term calculations using aging buckets). 

**Rationale:** Previously, UI Top Cards (like the Dashboard Average Term card) used simplified or hardcoded fallback formulas, while the AI used strict accounting formulas (getAgingBuckets). This caused a discrepancy where the UI showed 24 days and the AI showed 28 days. Going forward, the AI Assistant and its underlying calculation toolkit (customerService.js / getAverageTermForCustomersSync) are the absolute priority. The UI must always wire into the AI's calculation modules to guarantee perfect consistency.

## Decision #35 — Executive Wide AI Panel Layout Adaptation & Tabler Icons Webfont Integration (2026-07-31)

The UI structure and design system from `akgun_ai_panel_wide_layout.html` were fully adapted into the React web application (`AiChatPage.jsx`, `AiChatPanel.jsx`, `ChatMessage.jsx` and corresponding CSS files):
1. **Executive Dark Header (`#1C1B19`):** Gold robot avatar square badge (`#C9922E`, `38x38px`, `border-radius: 10px`), title `AKGÜN AI asistan` with active status dot (`#7BC67E`) and subtitle `Finansal sorular ve görsel analiz`. Header action buttons feature clean borders (`#3A3833`) and text (`#D8D4C8`).
2. **Warm Cream Message Canvas (`#F7F5F0`):** Responsive wide canvas (`padding: 24px 60px` on desktop) with dark executive user message bubbles (`#1C1B19`) and clean white assistant cards (`#FFFFFF`, border `#EAE6DC`, text `#2C2A24`).
3. **Tabler Icons Integration (`@tabler/icons-webfont`):** Integrated Tabler icons webfont CDN in `index.html`, replacing plain emojis with crisp vector icons (`ti ti-robot`, `ti ti-microphone`, `ti ti-paperclip`, `ti ti-arrow-up`, `ti ti-eraser`, `ti ti-settings`, `ti ti-database`, `ti ti-check`).
4. **Bottom Input Bar:** White `#FFFFFF` bar with centralized input pill (`#F7F5F0`, border `#EAE6DC`, `max-width: 900px`), transparent input field (`14.5px`), microphone, paperclip attachment, and gold square send button (`#C9922E`).

## Decision #36 — AI Mascot Identity "Günlü" & Live Animated Mascot Component Integration (2026-07-31)

1. **AI Assistant Mascot Identity ("Günlü"):** The user selected **Günlü** as the official mascot identity for AKGÜN AI Assistant. Updated `aiContext.js` system prompt so the AI identifies as *"Günlü"* across all interactions.
2. **Live Animated Mascot Component (`MascotAvatar.jsx` / `MascotAvatar.css`):**
   - Created a custom vector animated mascot creature SVG component (`<MascotAvatar />`) replacing static icons.
   - **Live Animations:** Smooth 3.5s vertical floating movement (`mascotFloat`), realistic 4.2s eye blinking (`eyeBlink`), golden glow ring pulsing behind the body (`glowPulse`), antenna sparkle tip (`antennaSparkle`), and ear twitching (`earTwitchL`/`earTwitchR`).
   - **Thinking / Analyzing State (`is-typing`):** When the AI is processing queries/files, Günlü enters a high-energy bounce and golden glow pulsing animation state.
3. **App-wide UI Wiring:** Integrated `<MascotAvatar />` across `AiChatPage.jsx`, `AiChatPanel.jsx`, `ChatMessage.jsx`, `Sidebar.jsx`, and `TopBar.jsx`.

## Decision #37 — Live Card-Based Contextual AI Speech Bubble (`CustomerAiBubble`) (2026-07-31)

1. **Removal of Static Fixed Bottom Floating Button:** The permanent fixed button at the bottom right corner was removed (`display: none` for `.floating-ai-trigger` in `AiChatPanel.css`), transitioning the AI assistant from a static chatbot into a 100% dynamic, card-bound mechanism.
2. **Contextual Live Customer AI Speech Bubble (`CustomerAiBubble.jsx` / `CustomerAiBubble.css`):**
   - Built `<CustomerAiBubble />` featuring live animated **Günlü** mascot avatar (`<MascotAvatar size="small" />`).
   - Automatically computes live financial insights for any clicked customer: Net Balance, Risk Level (Low/Medium/High), Realized Payment Days (DSO 6-Month Trend), and **Günlü's Smart Recommendation** (e.g. suggesting specific partial payment amounts before new shipments).
   - **Interactive Quick Action Chips:** One-click actions for `💵 Tahsilat Ekle`, `📊 Trend Analizi`, and `📄 Ekstre İncele`.
   - **In-Bubble Natural Language Q&A Bar:** Users can ask any specific question about the selected customer directly inside Günlü's speech bubble.
3. **Integration Across Dashboard & Cari Management:** Added `<button className="btn-gunlu-card-trigger">` with animated mascot icon on customer cards in `DashboardPage.jsx` and inside statement headers in `CariPage.jsx`.

## Decision #38 — Revert Card-Bound AI Popovers & Restore Original AI Panel Trigger (2026-07-31)

1. **Reverted Customer Card AI Popovers:** At the user's explicit instruction (*"eski düzene geri dön sevmedim değişiklikleri iptal et"*), removed the experimental `<CustomerAiBubble />` overlays and customer card trigger buttons from `DashboardPage.jsx` and `CariPage.jsx`.
2. **Restored Fixed Floating Bottom Button:** Re-enabled `.floating-ai-trigger` styling in `AiChatPanel.css` and restored standard trigger button in `AiChatPanel.jsx`.
3. **Preserved User Custom Upload Logic:** Preserved the user's manual edit in `AiChatPanel.jsx` that processes general Excel uploads (`readExcelFile` / `rawExcelCache`) without forcing predetermined template keys.

## Decision #39 — Integrated Günlü Mascot Avatar on Floating Trigger Button (2026-07-31)

1. **Floating Trigger Avatar:** Replaced generic robot icon inside `.floating-ai-trigger` in `AiChatPanel.jsx` with the live animated `<MascotAvatar size="small" />` component.
2. **Visual Consistency:** Floating trigger button in the bottom right corner now displays **Günlü** with live animated floating, blinking, and glowing effects.

## Decision #40 — Transparent Living Character Mascot & Proactive Anime Speech Bubble (2026-07-31)

1. **Transparent Living Mascot (No Circle Background):** Removed solid golden background, white border ring, and button box shadow from `.floating-ai-trigger` (`.transparent-living-mascot`). **Günlü** is now rendered directly on the screen as a transparent, standalone 3D-feeling living creature mascot with a soft aura and shadow.
2. **Proactive Anime Speech Bubble (`.anime-speech-bubble`):**
   - Created a manga/anime style speech bubble floating right above Günlü's head.
   - Automatically rotates fun, pro-active financial insights, hints, and greetings (e.g. *"👋 Selam! Ben Günlü..."*, *"💡 Merak ettiğin bir cari veya fatura varsa üzerime tıklayabilirsin."*).
   - Designed with rounded white card layout, dark border, and pointer tail pointing down to Günlü.

## Decision #41 — Dynamic Live Executive Financial Commentary in Anime Speech Bubble (2026-07-31)

1. **Real-Time Data Integration:** Replaced static tips in Günlü's anime speech bubble with a dynamic financial commentary engine (`refreshFinancialComments` in `AiChatPanel.jsx`).
2. **Proactive Financial & Risk Alerts:**
   - **Company Net Balance:** Automatically calculates company-wide net receivables and active customer count (e.g. *"📊 Bayi Toplam Net Alacak: ₺4.850.200 (142 Aktif Cari)"*).
   - **High-Risk Customer Identification:** Identifies customer with highest balance & overdue days (e.g. *"⚠️ Gecikmiş Risk Uyarısı: Munzur Cafe bakiyesi ₺45.200 (60 gün vade aşımı)"*).
   - **Collection Volume & Secondary Risk Alerts:** Displays total collection volume and secondary account risks.
3. **Data Subscription Listener:** Subscribed to `subscribeDataChange` so whenever Excel files are uploaded or manual entries are made, Günlü's anime speech bubble commentary updates immediately.

## Decision #42 — Fixed ReferenceError & Scaled Compact Mascot & Window Dimensions (2026-07-31)

1. **Bug Fix (`showRulesModal`):** Restored missing `showRulesModal` state declaration in `AiChatPanel.jsx`, resolving runtime `ReferenceError: showRulesModal is not defined`.
2. **Compact Mascot & Floating Window Scaling:**
   - Reduced Günlü mascot avatar size from `hero` (84px) to `large` (52px) for proportional, non-intrusive floating appearance.
   - Scaled floating chat popup window to compact dimensions (`width: 420px; height: 560px`).
3. **Zero Token Overhead Confirmation:** Re-confirmed that all live executive financial summary calculations and anime speech bubble rotation execute 100% locally on the browser client (JS / IndexedDB) with zero Gemini API token consumption.

## Decision #43 — Executive Wide Floating Chat Window Standardized on Desktop (2026-07-31)

1. **Desktop Standard Dimension Standardization:** Updated `.floating-ai-window` in `AiChatPanel.css` so that the default standard size on desktop displays is the spacious executive wide layout (`width: 760px; height: 640px; max-width: calc(100vw - 48px);`) matching `akgun_ai_panel_wide_layout.html`.
2. **Mobile Responsiveness Preserved:** Maintained media queries (`@media (max-width: 768px)`) so that on mobile preview devices, the chat window automatically adapts to full mobile width (`width: auto`).

## Decision #44 — Current Month (Bulunulan Ay) Executive Financial Commentary Focus (2026-07-31)

1. **Current Month Focus:** Updated Günlü's proactive financial commentary engine (`getCurrentMonthMetricsSync` in `customerService.js` and `refreshFinancialComments` in `AiChatPanel.jsx`) so that executive summaries and risk alerts focus specifically on **Bulunulan Ay / Current Month (e.g. Temmuz 2026)** metrics:
   - **Current Month Invoiced Sales & Collections** (e.g. *"📅 Temmuz 2026 Özeti: Bu ay ₺284.700 satış faturalandı, ₺199.500 tahsil edildi."*)
   - **Current Month Collection Ratio / Performance** (e.g. *"⚡ Temmuz Tahsilat Başarısı: Bu ay satışların %70 kadarı tahsil edildi."*)
   - **Current Month Overdue Risk Alert** (e.g. *"⚠️ Temmuz Risk Uyarısı: Görkem Gıda bakiyesi ₺45.200 (62 gün vade aşımı). Bu ay takip önerilir!"*)
2. **System Prompt Update:** Updated `aiContext.js` system prompt to include Current Month metrics in Günlü's active system prompt.

## Decision #45 — 2 Consecutive Unpaid Invoices & Weekly Overdue Shipment Detection (2026-07-31)

1. **Consecutive Unpaid Invoicing Detection (`CONSECUTIVE_UNPAID_INVOICES`):**
   - Implemented automatic detection in `getAdvancedExecutiveInsightsSync()` for customers who receive **2 consecutive sales invoices without any intermediate collection**.
   - Specifies exact day intervals between invoices and total unpaid days (e.g. *"⚠️ Üst Üste Tahsilatsız Fatura Uyarısı: Görkem Gıda firmasına tahsilat alınmadan 2 fatura üst üste bırakıldı! (14 gün arayla kesildi, 21 gündür borç ödenmedi, Borç: ₺45.200)"*).
2. **Weekly Overdue Shipment Risk (`WEEKLY_OVERDUE_SHIPMENT`):**
   - Detects accounts with balances overdue for 7+ days that received new invoices within 1-week periods (e.g. *"🔴 Haftalık Riskli Sevkiyat Uyarısı: Altun Bakkal firmasının 18 günlük ödenmemiş bakiyesi varken 3 gün önce ₺12.500 tutarında yeni fatura bırakıldı!"*).
3. **Live Sync:** Integrated directly into Günlü's proactive anime speech bubble rotator in `AiChatPanel.jsx`.

## Decision #46 — Dynamic N-Consecutive Unpaid Invoice Chain Counting Algorithm (2026-07-31)

1. **Dynamic Consecutive Count (2, 3, 4, N Invoices):** Updated `getAdvancedExecutiveInsightsSync()` in `customerService.js` to dynamically compute the exact length of consecutive unpaid invoice chains (`consecutiveCount`). It is not restricted to 2 invoices; it dynamically detects 2, 3, 4, 5+ consecutive sales invoices issued without any intermediate collection.
2. **Dynamic Wording & Days Calculation:**
   - Formats exact chain length and time range: *"⚠️ **Üst Üste Tahsilatsız Fatura Uyarısı:** **{Müşteri Adı}** firmasına tahsilat alınmadan **{consecutiveCount} fatura üst üste bırakıldı!** ({daysDiff} günlük süreçte, {daysAgo} gündür borç ödenmedi, Borç: **{Net Borç}**)"*.
3. **User Manual Integration Preserved:** Preserved user's manual additions in `ChequeSenetModal.jsx` (`CopyBadge` component on document numbers and `c.status || 'PORTFOY'` risk filter checks).

## Decision #47 — Sales Representative (Plasiyer) Month-to-Date Categorization & Leadership Engine (2026-07-31)

1. **Sales Rep Month-to-Date Performance Engine (`getMonthlySalesRepPerformanceSync`):**
   - Implemented `getMonthlySalesRepPerformanceSync()` in `customerService.js` to calculate sales volume, collection volume, assigned customer count, and open receivables breakdown grouped by Sales Representative / Plasiyer (e.g. `ALİ YÜKSEL`, `ALI DEMİR`, `CAN AYDOGAN`).
2. **Sales Rep Risk Tagging (`salesRepName` in Alerts):**
   - Attached Sales Representative names directly to all operational alerts (e.g. *"⚠️ Tahsilatsız Fatura Uyarısı [Plasiyer: ALİ YÜKSEL]: Görkem Gıda firmasına tahsilat alınmadan 3 fatura üst üste bırakıldı!"*).
3. **Günlü & System Prompt Integration:**
   - Rotates Sales Representative Month-to-Date leadership in Günlü's proactive anime speech bubble and includes rep-level breakdowns in `aiContext.js` system prompt.

## Decision #48 — Historical Sales Representative Month-over-Month Performance Engine (2026-07-31)

1. **Historical Month Comparison Engine (`getHistoricalSalesRepPerformanceSync`):**
   - Implemented `getHistoricalSalesRepPerformanceSync(targetYM, compareYM)` in `customerService.js` to calculate and compare sales rep performance across any past months (e.g., Temmuz 2026 vs Haziran 2026).
2. **Month-over-Month Growth Metrics:**
   - Computes MoM Sales Growth % (`salesGrowthPct`), Sales Difference Amount (`salesDiffAmount`), Collection Growth % (`colGrowthPct`), and Collection Difference Amount (`colDiffAmount`) for every sales representative.
3. **Proactive Anime Speech Bubble Growth Insights:**
   - Integrated growth insights into Günlü's speech bubble rotator (e.g. *"📈 Plasiyer Aylık Büyüme: ALİ YÜKSEL geçen aya (Haziran 2026) kıyasla satışlarını +%18.5 artırarak ₺145.200 ciroya ulaştı!"*).
4. **User Dashboard Additions Preserved:** Preserved user's manual additions to `DashboardPage.jsx` (`CustomerStatementModal` import, state, and modal trigger button).

## Decision #49 — Dedicated Month-Based Risk & Revenue Calculation Engine & Multi-Rule AI Intelligence (2026-07-31)

1. **Dedicated Monthly Risk & Revenue Calculation Tool (`getMonthlyRiskAndRevenueReport`):**
   - Implemented `getMonthlyRiskAndRevenueReportSync({ year, month, query })` in `customerService.js` and registered as an AI function tool in `aiTools.js`.
   - Computes month-specific Sales Revenue, Collected Volume, Collection Success Ratio (%), Net Unpaid Monthly Accrual, and Top Risky Accounts for any target month (e.g. Temmuz 2026, Haziran 2026).
2. **Explicit User Directive Scoping:**
   - Kept this detailed Month-based Risk & Revenue calculation **OFF** Günlü's proactive anime speech bubble (per explicit user directive) and reserved it for full chat & floating AI queries.
3. **Enhanced AI System Prompt & Multi-Rule Guidance:**
   - Added Rule 11 (Monthly Risk & Revenue) and Rule 12 (Historical Sales Rep MoM Performance) to `aiContext.js` system prompt to guarantee fluent, accurate, multi-rule executive reporting in response to any query.

## Decision #50 — Live Filter-Driven Contextual AI Speech Bubble Synchronization (2026-07-31)

1. **Dashboard Active Filter Event Bus (`setDashboardActiveFilters` / `subscribeDashboardFilters`):**
   - Implemented an event subscription system in `customerService.js` that tracks active page filters (`repFilter`, `searchQuery`, `riskFilter`) in real time.
2. **Contextual Anime Speech Bubble Commentary Scenarios:**
   - **Sales Representative Filter Active (e.g. `HASAN AKEL` / `ALİ YÜKSEL`):** Günlü's proactive anime speech bubble automatically focuses on that specific representative's portfolio total, month-to-date sales/collections, overdue risk accounts, and consecutive unpaid invoice alerts.
   - **Customer Search Active (e.g. `PALMİYE BAR` / `5000080428`):** Günlü switches speech bubble commentary to that specific customer's balance, average vade, assigned representative, location, and risk alerts.
   - **Risk Filter Active (e.g. `Riskli 30k+`):** Günlü switches to High Risk group analytics.
   - **No Filter (Global View):** Rotates company-wide executive metrics and sales rep MoM leadership.
3. **User Table Style Changes Preserved:** Preserved user's custom modal table styling in `DashboardPage.css` (`.popup-table` dark header `#0F172A` with zebra striping `#F8FAFC`).

## Decision #51 — Open Modal Customer Priority Synchronization for Günlü Speech Bubble (2026-07-31)

1. **Active Modal Customer Tracking (`modalCustomer`):**
   - Updated `DashboardPage.jsx` to pass `modalCustomer` (`selectedCustForStatement`, `selectedCustForAnalysis`, `selectedCustForChequeModal`, `selectedCustForModal`) to `setDashboardActiveFilters()`.
2. **Top Priority Speech Bubble Commentary (`SCENARIO 0`):**
   - Updated `refreshFinancialComments()` in `AiChatPanel.jsx` to give **absolute top priority** to the currently opened modal customer (e.g. `AĞUŞ BAKKALİYESİ`).
   - When a user opens any customer popup/statement modal, Günlü's proactive speech bubble instantly switches to that customer's balance (`₺23.524,86`), average vade (`11 Gün`), sales representative (`ALTUĞ AKSU`), and risk status, completely overriding company-wide general comments!

## Decision #52 — Dynamic Mascot Modal Jump Animation & Attached Positioning (2026-07-31)

1. **Dynamic Mascot Position Jump (`.modal-active`):**
   - Added `.modal-active` CSS state to `.floating-ai-container` in `AiChatPanel.jsx` when any customer popup or statement modal is opened (`hasActiveModal`).
2. **Spring Jump Animation (`@keyframes mascotModalJump`):**
   - When a user opens a customer modal (e.g., `ÖKTEN BAKKAL` or `AĞUŞ BAKKALİYESİ`), Günlü's living mascot avatar **playfully jumps** from the bottom-right corner up to the **top-right corner right beside the open customer modal window** (`top: 140px; right: calc(50vw - 420px)`), matching the user's painted diagram instructions.
3. **Smooth Return:** When the modal is closed, Günlü smoothly jumps back down to standard floating position (`bottom: 24px; right: 24px`).

## Decision #53 — Interactive Customer Modal Trigger from Speech Bubble & Hover Pause (2026-07-31)

1. **Interactive Speech Bubble Customer Trigger (`triggerOpenCustomerModal`):**
   - Attached structured customer objects (`customer`) to financial comments in `AiChatPanel.jsx`.
   - When Günlü's speech bubble mentions an alert for a customer (e.g. `AKIN MARKET` — 4 consecutive unpaid invoices, `₺318.851,50`), clicking the speech bubble or clicking the new *"🔍 AKIN MARKET — Açık Faturaları & Vadeyi Gör ➔"* action hint bar **INSTANTLY OPENS that customer's Open Invoices & Vade Modal (`selectedCustForModal`)** on the dashboard.
   - The mascot avatar simultaneously jumps to sit right beside that customer's open modal card!
2. **Hover Pause & Relaxed Rotation Pace:**
   - Added hover detection (`isBubbleHovered`). Hovering over the speech bubble pauses the rotation timer so the user can read without it switching away.
   - Increased auto-rotation timer from 10 seconds to **18 seconds** for a much more comfortable, relaxed reading speed.


## Decision #54 — Universal Copy-to-Clipboard Component (`CopyBadge`) (2026-07-31)

1. **Reusable `CopyBadge` Component:**
   - Implemented `src/components/common/CopyBadge.jsx` with dual-layer copy mechanism (`navigator.clipboard.writeText` + `document.execCommand('copy')` fallback) to guarantee clipboard copy functionality across all browsers, HTTP/HTTPS contexts, and embedded webviews.
2. **Prominent Mini-Button Styling:**
   - Designed with clear background (`#F1F5F9`), solid border (`#CBD5E1`), hover lift animation (blue `#2563EB`), and green success state (`#10B981`) with "✓ Kopyalandı!" tooltip.
   - Includes `.copy-badge-ghost` variant for seamless dark-header pill integration.

## Decision #55 — Customer Statement Modal (`CustomerStatementModal`) & Modal Re-architecture (2026-07-31)

1. **Dedicated Customer Statement Modal:**
   - Created `src/components/modals/CustomerStatementModal.jsx` to list all historical customer transactions (Sales Invoices, Collections, Credit Notes) in chronological order with running cumulative balance (`bakiye (B/A)`).
2. **Interactive Header Sorting & Live Filters:**
   - Added clickable table headers (`th`) for sorting across all columns (Date, Type, Doc No, Debit, Credit, Balance) with 🔼 / 🔽 direction indicators.
   - Added integrated single-level search bar and transaction type filter dropdown (`SATIŞ`, `TAHSİLAT`, `ALACAK DEKONTU`).
3. **Modal Button Placement:**
   - Moved the "📄 Ekstre" button directly into the "Açık Faturalar & Vade Durumu" modal header right next to the Customer Code pill.
   - Simplified `CustomerAnalysisModal.jsx` by removing redundant chart bars, keeping 4 clean KPI cards and AI risk insights.

## Decision #56 — High-Contrast Table Styling & Field Separation (`.popup-table`) (2026-07-31)

1. **Dark Slate Sticky Header (`#0F172A`):**
   - Redesigned `.popup-table th` with deep dark slate background, crisp white uppercase typography, and distinct right border lines (`border-right: 1px solid #1E293B`) to clearly separate column fields.
2. **Cell Boundaries & Zebra Striping (`.popup-table td`):**
   - Added explicit vertical cell borders (`border-right: 1px solid #F1F5F9`), horizontal grid lines (`border-bottom: 1px solid #E2E8F0`), and zebra striping (`tbody tr:nth-child(even) td` -> `#F8FAFC`) to eliminate floating text and ensure high visual contrast across all tables.

## Decision #57 — Core 4-Pillar Development Standard (Desktop, Mobile, AI Integration, Shared Formulas) (2026-08-01)

Every feature, page, module, or report built or modified MUST strictly satisfy the following 4 core pillars:

1. **Masaüstü Uyumluluğu (Desktop Ergonomics):**
   - High-density desktop layouts, grid alignment, hover states, interactive modals, high-contrast tables.
2. **Mobil Uyumluluk (Mobile Responsiveness):**
   - Every page and component MUST have explicit `@media (max-width: 768px)` mobile styles!
   - Responsive single-column grid collapses, full-width inputs, touch-friendly tap targets, scrollable filter bars, no horizontal overflow (`overflow-x: hidden`).
3. **Eksiksiz Yapay Zeka Asistanı Entegrasyonu (Full AI Query Coverage):**
   - Whenever a new feature, page, or report is introduced, ALL possible natural language query variations regarding that feature (dates, customer names, sales reps, unpaid status, comparisons, historical trends) MUST be registered as tools in `aiTools.js` and added to `aiContext.js` system prompt.
4. **Çift Yönlü Formül ve Hesaplama Mimarisi (Shared Formula & Calculation Engine):**
   - UI Panel and AI Assistant MUST execute the EXACT SAME underlying calculation functions from `customerService.js` and `cariCalculations.js`. Zero mathematical discrepancy or floating point drift between what is rendered on screen and what Günlü (AI) reports.

## Decision #58 — Fatura Kontrol Module & Date-Filtered Customer Statement Integration (2026-08-01)

1. **Date-Filtered Invoice & Collection Tracking (`/fatura-kontrol`):**
   - Implemented `FaturaKontrolPage.jsx` and `getInvoiceControlDataSync(dateStr)` in `customerService.js`.
   - Strict Filtering Rule: Only customers with at least 1 sales invoice (`FATURA > 0`) on the selected date are rendered.
   - Preserved standard `cust-card` layout matching `DashboardPage.jsx` (Customer Name, Customer ID • Rep Name, Vade Pill Badge, Net Balance, Location, and `Detay ↗` button).
   - Embedded 3-column stats row (`FATURA`, `TAHSİLAT`, `ÖNC. GÜN TAHS.`) directly beneath main balance.
   - Paged initial rendering with 18 cards and "Daha Fazla Göster" load-more button.
2. **Context-Aware Statement Modal Opening:**
   - When clicking "Detay ↗" on a date-filtered card (e.g., `30.07.2026`), `CustomerStatementModal` opens with pre-applied date range (`29.07.2026 – 30.07.2026`) matching the selected date and 1 day prior.
3. **AI Tool Integration (`getInvoiceControlReport`):**
   - Registered `getInvoiceControlReport` in `aiTools.js` and system prompt in `aiContext.js` to handle queries like *"X temsilcinin 17 temmuz faturaları"* and *"16 temmuzda tahsilat alınmayan müşteriler"*.

## Decision #59 — Master Gateway Decision & Intent Router Agent (2026-08-01)

1. **Master Gateway Intent Router Agent:**
   - Implemented a Master Router Agent at the very front of the AI tool selection pipeline in `getRelevantToolsForQuery` (`aiTools.js`).
   - For specific customer/date queries (e.g. *"efe tekel shop 28 temmuz faturası"*, *"boğaziçi market 29 temmuz fatura"*), the Gateway **strictly blacklists and removes `getGlobalHighestTransactions`** from the tool palette sent to Gemini.
   - Prevents Gemini from physically calling company-wide record tools when a customer/date-specific query is presented.

## Decision #60 — Self-Healing Dynamic Code Synthesizer (`executeDynamicAnalyticsQuery`) (2026-08-01)

1. **Sandboxed Dynamic Code Synthesis Engine:**
   - Implemented `executeDynamicAnalyticsQuerySync` in `customerService.js` and registered `executeDynamicAnalyticsQuery` tool in `aiTools.js`.
   - Allows the AI assistant to write and execute custom JavaScript analytical algorithms inside a sandboxed `Function` context over all raw dataset arrays (`mockSalesInvoices`, `mockCollections`, `mockCreditNotes`, `mockCustomers`, `mockCheques`, `getAgingBuckets`, `calculateBalance`, `getDaysOverdue`, `getOpenInvoices`, `getCustomerStatementSync`, `getInvoiceControlReportSync`, `getMonthlySalesRepPerformanceSync`).

## Decision #61 — Multi-Subagent Architecture & Dynamic Subagent Factory (`defineSubagent` / `invokeSubagent`) (2026-08-01)

1. **6 Built-in Multi-Subagent Personas:**
   - Pre-populated `dynamicSubagentsRegistry` with 6 specialized subagents (`researchSubagent`, `taskExecutionSubagent`, `visualDesignerSubagent`, `schedulerSubagent`, `dynamicFactorySubagent`, `interactiveAlignmentSubagent`).
2. **Runtime Subagent Definition & Invocation:**
   - Implemented `defineSubagent` and `invokeSubagent` tools in `aiTools.js` allowing Günlü to instantiate new specialized expert subagents at runtime.

## Decision #62 — Offline Fallback Overhaul & Turkish Unicode Normalization (`trNormalize`) (2026-08-01)

1. **Offline Fallback Trap Destruction:**
   - Overhauled `handleOfflineFallback` in `aiService.js`. Removed generic `query.includes('fatura')` condition that previously triggered `getGlobalHighestTransactions` (777 PUB DARWIN) whenever API timeouts occurred.
   - Specific customer and date queries now route directly to `getInvoiceControlReport` and `queryTransactions`.
## Decision #63 — TypeScript Migration & Cloud Database Readiness (2026-08-01)

1. **TypeScript Infrastructure & Configuration:**
   - Installed `typescript` devDependency. Added React 19 + Vite 8 compatible `tsconfig.json` and `tsconfig.node.json`.
2. **Type Models (`src/types/`):**
   - Defined strict interfaces for `Customer`, `CustomerMaster`, `AgingBucket`, `SalesInvoice`, `Collection`, `CreditNote`, `Cheque`, `TransactionRow`, `AiMessage`, `Attachment`, `ToolDeclaration`, `InvoiceControlReport`.
3. **Environment Security Readiness (.env.example):**
   - Protected `.env` files in `.gitignore` and added `.env.example` template with `VITE_GEMINI_API_KEY`, `DATABASE_URL` (PostgreSQL connection string), `VITE_FIREBASE_API_KEY`.

## Decision #64 — Date-Filtered Export Parameterization & Global Customer Statement Modal (2026-08-01)

1. **Query-Driven Date Range Extraction (`parseDateRangeFromQuery`):**
   - Implemented `parseDateRangeFromQuery` in `src/utils/exportUtils.js` to parse Turkish date expressions (e.g., *"1 temmuz - 31 temmuz"*, *"15 haziran - 10 temmuz"*) into ISO date ranges (`2026-07-01` to `2026-07-31`).
2. **Date-Filtered Corporate Exports (PDF, Excel, Statement Modal):**
   - Updated `triggerCustomerPDFPrintSync` and `triggerCustomerExcelExportSync` to accept `{ startDate, endDate }` options and filter transaction rows and period totals accordingly.
   - Updated `ChatMessage.jsx` to parse `startDate` and `endDate` query parameters from action button URLs (`https://action-pdf-5000078496?startDate=2026-07-01&endDate=2026-07-31`).
3. **Customer Statement Modal State Initialization Fix:**
   - Updated `CustomerStatementModal.jsx` to read `customer?.startDate` and `customer?.endDate` on mount, automatically pre-populating date input fields (`01.07.2026` — `31.07.2026`), setting date preset to `CUSTOM`, and filtering statement rows.
4. **Global Modal Mounting in `MainLayout.jsx`:**
   - Mounted `<CustomerStatementModal>` at top-level layout wrapper (`MainLayout.jsx`) subscribed to `subscribeOpenCustomerModal`, allowing the modal to open on any route (`/`, `/cari`, `/fatura-kontrol`, `/ai-asistan`).

## Decision #65 — AI Summary Key Alignment, Stream Timeout Fix & Keyboard/Outside Click UX (2026-08-01)

1. **Property Key Alignment in Financial Summaries:**
   - Added property aliases (`totalSales`, `totalSalesAmount`, `totalCollections`, `totalCollectionAmount`, `netReceivables`, `openInvoiceCount`, `portfolioAverageTerm`) across `getGlobalFinancialSummarySync` and `getCurrentStatusSync` in `customerService.js` and `aiTools.js`. Resolved all null/dash (`—`) and `undefined` field outputs.
2. **Stream Timeout Extension (Cut-off Prevention):**
   - Increased Gemini streaming timeout `withTimeout` from 15 seconds to 45 seconds (`45000ms`) and fixed `maxOutputTokens: 8192` in `aiService.js`, preventing long CFO analysis responses from cutting off mid-sentence.
3. **Space Key Shortcut & Outside Click Close:**
   - Added Spacebar (`Space` key) global event listener in `AiChatPanel.jsx` to open/close Günlü AI panel and focus input field (`textInputRef.current.focus()`), with safe guard for typing inside inputs.
   - Added outside click event listener (`containerRef`) to close Günlü AI panel when clicking empty background areas.

---

## Decision #66 — Administrative UI Element Conditional Visibility & Service Security (2026-08-01)

1. **Conditional UI Element Rendering (Read-Only vs Admin Mode):**
   - Updated `CariPage.jsx`, `ChequeSenetModal.jsx`, and `UploadModal.jsx` to hide all mutation controls (`+ Fatura Ekle`, `+ Tahsilat Ekle`, `⚖️ Virman Transferi`, `+ Evrak Ekle`, `Arşivi Temizle`, table `İşlem` header columns, 🗑️ trash delete icons, ✏️ edit icons) when `isAdminAuthenticated()` is `false`.
   - Normal view-only users see a clean, modern, read-only interface without interactive mutation buttons.
2. **Reactive Admin Session State (`subscribeAdminAuthChange`):**
   - Implemented `subscribeAdminAuthChange` listener pattern in `customRulesService.js` to broadcast Admin login/logout events across all mounted React components in real time.

---

## Decision #67 — Multi-Format ID Matching & Fallback Record Upsert in Cheque/Senet Updates (2026-08-01)

1. **Multi-Format ID & Document Number Matcher:**
   - Updated `updateManualCheque` and `deleteManualCheque` in `customerService.js` to match records across all possible primary key formats (`id`, `chequeId`, `docNo`, `${docNo}_${subNo}`, `${docNo}/${subNo}`).
   - Added secondary fallback matcher on exact `docNo` + `subNo` fields if primary ID lookup yields no index match.
2. **Fallback Upsert (Eliminating `null` Returns):**
   - If a record is not found in memory during `updateManualCheque`, the service automatically initializes, archives, and saves the new/edited record into memory and IndexedDB storage rather than returning `null`.
3. **Modal ID Resolution (`ChequeSenetModal.jsx`):**
   - Updated `handleSubmit` in `ChequeSenetModal.jsx` to resolve item ID as `editingItem.id || editingItem.chequeId || `${editingItem.docNo}_${editingItem.subNo}` || editingItem.docNo`.

---

## Decision #68 — Automatic Chat Excel File Detection & Customer Master Import Integration (2026-08-01)

1. **Auto-Detection Pipeline Alignment in Floating Chat Panel (`AiChatPanel.jsx`):**
   - Updated `AiChatPanel.jsx` Excel attachment handler to execute `detectFileType(file)` and trigger `processFile(file, typeKey)` automatically for `MUSTERI_MASTER`, `SATIS`, `TAHSILAT`, `CEK`, and `SENET` files.
   - Automatically executes Müşteri Master parsing (`parseCustomerMaster`), Migros 6-digit exclusion, and IndexedDB/Memory upsert (`archiveCustomers`), rendering the full breakdown report directly in the chat message.

---

## Decision #69 — Dedicated `importCustomerMaster` Tool & Multi-Message Excel Retention (2026-08-01)

1. **Dedicated AI Tool Registration (`importCustomerMaster` in `aiTools.js`):**
   - Added `importCustomerMaster` tool definition and execution handler to `aiTools.js` and registered it under `MUTATING_TOOLS` (requiring Admin auth).
   - Gemini AI can now directly execute `importCustomerMaster` when users type commands like *"carileri güncelle"*, *"veritabanında olmayan carilerin kaydını aç"*, or *"yeni carileri ekle"*.

---

## Decision #70 — Empty Query Customer Search Safeguard on File Attachments (2026-08-01)

1. **Attachment Prompt Guard in Fallback Routing (`aiService.js`):**
   - Updated `generateLocalFallbackResponse` in `aiService.js` to check if `userMessage` contains file attachment headers (`📎 Ekli Dosya:` or `Veritabanı İnceleme`).
   - Prevents `searchCustomers("")` from executing on empty/attachment-only prompts (which previously returned a table of all 1,782 database customers).
   - Automatically returns a structured File Import & Processing Report instead when attachment headers are detected.

---

## Decision #71 — Claude API Decommissioning & Pure Gemini AI Architecture (2026-08-01)

1. **Complete Removal of Claude API Provider:**
   - Decommissioned `providers/claude.js` and removed `@anthropic-ai/sdk` dependency.
   - Removed Claude model selection and budget tracking logic from `config.js` and `fallbackManager.js`.
2. **Pure Gemini AI Architecture Consolidation:**
   - The application operates 100% on Gemini multi-tiered models (`gemini-3.6-flash`, `gemini-3.1-flash-lite`, `gemini-2.0-flash`, `gemini-2.5-pro`) and the 7-key Node.js Backend Proxy (`http://localhost:3001`).
   - UI model dropdown retains only `⚡ Gemini (Varsayılan)` and `🔄 Oto Fallback (Çoklu Model)`.

---

## Decision #72 — Advanced `aiService.js` Integration (2026-08-01)

1. **Upgraded AI Service Layer to High-Performance Variant:**
   - Transferred optimized `test/aiService.js` to `panel/src/services/aiService.js`.
   - **Key Upgrades:**
     - `(model, key)` pair-based rate-limiting (`rateLimitedPairMap`).
     - Persistent 404 model blacklist in `localStorage` (`akgun_gemini_invalid_models_v1`, 7-day TTL).
     - Parallel tool execution using `Promise.all` (2-3x faster function calling).
     - Infinite tool-call loop protection via signature matching (`lastToolSignature`).
     - LLM hallucination interception guard for failed tool calls.

---

## Decision #73 — Automatic AI Chat History & Cache Purge on Window Close (2026-08-01)

1. **Automatic Purge on Close & Navigation Unmount (`AiChatPanel.tsx` & `AiChatPage.tsx`):**
   - Attached an `isOpen` transition detector (`prevIsOpenRef`) in `AiChatPanel.tsx` and an unmount cleanup effect in `AiChatPage.tsx`.
   - When the user closes the AI chat panel (X button, outside click, ESC key, or mascot toggle) or leaves the `/ai-asistan` route, the system automatically triggers `clearChat()`.
2. **Instant Memory & Storage Reclamation:**
   - `clearChat()` instantly purges the React message state, executes `localStorage.removeItem('akgun_ai_chat_history')`, clears `rawExcelCache` (uploaded raw Excel arrays), and resets `clearAiServiceCache()`.

---

## Decision #74 — Universal Hover Analytics & Corporate Debt-to-Collection Turnover Risk Engine (2026-08-01)

1. **Corporate Debt-to-Collection Turnover Risk Metric (`calculateCustomerDebtToCollectionRiskSync`):**
   - Implemented a financial risk formula measuring how many months of average collection capacity it would take a customer to liquidate their net outstanding balance:
     $$\text{Coverage Months} = \frac{\text{Açık Borç Bakiye}}{\text{Aylık Ortalama Tahsilat (Son 3-6 Ay)}}$$
   - **Risk Tiers:**
     - 🟢 **Düşük Risk ($\le 1.5$ Ay / $\le 45$ Gün):** Borç kısa sürede tahsilatla kapanabilir.
     - 🟡 **Orta Risk ($1.5 - 3.0$ Ay / $45 - 90$ Gün):** Yakın takip gerektirir.
     - 🔴 **Yüksek Risk ($> 3.0$ Ay / $> 90$ Gün veya Sıfır Tahsilat):** Sevkıyat durdurma / peşin ödeme planı tavsiyesi verilir.
2. **Universal Debounced (250ms) Hover Analytics Event Bus (`subscribeHoverAnalyticsData`):**
   - Implemented a unified event bus (`subscribeHoverAnalyticsData` / `emitHoverAnalyticsData`) in `customerService.ts`.
   - Hovering over any customer card, sales rep card, or financial metric card across Dashboard, Cari, or Fatura Kontrol pages dispatches dynamic CFO analytics (Net Borç, Vade Gün, Vade Aşımlı Risk, Tahsilat Dönüş Hızı / Coverage Months, and actionable risk advice) to the top HUD banner.

---

## Decision #75 — Decommissioning Automatic Comment Rotation Loop & Pure Module-Aware Hover Context (2026-08-01)

1. **Decommissioning Automatic Background Comment Rotation (`setInterval` Removal):**
   - Completely removed the 18-second background comment rotation timer (`setInterval` / `setCommentIndex`).
   - Günlü now operates on a 100% steady, non-distracting, pure context-aware architecture.

---

## Decision #76 — Deep Executive Hover Analytics, Current Month Focus & MoM Comparison Engine (2026-08-01)

1. **Current Month Focus for Collection Cards (`Alınan Tahsilat`, `Tahsilat Oranı`, `Tahsilat Dağılımı`):**
   - Replaced all-time cumulative database collection totals on Dashboard KPI metric cards and Tahsilat Donut Card with **Current Month Metrics** (`getCurrentMonthMetricsSync` & `getCurrentMonthChartDataSync`).
   - Cards display active month collections (e.g. `₺65.420.000,00` for Temmuz 2026) and active month collection ratios.

---

## Decision #77 — AI Chat Engine Integration for Deep Analytics & Debt/Collection Risk Tools (2026-08-01)

1. **Yapay Zeka Soruları İçin Tahsilat Dönüşüm Risk Aracı (`calculateCustomerDebtToCollectionRisk`):**
   - `calculateCustomerDebtToCollectionRisk` fonksiyonu `aiTools.ts` üzerine araç olarak tanımlandı ve `aiContext.ts` anayasasına eklendi.
   - Günlü AI artık *"Müşterilerin tahsilat dönüşüm risk durumu nedir?"*, *"Riskli müşteri kimdir?"*, *"Borcunu kaç ayda ödeyebilir?"* gibi sorular geldiğinde bu analitik aracı doğrudan çalıştırır.

---

## Decision #78 — Top Eye-Level Smart AI Insight HUD Banner & Zero-Stuck State Guarantee (2026-08-01)

1. **Elimination of Frozen / Stuck Hover Commentary Bug:**
   - Fixed `subscribeHoverAnalyticsData` callback in `AiChatPanel.tsx`.
   - When the user's cursor leaves a card (`hoverItem` is `null`), `setActiveHoverData(null)` and `setShowAnimeBubble(false)` trigger immediately, guaranteeing **0ms lingering or frozen speech bubble state**.

---

## Decision #79 — Enrichment of Top AI Insight HUD with Multi-Dimensional CFO Analysis (2026-08-01)

1. **Resolution of Blank Top HUD Subtitle Bug:**
   - Enriched `activeHoverData` payload in `AiChatPanel.tsx`'s `subscribeHoverAnalyticsData` listener.
   - Guaranteed `subtitle` and `advice` strings are generated and populated for all customer cards across all modules (Dashboard, Cari, Fatura Kontrol).

---

## Decision #80 — Decommissioning Bottom-Right Speech Bubble & Pure Top Eye-Level HUD Focus (2026-08-01)

1. **Decommissioning Bottom-Right Speech Bubble (`anime-speech-bubble`):**
   - Removed the floating speech bubble element from the bottom-right corner of the UI.
   - Eliminates layout clutter, overlapping elements, and redundant floating speech popups.
2. **Pure Eye-Level Top Insight HUD Consolidation:**
   - The Top Smart AI Insight HUD Banner (`ai-top-insight-hud`) now serves as the single, unified, high-contrast, eye-level commentary engine.
   - The mascot avatar at the bottom-right corner functions solely as a clean trigger to toggle the full interactive AI Chat window.

---

## Decision #81 — Full TypeScript Migration (`strict: true`) & Route Code-Splitting (2026-08-01)

1. **Tam TypeScript Dönüşümü (`strict: true`):**
   - Projedeki tüm `.js` ve `.jsx` kaynak dosyaları `.ts` ve `.tsx` formatına dönüştürüldü (0 adet düz JS dosyası bırakıldı).
   - Strict mod altında tip güvenliği sağlandı (`src/types/customer.ts`, `transaction.ts`, `ai.ts`).
2. **Route Code-Splitting (`React.lazy()` + `<Suspense>`):**
   - `DashboardPage`, `CariPage`, `FaturaKontrolPage` ve `AiChatPage` bağımsız chunk'lara bölündü (Vite build süresi 749ms'ye düşürüldü).
3. **Birim Test Genişletmesi (67/67 Passing):**
   - `customerService.test.ts` ve `archiveService.test.ts` genişletilerek toplam test sayısı 14 dosyada 67'ye ulaştı (%100 geçme oranı).

---

## Decision #82 — 5-Pillar Deep Invoice Analysis Engine (`calculateDeepInvoiceAnalysisSync`) (2026-08-01)

1. **5-Katmanlı Derin Fatura Analiz Motoru (`customerService.ts`):**
   - Fatura Kontrol modülündeki faturalar için 5 ana boyutta anomali ve risk taraması yapan `calculateDeepInvoiceAnalysisSync` geliştirildi:
     - 🔥 **All-Time Fatura Rekoru & Sıçraması (`RECORD_SPIKE`):** Fatura tutarı tüm zamanların rekoru veya geçmiş ortalamanın 2.0x+ üzerindeyse uyarır.
     - 🔴 **Tahsilatsız Fatura Zinciri & Vade Riski (`UNPAID_CHAIN`):** Gecikmiş borç varken aynı gün tahsilat kapatılmamışsa sevkiyat kısıtlama tavsiyesi sunar.
     - ⚠️ **Tahsilat Kapasitesini Aşan Fatura (`CAPACITY_BREACH`):** Tekil fatura müşterinin aylık ortalama tahsilat gücünün 1.5x+ katıysa ara ödeme takvimi bağlar.
     - 🟡 **Ödeme Alışkanlığı Sapması (`HABIT_DRIFT`):** Geçmişte %65+ peşin kapatan caride aynı gün ödeme 0 TL ise pos/tahsilat takibi uyarısı verir.
     - 🟢 **VIP Mükemmel Büyüme (`HEALTHY_GROWTH`):** Ortalama vadesi 0-10 gün olan carinin yüksek tutarlı faturasını güvenli ticari büyüme olarak işaretler.

---

---

## Decision #84 — Target-Attached Eye-Level AI Hover Tooltip & Light Ferah Theme Harmonization (2026-08-01)

1. **Göz Yorgunluğunu Sıfırlayan Akıllı Takip Popover'ı (`attached-eye-level-tooltip`):**
   - Sabit üst banner'ın kullanıcı odağını yukarı kaydırma ve gözü yorma problemi çözüldü.
   - Mouse hangi kartın (müşteri kartı, KPI kartı, Donut dilimi) üzerine gelirse `targetRect` (`getBoundingClientRect()`) üzerinden AI analizi **doğrudan o kartın 10px üstünde/altında** açılır.
2. **Akıllı Konumlandırma & Ekran Sınırı Koruması:**
   - Popover kartın üstünde yer yoksa otomatik olarak kartın altına geçer; ekran kenarlarından taşması engellenir.

3. **Uygulama Temasıyla %100 Görsel Uyum:**
   - Koyu zemin kaldırılıp uygulamanın açık krem/beyaz "Ferah" tasarım diline dönüştürüldü (Beyaz zemin `#FFFFFF`, `#8A6D1F` altın üst çizgi ve pulsing dot, `#FEF3C7` amber CFO tavsiye kutusu).

---

### Decision 82: Standardized CSS Utility Classes for Customer Detail Modals (`.modal-table-scroll`, `.data-table`, `.stat-strip`)

- **Context:** Detay pop-up modallarındaki (`CustomerInvoicesBody`, `CustomerStatementBody`) satır içi (inline) stiller ve dağınık yapı kod okunabilirliğini zorlaştırıyor ve tablonun yüksekliğini sabitlemek imkansız hale geliyordu.
- **Decision:** 
  1. `index.css` içerisinde `.modal-table-scroll`, `.data-table`, `.days-badge`, `.type-badge` ve `.stat-strip` isimli merkezi CSS utility sınıfları oluşturuldu.
  2. Modalların içindeki tablolar `max-height: 340px` sınırı ile ~6-7 satır görünecek kompakt yapıya getirildi; başlıklar `sticky` yapıldı.

  3. Tüm inline stiller temizlendi.
- **Consequences:** Modallar hem görsel olarak kusursuz hizalandı hem de performans/stil sürdürülebilirliği sağlandı.

---

### Decision 83: Customer Detail Modal V2 Styling Module & SVG Icon Library Integration (`CariModalV2.css`, `CariModalIcons.tsx`)

- **Context:** Müşteri detay modalındaki sekme içeriklerinin ve ikonların genel V3 Glass-morphism tasarım sistemiyle %100 uyumlu, yüksek kontrastlı ve modüler olması hedeflendi.
- **Decision:** 
  1. Detay modalına özel `CariModalV2.css` modülü ve `CariModalIcons.tsx` SVG vektör ikon kütüphanesi oluşturuldu.

  2. Tüm gövde bileşenleri (`CustomerInvoicesBody`, `CustomerStatementBody`, `CustomerAnalysisBody`, `ChequeSenetBody`) yeni V2 tasarım mimarisiyle güncellendi.
- **Consequences:** Modallar visual olarak üst seviyeye taşındı, testler 68/68 ve build 884ms ile başarıyla doğrulandı.

---

### Decision 84: Cheque/Senet Layout Clean-up & Alignment with Customer Detail Modal Standard (`ChequeSenetBody.tsx`)

- **Context:** Çek/Senet sekmesinde üst üste binen siyah çerçeveli kapsayıcılar (`cv2-toolbar`, `cv2-table-wrap`) ve ekstra başlık alanı, modülün geri kalanından kopuk ve hantal görünmesine sebep oluyordu.
- **Decision:** 
  1. `+ Manuel Çek/Senet Ekle` butonu üst aksiyon çubuğuna (`cv2-action-bar`) taşındı.
  2. Ekstra başlık ve iç içe geçen kutular kaldırıldı; arama ve vade filtresi tek bir kompakt `cv2-toolbar` altında birleştirildi.

  3. `Ekstre` ve `Faturalar` sekmeleriyle birebir aynı hizalama ve tasarım bütünlüğü sağlandı.
- **Consequences:** Görsel karmaşa çözüldü, tüm sekmeler arasında kusursuz bir tasarım akışı sağlandı.

---

### Decision 85: Removal of Cheque/Senet Filter Toolbar & Table View Extension (`ChequeSenetBody.tsx`, `CariModalV2.css`)

- **Context:** Kullanıcı 2. görseldeki arama/filtre araç çubuğunun gereksiz olduğunu belirterek kaldırılmasını ve boşalan alanın 3. görseldeki evrak tablosuna verilmesini istedi.
- **Decision:** 
  1. `ChequeSenetBody.tsx` içerisindeki `cv2-toolbar` bileşeni tamamen kaldırıldı.
  2. `CariModalV2.css` içerisindeki `.cv2-table-scroll` yüksekliği `max-height: 480px` değerine çıkarılarak tablo alanı genişletildi.
- **Consequences:** Modaldaki kalabalık giderildi, evrak tablosu daha geniş bir görüş alanına kavuştu.

---

### Decision 86: Customer Card (`.cust-card`) Lighting & Z-Index Refinement

- **Context:** Eski tasarımda `.cust-card` hover efektinde kullanılan `radial-gradient` ışık hüzmesi çok yoğun, puslu ve beyazdı. Z-index eksikliği nedeniyle metinlerin üzerini kapatıyor ve bulanık beyaz `text-shadow` ile birlikte okunurluğu bozuyordu.
- **Decision:** 
  1. Bulanık beyaz metin gölgesi (`text-shadow`) kaldırılarak, metinlerin tam beyaz (`#FFFFFF`) olması ve altlarına net, yüksek kontrastlı koyu bir gölge (`0 2px 8px rgba(0,0,0,0.6)`) atılması sağlandı.
  2. Hover anındaki ışık (spotlight) elektrik mavisine (`rgba(79, 140, 255, 0.12)`) çekildi ve `z-index: 0` verilerek yazıların **arkasında** kalması sağlandı (`.cust-card > *` öğelerine `z-index: 1` verildi).
  3. Kartın üst sınırındaki ince ışık çizgisi (`::before`), daha canlı bir mavi tonuyla güçlendirildi.
- **Consequences:** Modern, okunaklı, metni boğmayan ve V3 Glassmorphism sistemine uygun çok daha "güçlü" ve premium bir ışıklandırma elde edildi.









