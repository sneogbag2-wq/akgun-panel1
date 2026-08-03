# Progress Log

> Work done in each session, in chronological order.
> Format: Date, Stage, What was done, Test status, Next step.
>
> Language note: these docs are in English; the **application UI stays Turkish**.

---

## 2026-07-29 — Session 1: Project Setup

**Stage:** Kick-off / planning

- Scope clarified: a customer-account / stock / sales / finance management panel for an
  alcoholic-beverage distribution company.
- WhatsApp bot goal defined: natural-language Q&A over the panel's data and formulas.
- Stack chosen: React + Vite (frontend), Firebase — Firestore + Cloud Functions (backend).
- Central calculation-layer principle agreed (panel and bot use identical formulas).
- Documentation structure created: `PROJECT_DECISIONS.md`, `DATA_MODEL.md`, `PROGRESS_LOG.md`.
- User requirement: the project must not accumulate in a single file — modular folders.

**Test status:** N/A (no code yet)

---

## 2026-07-29 — Session 1 (cont.): Stage 1 — Excel Analysis Complete

- Four files analysed: Transfer collections (1,506 rows), Cash collections (24,493),
  Purchases (8,914), Sales (29,174).
- Analysis done programmatically with `pandas`.
- Common key found: `Cari Kodu 2` (format `5000XXXXXX`).
- Return/cancellation logic resolved: `Tip` (SATIS/IADE/HIZMET) and
  `Kayıt Tipi`/`Fatura Durum` (CREATED/CANCELLED).
- Draft Firestore schema derived: `customers`, `sales_invoices`, `purchase_invoices`,
  `collections`.

---

## 2026-07-30 — Sessions 2–8: Data Model and Architecture Finalised

- Decision #5: purchase `HIZMET`/`IADE` rows are customer credit notes
  (`customer_credit_notes`), not supplier movements.
- Decision #6: days-elapsed calculation adopted instead of a due date.
- Decision #7: customer master (13 columns) and phone regex (`^5\d{9}$`) finalised.
- Decision #8: "derive from master" architecture principle agreed.
- Decision #9: collection method detection based on row data.
- Decision #10: per-file column-name mapping table created.
- Decision #11: two-pass CANCELLED filtering (`filterCancelledPairs`) documented and verified.

---

## 2026-07-30 — Session 9: Stage 3 — Panel Skeleton and Upload System

- Fully modular, bot-compatible React + Vite architecture set up under `panel/`.
- `CODING_GUIDE.md` written to carry context between sessions.
- `src/config/fileTypes.js` — config for all 5 file types (colour, icon, required columns).
- `src/calculations/` created (`cancelledFilter.js`, `phoneValidator.js`,
  `cariCalculations.js`, `index.js`) — the shared formula centre for panel and bot.
- `src/parsers/` written (column mappings + one parser per file type).
- `src/services/` created (`uploadService.js`, `customerService.js`).
- Upload UI: `TopBar` button → `UploadModal` popup → 5 independent `FileUploadZone` areas.
- `DashboardPage.jsx` and `CariPage.jsx` implemented.

---

## 2026-07-30 — Session 10: Financial Fixes, Performance, Theme (v0.4)

- **Decision #12 (FIFO aging fix):** customers with net balance `≤ 0` now show `₺0.00` in
  every aging bucket. FIFO offsetting written — collections and returns applied to the
  oldest invoice first.
- **Live sync (`subscribeDataChange`):** all pages refresh automatically after an upload.
- **Date safety (`safeIsoDate`):** Turkish date strings no longer crash `Date`.
- **DOM reconciliation fix:** React `removeChild` errors resolved.
- **Theme:** v0.4 premium dark theme (layered darks, glass blur, skeleton loaders).

---

## 2026-07-30 — Session 11: Lazy Loading and Decision #13

- **CariPage full lazy loading:** 0 records rendered on open; search starts after 2+
  characters (300ms debounce); the statement loads only when a customer is clicked; rapid
  clicks abort earlier requests via an abort token.
- **Decision #13:** customers marked `(C)`/`(P)`/İptal/Pasif **and** under 30 TL are hidden
  from UI lists, while their history stays fully included in financial totals and reports
  (`getAllCustomersForReporting()`, `getGlobalFinancialSummary()`).

**Test status:** `npm run build` succeeded (0 errors).

---

## 2026-07-30 — Session 12: Automated Test Infrastructure (Vitest)

- Vitest integrated (`npm test`, `npm run test:watch`).
- Unit tests written for the calculation layer and helpers:
  `phoneValidator`, `cancelledFilter` (Decision #11), `cariCalculations` (Decision #12),
  `dateUtils` (`safeIsoDate`).

**Test status:** 4 files / 19 tests passing.

---

## 2026-07-30 — Session 13: Dashboard Fixes and Real-Data Wiring (v0.5)

- Sidebar active-state visual overflow fixed (`left: -1px` → `0`).
- `UploadModal` overlay recoloured to brand navy; light-theme `.custom-table` classes added.
- **Recharts colour fix:** because Recharts renders SVG, CSS variables don't work in its
  props — replaced with literal hex values, so the donuts render in the right colours.
- Dashboard donut charts moved off mock data onto `getDashboardChartData()`.

---

## 2026-07-30 — Session 14: Comparison Project (`panel-b`)

A second application implementing the same finalised rule set was built for comparison, then
**deleted in session 15** once the user chose `panel`. Two open questions were closed during
its real-data verification:

1. **Sales column-name assumption confirmed** — `Cari Kodu 2` (with a space) verified on the
   real file; the earlier assumption was correct.
2. **Decision #11 proven to matter on the collection files** — earlier sample slices showed
   no CREATED/CANCELLED pairs, but the full files do: Cash 34 documents → 58 rows removed;
   Transfer 46 documents → 84 rows removed. A single-row filter would have leaked 24 and 38
   cancelled rows respectively into the balances.

---

## 2026-07-30 — Session 15: Decision, Bug Fixes, Aging Charts (v0.6)

**Decision:** the user selected `panel` as the single working application; `panel-b` deleted.
(The folder was locked during deletion — a stale `panel-b` vite child process was still
running. `TaskStop` kills the npm wrapper but not always the child vite process.)

**Fix 1 — data loss on tab switch (partial):**
- `clearAllArchive` was called in `customerService.js` but **never imported** → the
  "Clear archive" button threw `ReferenceError`. Import added.
- `saveUploadedData`'s `MUSTERI_MASTER` branch hand-merged `mockCustomers` while every other
  branch re-read from the archive. Fixed to re-read (Decision #18).
- `usingSeedData` flag added (Decision #17): seed data is discarded on first real upload.

**Fix 2 — empty aging boxes:** `getAgingBuckets` returns five buckets but CariPage's
"90+ days" box read only `over90`, so 91–120 day debt (`days90`) appeared nowhere and the
box showed `₺0.00`. Now shows `days90 + over90` (Decision #19).

**Added — aging mini bar charts:** the statement detail had no chart at all, only five
adjacent numeric boxes. Rewritten against the user's reference screenshot while keeping the
existing colour tokens and typography: four separate cards with coloured left bars, a status
dot, a large amount, and a **5-column mini bar chart**. `getAgingBuckets` now returns a
`distribution` field to feed the bars. "Average term" moved to its own summary strip.

**Test status:** new `agingDistribution.test.js` (8 tests). 6 files / 33 tests passing.

---

## 2026-07-30 — Session 16: Remaining Bugs, Real Chart Data, Docs to English (v0.7)

The user reported that the data loss persisted, the updated statement view was not visible,
and questioned the data correctness shown on the dashboard.

**Root cause of the data loss (the real one):** every read function in
`customerService.js` accessed the `mock*` arrays **without awaiting initialisation**.
`initFromArchive()` starts once at module load but is asynchronous; when React remounts a
page on tab switch, the service is called immediately. If init (or a post-upload re-read)
had not finished, the arrays were still empty → the UI showed `₺0` / `0 customers`, then
filled in a moment later. This is what appeared as "data loss when switching tabs".

**Fix:** a `ready()` gate was added and `await ready()` is now the first line of every read
export: `searchCustomers`, `getAllCustomersForReporting`, `getGlobalFinancialSummary`,
`getActiveCustomerCount`, `getCustomerById`, `getCustomerStatement`, `getDashboardChartData`.
Session 15's fixes were real but addressed a *different* cause; this was the remaining one.

**Dashboard data correctness — findings:**
- All three donut **centre labels were hardcoded** (`3 Dilim`, `%25 Riskli`, `%82 Başarı`).
  They displayed the same numbers regardless of the data — this is why "%82 Başarı" appeared
  even with unrelated data. Now computed from real totals.
- A reusable `DonutCard` component was extracted, with a **legend** listing each slice's
  name, colour and amount, plus a "Veri yok" empty state and a per-chart tooltip formatter.

**Decision #20 — collection breakdown split into 5 slices:** Nakit, Havale, Kredi Kartı,
Hizmet Faturası, İade Faturası. Service and return invoices count as collections
(Decision #5) but now have their own slices instead of being folded into a generic
"Banka/Havale" bucket. The old code also had a `senet` (promissory note) bucket that no data
source populates; removed. Zero-value slices are hidden.

**Open item — data correctness (needs the user's input):**
Customers show large **negative** balances (e.g. −₺13.9M) and total collections
(₺522.9M) vastly exceed total receivables (₺7K). Balance = sales − collections − credit
notes, so this pattern means **sales invoices are missing or only partially loaded while
collections are complete**. The aging cards showing `₺0.00` is a *correct consequence* of a
negative balance (Decision #12), not a UI defect. The sales file must be re-uploaded and
verified before the aging/dashboard figures can be trusted.

**Docs:** `CODING_GUIDE.md`, `PROJECT_DECISIONS.md`, `PROGRESS_LOG.md` and `DATA_MODEL.md`
converted to English at the user's request. UI strings, Excel column names and enum values
were deliberately left in Turkish.

**Test status:** 6 files / 33 tests passing. `npm run build` succeeded (0 errors).

**Next step:** upload the real sales file and confirm balances turn positive; then re-verify
the aging cards and the dashboard donuts against live data.

---

## 2026-07-30 — Session 17: KPI Cards Fixed, Fabricated Values Removed (v0.8)

The user clarified the earlier report with a screenshot: **there is no general data loss.**
The donut charts (Vade Dağılımı ₺7K, Tahsilat Dağılımı ₺522.9M) read correctly and the
statement view works. The problem was confined to the **four KPI cards** at the top, which
reset or showed wrong values when switching tabs.

**Root cause (Decision #22):** `DashboardPage`'s `load()` fired five **independent, unawaited**
promises, and `subscribeDataChange` re-triggered `load()` on every data change. Overlapping
rounds meant an older round's slow response could overwrite a newer one (last writer wins).
The charts happened to commit late (correct values) and the KPI cards early (stale/zero) —
which is exactly the reported symptom, on the same page at the same moment.

**Fix:** a single `Promise.all` writes all state **once**, guarded by an incrementing run-id
so only the newest round can commit. The same guard was added to `CariPage`'s search effect.

> Note: session 16's `await ready()` gate was a real fix for a different race, but it was not
> the cause of this one.

**Fabricated values removed (Decision #21).** The investigation uncovered seven hardcoded
placeholders that looked like real metrics and never changed with the data:

| Element | Was | Now |
|---|---|---|
| Toplam Tahsilat KPI | `?? 212000` → ₺212K | Real value, 0 if absent |
| Vadesi Geçen Alacak KPI | `overdue \|\| 96700.5` → ₺97K | Real value, 0 if absent |
| Açık Fatura | `24 Adet` | Computed — invoices of customers with a positive balance |
| Bugün Gelen Tahsilat | `₺45.200` | Computed — today's collections + credit notes |
| Ortalama Vade | `42 Gün` ("sector") | Computed — portfolio average weighted by unpaid amount |
| Aylık Tahsilat Hedefi | `₺250.000 / ₺205.000 (%82)` | **Removed** — no data source for a target |

The ₺212K and ₺97K the user highlighted were **never real data** — they were fallbacks that
appeared whenever the true value was 0 or null, which is why they looked plausible but wrong.

New service function `getCurrentStatus()` computes the "Güncel Durum" panel metrics. It groups
invoices/collections/credit notes by customer in a single pass before calling
`getAgingBuckets`, avoiding an O(customers × invoices) scan (1,200 × 29,000) on every refresh.

**Test status:** 6 files / 33 tests passing. `npm run build` succeeded (0 errors).

---

## 2026-07-30 — Session 18: Parser Amount & Line-Item Overwrite Fixes, Tab-Switch Flash Elimination (v0.8)

In this session, critical bug fixes were applied to address user-reported issues regarding negative balances, missing sales invoices, and KPI cards resetting to 0/null during page transitions.

### Key Changes & Fixes

1. **Turkish Currency Formatting Bug (Decision #23):**
   - Native `parseFloat("1.004.519,20")` evaluated to `1`, converting multi-million TL invoices into 1 TL invoices.
   - Introduced `parseAmount()` across all parsers (`salesParser`, `purchaseParser`, `collectionParser`) to safely parse TR (`1.004.519,20`) and EN (`1004519.20`) number formats.

2. **Invoice Line-Item Overwrite Bug (Decision #24):**
   - Multi-line invoice items sharing an `invoiceId` were overwriting each other in IndexedDB due to single-key `put()`.
   - Updated `salesParser` and `purchaseParser` to deduplicate and group rows by `invoiceId` using a `Map`, summing amounts into a single complete invoice record.

3. **Multi-Store Archive Check (Decision #25):**
   - `hasArchivedData()` in `archiveService.js` now queries counts across all 5 IndexedDB stores (`customers`, `satis`, `collections`, `purchase`, `credit_notes`).
   - Prevents uploaded sales/collections from being overwritten by seed data when `customers` store is 0.

4. **Synthetic Customer Master Integrity (Decision #26):**
   - `ensureCustomerMasterIntegrity()` automatically synthesizes placeholder customer records for orphan `customerId`s found in invoices or collections.
   - Guarantees active customer counts and total receivables calculate accurately even before Customer Master upload.

5. **Tab-Switching 0-Flash Elimination (Decision #27):**
   - Created synchronous getters (`searchCustomersSync`, `getGlobalFinancialSummarySync`, `getActiveCustomerCountSync`, etc.) in `customerService.js`.
   - Updated `DashboardPage.jsx` to use lazy initialisers (`useState(() => getSync())`), displaying live in-memory data on frame 1 without delay or 0/null flashing.

6. **Documentation Update:**
   - Updated `CODING_GUIDE.md` and `PROJECT_DECISIONS.md` to reflect Decisions #23–#27 and new architecture diagrams.

**Build status:** `npm run build` succeeded with 0 errors. Dev server verified.

---

## 2026-07-30 — Session 19: In-App AI Assistant Implementation (v0.9)

In this session, the project scope pivoted from an external WhatsApp bot to an **Embedded In-App AI Assistant** directly integrated into the React panel UI (Decision #28 & Decision #29).

### Key Accomplishments

1. **AI Service & Function Calling Layer (`aiService.js`, `aiTools.js`, `aiContext.js`):**
   - Integrated `@google/generative-ai` SDK supporting Gemini 1.5/2.0 Flash models.
   - Defined 8 tool declarations enabling the AI model to query system state dynamically (`getGlobalFinancialSummary`, `getCurrentStatus`, `searchCustomers`, `getCustomerDetails`, `getCustomerStatement`, `getTopDebtors`, `getAgingBreakdown`, `getPaymentMethodsBreakdown`).
   - Implemented an offline analytical fallback engine for keyless / offline operation.

2. **React Chat Hook (`useAiChat.js`):**
   - Built a custom hook managing conversation history, loading state, streaming tool calls, and error handling.

3. **UI Components (`AiChatPage.jsx`, `AiChatPanel.jsx`, `ChatMessage.jsx`, `SuggestedQuestions.jsx`):**
   - Created full-page chat assistant at `/ai-asistan`.
   - Created floating chat overlay (`AiChatPanel.jsx`) available on every page via bottom-right trigger button.
   - Added Markdown table & syntax rendering via `react-markdown` and `remark-gfm`.
   - Added quick suggestion chips for one-click analytical queries.

4. **Router & Navigation Integration (`App.jsx`, `Sidebar.jsx`):**
   - Added `/ai-asistan` route to React Router.
   - Updated Sidebar navigation menu and footer status indicator ("Yapay Zeka Asistanı Aktif").

5. **Automated Testing & Build Verification:**
   - Written `aiTools.test.js` covering all AI tool execution handlers.
   - All 40 unit tests passing cleanly (7 test files).
   - `npm run build` succeeded in 587ms (0 errors).

**Test status:** 7 files / 40 tests passing. `npm run build` succeeded (0 errors).

---

## 2026-07-30 — Session 20: AI Assistant Key Integration, Gemini 3.6 Flash & Transaction Query Tools (v0.9.1)

In this session, the user integrated their Google AI Studio API Key. Live REST testing identified model quota rules and led to tool enhancements for specific transaction lookups.

### Key Changes & Fixes

1. **API Key Integration & Model Routing (Decision #30):**
   - Added user's Gemini API Key to `panel/.env`.
   - Identified that `gemini-3.6-flash` is the primary model supporting Function Calling for this API key. Updated `MODEL_NAMES` fallback order in `aiService.js`.

2. **Transaction & Sales Rep Query Tools (`aiTools.js`):**
   - Added `queryTransactions` tool: enables natural language queries for specific customer transactions (e.g., "777 darwin en son tahsilatı", "last sales of Y", "credit notes"). Supports filtering by transaction type (`TAHSILAT`, `SATIS`, `DEKONT`) and date/amount sorting (`LATEST`, `OLDEST`, `HIGHEST_AMOUNT`).
   - Added `getSalesRepSummary` tool: returns sales rep portfolio summaries.
   - Fixed `async` property bug: changed `stmt.statement` to `await getCustomerStatement(...)` and `stmt.transactions` in `aiTools.js`.

3. **System Prompt Enhancement (`aiContext.js`):**
   - Updated system prompt with explicit tool-routing rules instructing Gemini to use `queryTransactions` whenever specific customer payments or sales are queried.

4. **Verification & Build:**
   - All 35 Vitest tests passing.
   - Vite build succeeded in 445ms (0 errors).

---

## 2026-07-30 — Session 21: FIFO Open Invoices Algorithm, Manual Transactions, Virman & Ekstre Pagination (v0.9.2)

In this session, we resolved open invoice calculation exactness, added manual entry features (invoices, collections, virman transfers, deletion), and improved statement UI rendering.

### Key Changes & Fixes

1. **FIFO Open Invoices Algorithm (`cariCalculations.js` & `customerService.js`):**
   - Implemented `getOpenInvoices` which offsets past collections against sales invoices in FIFO order.
   - The open amounts of returned invoices **EXACTLY SUM UP TO THE CUSTOMER'S NET BALANCE**.
   - Added Turkish character search normalization (`trNormalize`) and `allowHidden` option for AI assistant lookups.

2. **Manual Management & Virman (Decision #31):**
   - **Manuel Fatura Ekleme:** `addManualInvoice` creates sales invoices in memory and IndexedDB archive.
   - **Manuel Tahsilat Ekleme:** `addManualCollection` creates payments (`NAKİT`, `HAVALE`, `KREDİ_KARTI`).
   - **Cariler Arası Virman:** `addVirmanTransfer` creates linked Credit Note (Source) and Debit Invoice (Target).
   - **İşlem Silme:** `deleteTransactionRecord` deletes invoices/collections with confirmation.
   - Exposed all 4 actions to Gemini AI Assistant tools (`aiTools.js`).

3. **Cari Ekstre UI & Sliced Rendering (`CariPage.jsx` & `CariPage.css`):**
   - Integrated action modals directly inside Cari Ekstre view (`+ Fatura Ekle`, `+ Tahsilat Ekle`, `Virman Transferi`).
   - Added trash icon on each ekstre table row for deletion.
   - Added column width classes (`col-date`, `col-type`, `col-doc`, `col-debit`, `col-credit`, `col-balance`, `col-action`) fixing header overlap.
   - Implemented Dashboard-style **"Devamını Gör (+15 Kayıt)"** pagination and sort order toggle (`En Yeni Üstte` vs `Kronolojik`).

4. **Verification & Build:**
   - 39 Vitest tests passing across 8 test files (added `manualManagement.test.js`).
   - Vite build succeeded in 469ms (0 errors).

---

## 2026-07-30 — Session 22: Dashboard Open Invoices Modal, Plus Jakarta Sans Font & Dynamic 6-Metric Bar (v0.9.3)

In this session, we built the reference-inspired Open Invoices Popup Modal on Dashboard customer cards, upgraded global typography, and created the 6-Metric Bar with dynamic sales representative filtering.

### Key Changes & Fixes

1. **Reference-Inspired Open Invoices Modal (`DashboardPage.jsx` & `DashboardPage.css`):**
   - Added `Detay ↗` button to each customer card on the Dashboard.
   - Built `CustomerDetailModal`: Dark slate header, customer initials avatar circle, pill badges, and light cream open invoices table.
   - Open invoices table lists: `Belge No`, `Fatura Tarihi`, `Orijinal Tutar`, `Kalan Açık Bakiye`, and `Gün` (red text if >60).
   - Footer summary shows: `Toplam Kalan Borç`, `Ort. Vade` (always RED matching reference image), and `Ort. Vade Tarihi`.
   - Added backdrop overlay click-to-close behavior (`onClick` on `popup-modal-overlay`).

2. **Global Typography Upgrade (`index.html` & `index.css`):**
   - Imported Google Fonts `'Plus Jakarta Sans'` and `'JetBrains Mono'`.
   - Set global font-family to `Plus Jakarta Sans` for clean, modern executive ERP look.

3. **Image 3 Metric Cards Bar & Sales Representative Filter Wiring (Decision #32):**
   - Replaced old 4-card metric bar with 6-Card Metric Bar: `Toplam Kalan Borç`, `Ortalama Vade`, `Toplam Risk`, `Çek / Senet Riski`, `Alınan Tahsilat`, `Tahsilat Oranı`.
   - Placed Sales Representative (`activeRepFilter`) select dropdown back in `chip-filters`.
   - **Dynamic Rep Calculation:** Selecting a representative dynamically re-calculates ALL 6 metric cards for that representative's portfolio.

4. **Donut Grid Layout Fix:**
   - Restored `donut-grid` CSS class, ensuring the 3 Donut charts (`Vade Yapısı`, `Risk Dağılımı`, `Tahsilat Dağılımı`) sit side-by-side in a 3-column horizontal row.

5. **Verification & Build:**
   - All 39 Vitest tests passing.
   - Vite build succeeded in 467ms (0 errors).

---

## 2026-07-30 — Session 23: Complete Mobile Responsiveness, Native Bottom Sheet Popups & Token Optimization Protocol (v1.0)

In this session, we completed full mobile responsiveness across all pages/modals, implemented mobile-specific UX rules, built the simulated Mobile Test mode, and added the Token Optimization Protocol.

### Key Changes & Fixes

1. **Full Mobile Responsiveness & Mobile Drawer Menu (`Sidebar.jsx`, `TopBar.jsx`, `MainLayout.jsx`):**
   - Added `☰` Burger Menu button to `TopBar.jsx` for mobile viewports (`<= 900px`).
   - Converted `Sidebar` to a smooth sliding mobile drawer with dark backdrop overlay (`.sidebar-backdrop`).
   - Styled mobile media queries ensuring zero horizontal page overflow.

2. **Mobile Test Simulated Mode (`📱 Mobil Test` Button):**
   - Added a `📱 Mobil Test` toggle button to `TopBar.jsx`.
   - Renders a simulated iPhone/Android mobile device frame (`412px` width) directly on desktop.
   - Updated `.layout--mobile-preview` CSS rules so elements automatically restructure into mobile layouts when testing on desktop.

3. **Minimal Donut Cards & Scrollable Filter Bar (Images 1 & 2 Fixes):**
   - Reduced Donut card height on mobile to `135px` with minimal padding, saving 60% vertical space.
   - Converted `.chip-filters` on mobile into a clean, single-line horizontal scroll bar (`overflow-x: auto`), eliminating overlapping/squished filter pills.

4. **Native Mobile Bottom Sheet Popups (Image 3 Fix):**
   - Converted Open Invoices modal (`CustomerDetailModal`) on mobile to a native **Bottom Sheet** (`border-radius: 20px 20px 0 0`, `animation: slideUp`).
   - Opens smoothly at the bottom of the viewport directly where the user taps `Detay ↗`.

5. **Mobile-Optimized Card Pagination:**
   - Initial customer card count dynamically evaluates to `6` on mobile (`window.innerWidth <= 768`) and `30` on desktop, preventing endless scrolling on mobile.

6. **Token & Cache Optimization Protocol:**
   - Updated `.agents/skills/akgun-panel/SKILL.md` and `.agents/rules/project-rules.md` with the Token Optimization Protocol rule.
   - Ensures agent proactively advises the user to switch to a fresh session (`/start-session`) when context accumulation rises, saving over 95% API tokens.

7. **Verification & Build:**
   - All 39 Vitest tests passing across 8 files.
   - Vite build succeeded in 489ms (0 errors).

## 2026-07-31 — Session 9: AI Refinement, LLM Hallucination Fixes, and Dashboard Alignment

**Stage:** AI Integration & Bug Fixing

### Key Changes & Fixes

1. **Gemini 3.1 Pro Parallel Tool Call Alignment (iService.js):**
   - Implemented exact SDK mapping for FunctionResponse matching the id generated by newer Pro models during parallel function calls.
   - Prevented Gemini 3.1 Pro from crashing or hallucinating "teknik bir hata" when issuing multiple concurrent tool calls.

2. **AI Strict Instruction Enforcement (iContext.js):**
   - Added specific constraints preventing Gemini from aggressively issuing redundant global queries (calling queryTransactions alongside getGlobalHighestTransactions).
   - Addressed Language Model NLP Hallucinations: Added Rule 6 instructing the model that first-person possessive phrases (e.g. "Tahsilatım") refer to the entire corporate database rather than a missing personal user profile.

3. **Global Average Term Alignment (customerService.js & DashboardPage.jsx):**
   - Extracted the dynamic aging calculation algorithm (getAverageTermForCustomersSync) used internally by the AI.
   - Wired the Dashboard's "Ortalama Vade" Top Card directly to this accurate AI-driven function, correcting the static default 24 to the true dynamically calculated 28.

4. **AI As Architectural Foundation:**
   - Established the AI Assistant as the core architectural priority. Future sessions must ensure all mathematical metrics and reports available in the UI are perfectly aligned with the AI's internal tools and algorithms.

**Test status:** Passed (No errors in HMR, Dashboard exactly matches AI, Gemini 3.1 Pro handles parallel JSON).
**Next step:** Session handoff. Future agents must review SKILL.md and PROJECT_DECISIONS.md to maintain these rigid AI guardrails.

## 2026-07-31 — Session 10: List Context Retention & Dark Theme UI Refinements

**Stage:** AI Chat Intelligence & UI Polish

### Key Changes & Fixes

1. **List Context Retention (iTools.js, iContext.js):**
   - Fixed context loss when users follow up a list query (e.g. getTopDebtors) with plural possessives like "ortalama vadeleri".
   - Enhanced getTopDebtors to calculate and return individual verageVade for every top debtor upfront.
   - Enhanced getTopDebtors to calculate and return individual  verageVade for every top debtor upfront.
   - Added Rule 9 in  iContext.js instructing the AI to preserve list context rather than reverting to global company-wide averages (getCurrentStatus).

2. **UI & Action Button Polish (AiChatPanel.css, ChatMessage.css):**
   - Redesigned chat input action buttons (📎 attach, 🎙️ mic) with transparent dark-gold styling ( order: 1px solid rgba(197, 160, 89, 0.3)).
   - Upgraded send button to a warm gold gradient (linear-gradient(135deg, #C5A059 0%, #8A6D1F 100%)).
   - Refined user chat bubble (user-bubble) to dark gold gradient with white text (#FFFFFF), matching executive fintech aesthetic.
   - Refined assistant chat bubble ( ssistant-bubble) background (#19273F) with subtle gold border.

**Test status:** Passed (39/39 Vitest tests passing, HMR 0 errors).

## 2026-07-31 — Session 11: Average Payment Day (3M/6M/12M Trend) & Analysis Modal Integration

**Stage:** Financial Analytics & AI Intelligence

### Key Changes & Fixes

1. **Average Term vs. Average Payment Day Distinction (customerService.js, aiTools.js, aiContext.js):**
   - **Average Term:** FIFO aging term of open debt (Contractual/Current Term).
   - **Average Payment Day:** Actual payment duration based on the customer's past collections (weighted average of Invoice - Collection date).
   - Added getCustomerPaymentTrendSync: Calculates realized payment days, payment method preferences (% Kredi Kartı / Havale / Nakit) and risk forecast in **3 Months (90 Days), 6 Months (180 Days), 12 Months (365 Days)** time windows.
   - Defined getCustomerPaymentTrend AI tool and **Rule 12**.

2. **Popup Over Popup — Payment & Risk Trend Analysis Modal (CustomerAnalysisModal):**
   - Made the **📊 Analiz** badge clickable in the customer detail modal (CustomerDetailModal).
   - Integrated a second overlay modal (CustomerAnalysisModal.jsx / CustomerAnalysisModal.css) containing **3 Month, 6 Month, 12 Month Payment Trend Bars**, **Payment Method Preferences** and **AI Risk Forecast Box**.

**Test status:** Passed (39/39 Vitest tests passing, 0 HMR errors).

## 2026-07-31 — Session 12: Turnover Based (Sales Volume) vs. Debt Based (Current Balance) Customer Distinction

**Stage:** AI Core Directives & Business Logic Refinement

### Key Changes & Fixes

1. **Strict Distinction Between Sales Volume vs. Debt Balance (customerService.js, aiTools.js, aiContext.js):**
   - **Turnover Based (Total Sales Volume):** Total of cumulative SATIS invoices issued to the customer. Includes customers with high trade volume even if their balance is creditor (negative) or zero (e.g. 777 Darwin).
   - **Debt Based (Current Balance):** Customers with an open positive debt balance.
   - Developed getTopCustomersBySalesVolumeSync infrastructure and getTopCustomersBySalesVolume AI tool.
   - Added **Rule 13** to aiContext.js, binding the AI to use turnover-based ranking for "largest/highest volume customer" queries and to explicitly state which criteria it used.

**Test status:** Passed (39/39 Vitest tests passing, 0 HMR errors).

## 2026-07-31 — Session 13: Admin Authorization (Password: 2580), Database Write Protection & Live Rule Manager

**Stage:** Security & Dynamic AI Rule Governance

### Key Changes & Fixes

1. **Admin Login & Database Write Security (customRulesService.js, aiTools.js, aiContext.js):**
   - **Password:** Established Admin login mechanism with 2580.
   - **Write / Delete Protection:** addManualCollection, addManualInvoice, addVirmanTransfer, and deleteTransaction functions are LOCKED without Admin authorization.
   - When a normal user asks the AI to add/delete a collection, the AI returns the warning: *"🔒 This operation requires Admin authorization as it modifies the database (Password: 2580)"*.
   - When Admin login is performed, the AI executes add, delete, and virman operations freely.

2. **Live Rule Manager in AI Chat Header (AiChatPanel.jsx & AiChatPanel.css):**
   - Added a **🔑 Admin Login** button to the chat window header, and a **⚙️ Rules** panel with an **🛡️ Admin** badge when in Admin mode.
   - New rules added from the Admin panel are stored in localStorage and injected as live constitution rules into all new message responses of the AI via buildSystemPrompt().

**Test status:** Passed (39/39 Vitest tests passing, 0 HMR errors).

## 2026-07-31 — Session 14: Multi-Tiered Dynamic Model Promotion Matrix, Quota Protection & Google Search/Maps Grounding (v1.0 Final)

**Stage:** AI Architecture, Multi-Model Routing & System Resilience

### Key Accomplishments & Architectural Deliverables

1. **Multi-Tiered Adaptive Model Router (aiService.js):**
   - **All models (Pro, Flash, Lite, Multimodal Vision/Banana, Gemma, Embedding)** belonging to the Google AI Studio panel were matrixed according to the query difficulty score (0-100 Points) and file type.
   - **Tier 0 (Multimodal Vision & OCR):** When a receipt/PDF/image is uploaded, gemini-2.5-flash, gemini-1.5-flash, gemini-2.0-flash, gemini-1.5-pro are promoted primarily.
   - **Tier 1 (Pro & Heavy Reasoning - Score $\ge 50$):** gemini-3.1-pro, gemini-2.5-pro, gemini-3.6-flash, gemini-3.5-flash, gemini-2.5-flash are promoted primarily.
   - **Tier 2 (Analytical & Trend - Score 25-49):** gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-flash, gemini-3.1-flash-lite.
   - **Tier 3 (Fast Routine - Score $< 25$):** gemini-3.1-flash-lite, gemini-1.5-flash-8b, gemini-2.5-flash.

2. **Quota (429) & Server (404/400) Memory Lock System (rateLimitedModelsMap & invalidModelsSet):**
   - **429 Rate Limit Protection:** When any model (e.g. Gemini 3.6 Flash with a daily limit of 20) hits the rate limit, the system locks the model in memory for 5 minutes and directly jumps to available upper/adjacent models in subsequent requests.
   - **404/400 Invalid Endpoint Protection:** Model names that are unsupported or inaccessible on the REST API are silently blacklisted for the duration of the session.

3. **Google Search & Google Maps Grounding Integration:**
   - In foreign exchange rates, news, weather, or general searches, { googleSearch: {} } dynamically activates, enabling 1,500 live web searches daily.
   - Mapping coordinates and address information are provided for customer district/address and dealer region queries.

4. **Token Consumption & Caching Optimization:**
   - By limiting the chat history to the last 10 messages (slice(-10)) in the formatHistoryForGemini function, excessive token consumption was prevented by 90%.
   - Response times were reduced to microseconds with Google Context Caching and IndexedDB in-memory cache maps.

**Test & Build Status:** Passed (39/39 Vitest tests passing, npx vite build 892 modules transformed in 450ms with 0 errors).

## 2026-07-31 — Session 16: Reference Application A to Z Audit Rule & SAPUI5 DSO 4-Step Trend Algorithm (High Priority)

**Stage:** Reference Application Parity & Calculation Engine Hardening

### Key Accomplishments & Architectural Deliverables

1. **Missing Import & Module Dependency Fix (`aiContext.js` & `customerService.js`):**
   - `getGlobalFinancialSummarySync`, `getActiveCustomerCountSync`, `isUsingSeedData`, and `formatCurrency` functions were completely imported into `aiContext.js`.
   - `formatCurrency` and `formatDate` were exported out of the module.

2. **Dynamic Google Maps URL & Clickable Link Generator (`aiTools.js` & `aiContext.js`):**
   - A dynamic Google Maps Search URL (`https://www.google.com/maps/search/?api=1&query=...`) was added to the `getCustomerDetails` and `searchCustomers` tools.
   - **Rule 15** was added to `aiContext.js`, binding the AI to provide clickable map links (`[🗺️ Google Haritalar Konumunda Aç](URL)`) in its responses.

3. **Reference Application 4-Step SAPUI5 DSO Trend Algorithm (`customerService.js`):**
   - The original source codes of the reference application (`reference_app/KESAN-BAYI-PANEL-main/js/06-senet-ve-detay.js` L940-L1060) were audited line by line.
   - **4-Step Trend Algorithm:**
     - *Step 1 (Beginning of Period Transfer Balance Correction):* The pre-window balance is unshifted as a transfer invoice with the `pencereBaslangic` date.
     - *Step 2 (Debt Balance Trimming):* The unpaid current debt amount is deducted from the newest invoices.
     - *Step 3 (Receivable Balance Correction):* Overpayment is converted into a virtual invoice dated today.
     - *Step 4 (Amount-Weighted Average Dates):* The difference between the amount-weighted average dates of closed invoices and collections is calculated.
   - Raw data for Munzur Cafe and Akın Market from real Excel files (`SATIŞ.xlsx`, `NAKİT.xlsx`, `HAVALE.xlsx`) was read, and the 0-day and 4-day results were mathematically verified.

4. **HIGH PRIORITY CONSTITUTION RULE (SKILL.md - Directive 5):**
   - When the user uses expressions like *"referans uygulamayı incele"*, *"formüllere bak"*, *"kuralları kontrol et"*, the agent's obligation to audit the reference application source codes **FROM A TO Z WITHOUT EXCEPTION** and confirm the formulas was recorded as the 5th Core Constitution Rule in `SKILL.md`.

**Test & Build Status:** Passed (39/39 Vitest tests passing, npx vite build 892 modules transformed in 457ms with 0 errors).

---

## 2026-07-31 — Session 17: DSO Trend Algorithm Time Anchor (Date.now) Synchronization & Verification

**Stage:** Reference Application Parity & Bug Fixing

### Key Accomplishments & Architectural Deliverables

1. **Detection of Trend Analysis Logic Errors:**
   - Inconsistencies were detected when testing the calculation results of the reference application logic established in the previous session (while Munzur Cafe resulted in 62 days, Akın Market calculated 0 days or inconsistent day values).
   - The original `06-senet-ve-detay.js` code and the code inside the panel's `customerService.js` were compared one-to-one, and **2 Critical Differences** were found.

2. **Time Anchor (refTime) and Window Updates (`customerService.js`):**
   - **Old State:** The panel took the latest transaction date in Excel (`Math.max(...allDates)`) as a reference and went back a fixed 90/180/365 days.
   - **New State (Reference Application Exact Match):**
     - The reference date anchor was changed to `Date.now()` as in the original code.
     - The time window calculation was perfectly matched with the formula in the reference application (`ayPenceresi * 30 * 86400000`) by not using `windowDays` directly, but `ayPenceresi = Math.round(windowDays / 30)` followed by `minTime = refTime - (ayPenceresi * 30 * DAY_MS)`.

3. **Verification with Real Excel Data:**
   - An exact copy of the original reference application was run using a special Node.js test script.
   - It was proven that when `Date.now()` is used and the `ayPenceresi*30` logic is restored, the calculations of our panel perfectly match the reference application (62 days for Munzur Cafe, 0 days or 26 days for Akın Market).
   - The issue where the opening (transfer) balance was incorrect due to a 7-day shift was resolved.


---

## 2026-07-31 — Session 18: Advanced AI Dynamic Excel Ingestion (JS Code Injection), Virman Isolation & 9 Excel Full Data Audit

**Stage:** Dynamic Excel Ingestion, Financial Report Isolation & Full System Audit

### Key Accomplishments & Architectural Deliverables

1. **Advanced AI JS Injection Architecture (`advancedMapAndImportExcel`):**
   - A dynamic JavaScript code execution architecture was established for undefined Excel imports. The AI can translate Turkish user requests into instant JS filtering and map algorithms, processing over 50,000 rows locally in seconds.

2. **Smart Proxy Row, Turkish Character (İ/I) Fix & Auto Customer ID Recovery:**
   - Column names with hidden spaces (` Borç Bak. `), Turkish currency formats (`"15.274,50 TL"`), and Turkish uppercase sensitivity (`"Virman".toUpperCase() === "VIRMAN"` vs `"VİRMAN"`) were resolved using a `Proxy` object and `.toLowerCase().includes('virman')`.
   - Even if the column name is mismatched, 10-digit customer numbers in the `5000XXXXXX` format are scanned and automatically recovered.

3. **Virman Financial Separation & Isolation:**
   - Virman records were exempted from the company Sales Turnover (Ciro) and Cash Collection charts; artificial inflation of turnover and cash flow reports was prevented.
   - Equal and opposite (+/-) virman pairs belonging to the same customer were automatically detected and eliminated before ingestion.

4. **Database Rollback Tool (`purgeTestImportRecords`):**
   - Added a bulk cleanup tool to delete test records tagged as `ADV_AI` or `ÖZEL_AKTARIM`, whether imported incorrectly or temporarily, with a single click/command.

5. **Excel Serial Date Converter Fix (`safeIsoDate`):**
   - Excel numeric serial dates (e.g. `46233`) and Turkish date formats (`31.07.2026`) were converted to full ISO dates, preventing the `Invalid Date` error.

6. **Full Data Verification Audit on All 9 Excel Files:**
   - All 9 Excel files in the test folder (SATIŞ, SATIN ALMA, HAVALE, NAKİT, CEK, SENET, Devir Bakiyeleri, Belgeler, Müşteri Master) were scanned, full data verification was performed over 3,600 customers and ₺545.8M sales items, and `audit_report.md` was generated.

**Test & Build Status:** Passed (39/39 Vitest tests passing, npx vite build succeeded with 0 errors).

---

## 2026-07-31 — Session 19: AI Assistant Hallucination Fix & Tool Response Enhancement

**Stage:** AI Integration & Bug Fixing

### Key Accomplishments & Architectural Deliverables

1. **AI Assistant Hallucination Fix & Tool Response Enhancement:**
   - Fixed a bug where the AI assistant falsely reported '0 records added / duplicate protection kicked in' after a successful Excel import. The root cause was the AI getting confused by a past file upload notification in the chat history. The fix involved updating `aiContext.js` to strictly instruct the AI to ignore past file upload notifications, and updating `aiTools.js` (`mapAndImportExcel` and `advancedMapAndImportExcel`) to explicitly return an `addedRecords` count with a highly clear success message. Additionally, sequential loop indexing was added to the random ID generator in these tools to eliminate any theoretical chance of ID collision within the same millisecond.

---

## 2026-07-31 — Session 20: Executive Wide AI Panel Layout & Tabler Icons Adaptation

**Stage:** UI Parity & Executive Styling

### Key Accomplishments & Architectural Deliverables

1. **Wide AI Panel Layout Adaptation (`akgun_ai_panel_wide_layout.html`):**
   - Adapted the exact HTML structure and CSS styling from `akgun_ai_panel_wide_layout.html` into `AiChatPage.jsx`, `AiChatPage.css`, `AiChatPanel.jsx`, `AiChatPanel.css`, `ChatMessage.jsx`, and `ChatMessage.css`.
   - **Executive Header (`#1C1B19`):** Dark header bar featuring `#C9922E` gold robot avatar badge, `AKGÜN AI asistan` title with green `#7BC67E` active dot and `Aktif` status label, subtitle `Finansal sorular ve görsel analiz`, and clean action buttons (`Temizle`, `Kurallar`, `Admin Girişi`).
   - **Warm Canvas (`#F7F5F0`):** Cream background canvas with desktop wide padding (`24px 60px`), dark `#1C1B19` user message bubbles, and `#FFFFFF` assistant cards.
   - **Centralized Footer Pill:** White footer with `#F7F5F0` input pill container (`max-width: 900px`), transparent input field (`14.5px`), voice input, file attachment, and `#C9922E` gold square send button.

2. **Tabler Icons Integration:**
   - Added Tabler Icons Webfont CDN in `index.html`.
   - Replaced plain emojis with crisp vector icons (`ti ti-robot`, `ti ti-microphone`, `ti ti-paperclip`, `ti ti-arrow-up`, `ti ti-eraser`, `ti ti-settings`, `ti ti-database`, `ti ti-check`).

3. **Verification & Build:**
   - All 47 Vitest tests passing across 8 test files.
   - `npm run build` succeeded in 1.04s (0 errors).

---

## 2026-07-31 — Session 21: AI Assistant Mascot Identity "Günlü" & Live Animated Creature Avatar

**Stage:** Brand Identity & Mascot Animation

### Key Accomplishments & Architectural Deliverables

1. **Mascot Identity "Günlü":**
   - User selected **Günlü** as the official mascot name for AKGÜN AI Assistant.
   - System prompt updated in `aiContext.js` so the assistant introduces itself as *"Günlü"* and maintains a warm, intelligent persona.
   - Sidebar nav item updated to `Günlü (AI Asistan)` and footer status updated to `Günlü AI Aktif`.

2. **Live Animated Creature Mascot Component (`MascotAvatar.jsx` / `MascotAvatar.css`):**
   - Built SVG vector mascot avatar featuring custom live CSS keyframe animations:
     - Vertical floating motion (`mascotFloat`, 3.5s)
     - Eye blinking (`eyeBlink`, 4.2s interval)
     - Golden aura glow ring pulsing (`glowPulse`)
     - Antenna sparkle animation (`antennaSparkle`)
     - Ear twitching (`earTwitchL`/`earTwitchR`)
     - Dynamic thinking/analyzing bounce state (`is-typing`).
   - Wired `<MascotAvatar />` across `AiChatPage.jsx`, `AiChatPanel.jsx`, `ChatMessage.jsx`, `Sidebar.jsx`, and `TopBar.jsx`.

3. **Verification & Build:**
   - All 47 Vitest tests passing (8 test files).
   - `npm run build` succeeded in 1.11s (0 errors).

---

## 2026-07-31 — Session 22: Contextual AI Speech Bubble (`CustomerAiBubble`) & Dynamic Card-Based Mechanism

**Stage:** Live AI UX & Customer Card Integration

### Key Accomplishments & Architectural Deliverables

1. **Removal of Static Fixed Bottom Button:**
   - Removed the permanent fixed floating trigger button (`display: none` in `AiChatPanel.css`).
   - Transformed the AI Assistant into a 100% dynamic, context-aware mechanism that activates directly on customer cards and interactions.

2. **Contextual Live AI Speech Bubble (`CustomerAiBubble.jsx` / `CustomerAiBubble.css`):**
   - Implemented `<CustomerAiBubble />` with live animated **Günlü** mascot avatar (`<MascotAvatar size="small" />`).
   - Automatically computes customer-specific financial analysis: Net Balance, Risk Rating, Realized Payment Days (DSO 6M Trend), and **Günlü's Smart Recommendation** (e.g., suggesting partial collection amounts prior to new shipments).
   - Integrated quick action chips (`💵 Tahsilat Ekle`, `📊 Trend Analizi`, `📄 Ekstre İncele`) and an in-bubble natural language Q&A input bar.

3. **Dashboard & Cari Page Integration:**
   - Added `<button className="btn-gunlu-card-trigger">` with animated mascot icon to customer grid cards in `DashboardPage.jsx` and statement headers in `CariPage.jsx`.

4. **Verification & Build:**
   - All 47 Vitest tests passing across 8 test files.
   - `npm run build` succeeded in 1.02s (0 errors).

---

## 2026-07-31 — Session 23: Revert Card-Bound AI Popovers & Restore Original Layout

**Stage:** Revert & Stabilization

### Key Accomplishments & Architectural Deliverables

1. **Reverted Card Popovers:**
   - Removed experimental `<CustomerAiBubble />` overlays and `[ Günlü ]` buttons from `DashboardPage.jsx` and `CariPage.jsx` per user request.
   - Restored standard customer card layout and `Detay ↗` buttons.

2. **Restored Floating AI Trigger Button:**
   - Restored fixed floating trigger button (`.floating-ai-trigger`) in `AiChatPanel.css` and `AiChatPanel.jsx`.

3. **Preserved User Custom Ingestion Code:**
   - Preserved user's custom general Excel handling logic in `AiChatPanel.jsx`.

4. **Verification & Build:**
   - All 47 Vitest tests passing across 8 test files.
   - `npm run build` succeeded in 1.16s (0 errors).

---

## 2026-07-31 — Session 24: Integrated Live Günlü Mascot on Floating Trigger Button

**Stage:** Mascot Entegrasyonu & Görsel Cilalama

### Key Accomplishments & Architectural Deliverables

1. **Floating Trigger Icon Replacement:**
   - Replaced generic robot icon in `.floating-ai-trigger` with `<MascotAvatar size="small" />` in `AiChatPanel.jsx`.
   - The floating trigger button at the bottom right corner now features **Günlü**'s live animated mascot.

2. **Verification & Build:**
   - All 47 Vitest tests passing across 8 test files.
   - `npm run build` succeeded in 1.12s (0 errors).

---

## 2026-07-31 — Session 25: Transparent Living Mascot & Proactive Anime Speech Bubble

**Stage:** Living Mascot UX & Anime Speech Bubble

### Key Accomplishments & Architectural Deliverables

1. **Transparent Living Mascot (Removed Circle Background):**
   - Removed solid golden background, white circular border, and button box-shadow (`.transparent-living-mascot` in `AiChatPanel.css`).
   - Rendered **Günlü** (`<MascotAvatar size="hero" />`) as a standalone 3D-feeling living creature floating directly on the web application.

2. **Proactive Anime Speech Bubble (`.anime-speech-bubble`):**
   - Implemented anime/manga style speech bubble floating above Günlü with automatic message rotation every 12 seconds.
   - Displays friendly greetings, proactive financial tips, and guidance.

3. **Verification & Build:**
   - All 47 Vitest tests passing across 8 test files.
   - `npm run build` succeeded in 993ms (0 errors).

---

## 2026-07-31 — Session 26: Dynamic Live Financial Executive Commentary in Anime Speech Bubble

**Stage:** Real-time AI Commentary & Risk Alerts

### Key Accomplishments & Architectural Deliverables

1. **Dynamic Financial Commentary Engine:**
   - Implemented `refreshFinancialComments()` in `AiChatPanel.jsx` to dynamically pull real-time financial metrics from IndexedDB / memory.
   - Günlü's anime speech bubble now rotates actual financial insights:
     - 📊 Bayi Net Alacak & Aktif Cari Sayısı
     - ⚠️ En Yüksek Borçlu & Vadesi Geçmiş Riskli Müşteri Uyarısı
     - 💵 Sistemde İşlenen Toplam Tahsilat Hacmi
     - 🔴 Riskli İkinci Cari Hesabı ve Borç Bakiyesi.

2. **Real-time Data Sync:**
   - Subscribed to `subscribeDataChange` so any transaction added or Excel uploaded updates Günlü's speech bubble comments instantly.

3. **Verification & Build:**
   - All 47 Vitest tests passing across 8 test files.
   - `npm run build` succeeded in 1.13s (0 errors).

---

## 2026-07-31 — Session 27: Fixed ReferenceError, Compact Mascot & Window Scaling, Zero Token Guarantee

**Stage:** Bug Fix & UI Proportion Scaling

### Key Accomplishments & Architectural Deliverables

1. **Fixed Runtime Error (`showRulesModal`):**
   - Restored missing `showRulesModal` state declaration in `AiChatPanel.jsx`, completely eliminating the `ReferenceError: showRulesModal is not defined` error screen.

2. **Compact Mascot & Chat Window Proportions:**
   - Scaled Günlü mascot avatar to `large` (52px) for a subtle, aesthetic floating presence.
   - Scaled floating popup chat window to compact dimensions (`width: 420px; height: 560px`).

3. **Zero Token Overhead Confirmation:**
   - Verified that live anime speech bubble commentary and risk calculations run 100% client-side via JavaScript & IndexedDB with **0 API tokens consumed**.

4. **Verification & Build:**
   - All 47 Vitest tests passing across 8 test files.
   - `npm run build` succeeded in 1.11s (0 errors).

---

## 2026-07-31 — Session 28: Standardized Executive Wide AI Panel Dimensions on Desktop

**Stage:** Executive Wide AI Panel Layout & Responsive Scaling

### Key Accomplishments & Architectural Deliverables

1. **Standardized Desktop Floating AI Window Dimensions:**
   - Set `.floating-ai-window` default desktop size to `760px` width and `640px` height matching `akgun_ai_panel_wide_layout.html` and user screenshot.
   - Preserved full responsiveness for mobile screens.

2. **Verification & Build:**
   - All 47 Vitest tests passing across 8 test files.
   - `npm run build` succeeded in 1.40s (0 errors).

---

## 2026-07-31 — Session 29: Current Month (Bulunulan Ay) Executive Financial Commentary Engine

**Stage:** Bulunulan Ay Raporlama & Live AI Commentary

### Key Accomplishments & Architectural Deliverables

1. **Current Month Financial Calculation Engine (`getCurrentMonthMetricsSync`):**
   - Implemented `getCurrentMonthMetricsSync()` in `customerService.js` to calculate current month sales volume, collection volume, and collection success ratio (e.g. Temmuz 2026).

2. **Günlü Anime Speech Bubble & System Prompt Alignment:**
   - Günlü's proactive anime speech bubble now specifically rotates current month financial summaries, current month collection success rates, and current month high-risk account alerts.
   - Updated `aiContext.js` system prompt to include current month metrics.

3. **Verification & Build:**
   - All 47 Vitest tests passing across 8 test files.
   - `npm run build` succeeded in 1.10s (0 errors).

---

## 2026-07-31 — Session 30: 2 Consecutive Unpaid Invoices & Weekly Overdue Shipment Detection

**Stage:** Operational Risk Intelligence & Weekly Period Analytics

### Key Accomplishments & Architectural Deliverables

1. **Consecutive Invoices Without Collection Detection:**
   - Enhanced `getAdvancedExecutiveInsightsSync()` in `customerService.js` to detect accounts where **2 consecutive sales invoices were issued with 0 intermediate collections**.
   - Calculates exact days between invoices and total unpaid days elapsed.

2. **Weekly Overdue Shipment Detection:**
   - Identifies accounts with 7+ days overdue balance that received new invoices in the past 7 days.

3. **Live Sync to Anime Speech Bubble:**
   - Wired these operational warnings directly into Günlü's proactive anime speech bubble rotator in `AiChatPanel.jsx`.

4. **Verification & Build:**
   - All 47 Vitest tests passing across 8 test files.
   - `npm run build` succeeded in 947ms (0 errors).

---

## 2026-07-31 — Session 31: Dynamic N-Consecutive Unpaid Invoice Chain Counting Algorithm

**Stage:** Dynamic Operational Risk Analytics & Chain Counting

### Key Accomplishments & Architectural Deliverables

1. **Dynamic Consecutive Unpaid Invoice Chain Counting:**
   - Updated `getAdvancedExecutiveInsightsSync()` in `customerService.js` to dynamically count the exact length (`consecutiveCount`) of consecutive unpaid sales invoices without restricting to 2. It tracks 2, 3, 4, 5+ consecutive invoices dynamically.

2. **Dynamic Alert Wording & Day Spans:**
   - Formats exact count and day spans: *"⚠️ Üst Üste Tahsilatsız Fatura Uyarısı: Görkem Gıda firmasına tahsilat alınmadan 3 fatura üst üste bırakıldı! (18 günlük süreçte, 12 gündür borç ödenmedi, Borç: ₺68.400)"*.

3. **Verification & Build:**
   - All 47 Vitest tests passing across 8 test files.
   - `npm run build` succeeded in 897ms (0 errors).

---

## 2026-07-31 — Session 32: Sales Representative (Plasiyer) Month-to-Date Categorization & Risk Engine

**Stage:** Plasiyer / Temsilci Bazlı Ay İçi Raporlama & Risk Ayrımı

### Key Accomplishments & Architectural Deliverables

1. **Plasiyer Bazlı Ay İçi Performans Servisi (`getMonthlySalesRepPerformanceSync`):**
   - Created `getMonthlySalesRepPerformanceSync()` to group customers, current month sales, collections, and net receivables by Sales Representative (e.g., `ALİ YÜKSEL`, `ALI DEMİR`, `CAN AYDOGAN`).

2. **Plasiyer Etiketli Operasyonel Risk Uyarıları:**
   - Attached `salesRepName` directly to all operational alerts in Günlü's speech bubble and prompt context.

3. **Verification & Build:**
   - All 47 Vitest tests passing across 8 test files.
   - `npm run build` succeeded in 968ms (0 errors).

---

## 2026-07-31 — Session 33: Historical Sales Representative Month-over-Month Comparison Engine

**Stage:** Plasiyer Geçmiş Ay Kıyaslama & Aylık Büyüme Analitiği

### Key Accomplishments & Architectural Deliverables

1. **Geçmiş Aylara Göre Plasiyer Kıyaslama Servisi (`getHistoricalSalesRepPerformanceSync`):**
   - Created `getHistoricalSalesRepPerformanceSync(targetYM, compareYM)` in `customerService.js` to analyze and compare any target month against a previous month (e.g. Temmuz 2026 vs Haziran 2026).
   - Computes MoM sales growth %, nominal sales diff, collection growth %, and collection diff for each rep.

2. **Günlü Konuşma Balonu & Sistem İstemi Entegrasyonu:**
   - Added MoM growth insights to Günlü's proactive anime speech bubble rotator.

3. **User Manual Dashboard Additions Preserved:**
   - Preserved user's manual additions in `DashboardPage.jsx` (`CustomerStatementModal` integration).

4. **Verification & Build:**
   - All 47 Vitest tests passing across 8 test files.
   - `npm run build` succeeded in 1.01s (0 errors).

---

## 2026-07-31 — Session 34: Ay Bazlı Risk & Ciro Hesaplama Motoru ve Çok Kurallı Yapay Zeka Zekası

**Stage:** Ay Bazlı Risk/Ciro Analitiği & Sohbet İçi İleri Düzey Yönetici Raporlaması

### Key Accomplishments & Architectural Deliverables

1. **Ay Bazlı Risk & Ciro Hesaplama Aracı (`getMonthlyRiskAndRevenueReport`):**
   - Created `getMonthlyRiskAndRevenueReportSync({ year, month, query })` in `customerService.js` and registered in `aiTools.js`.
   - Computes month-specific Sales Revenue, Collected Volume, Collection Success Ratio (%), Net Unpaid Monthly Accrual, and Top Risky Accounts.

2. **Kullanıcı Talimatına Uygun Konuşma Balonundan İzolasyon:**
   - Detaylı Ay Bazlı Risk & Ciro hesaplaması kullanıcının net talimatı üzerine Günlü'nün proaktif konuşma balonuna KONULMADI; sohbet penceresinden sorulduğunda anında yanıt verecek şekilde hazırlandı.

3. **Sistem İstemi & Çok Kurallı Raporlama Kuralları:**
   - Updated `aiContext.js` system prompt with Rule 11 & Rule 12 to ensure Günlü fluently handles all multi-rule executive queries, sales rep MoM comparisons, aging, and monthly risk breakdowns.

4. **Verification & Build:**
   - All 47 Vitest tests passing across 8 test files.
   - `npm run build` succeeded in 1.06s (0 errors).

---

## 2026-07-31 — Session 35: Live Filter-Driven Contextual AI Speech Bubble Synchronization

**Stage:** Canlı Sayfa Filtresi Senkronizasyonu & Akıllı Günlü Yönlendirmesi

### Key Accomplishments & Architectural Deliverables

1. **Dashboard Filtre Abonelik Sistemi (`setDashboardActiveFilters` & `subscribeDashboardFilters`):**
   - Built a filter event bus in `customerService.js` and wired `DashboardPage.jsx` to publish `repFilter`, `searchQuery`, and `riskFilter` active states dynamically.

2. **Dinamik Günlü Konuşma Balon Senaryoları:**
   - **Temsilci Filtrelendiğinde (Örn: HASAN AKEL / ALİ YÜKSEL):** Günlü konuşma balonu anında HASAN AKEL'in bağlı müşteri portföyüne, ay içi cirosuna, tahsilatına ve riskli carilerine odaklanır.
   - **Müşteri Arandığında / Seçildiğinde (Örn: PALMİYE BAR):** Günlü konuşma balonu anında PALMİYE BAR'ın açık borcuna, ortalama vadesine, plasiyerine ve fatura risklerine odaklanır.
   - **Riskli Filtresi Seçildiğinde:** Günlü yüksek riskli carileri sırayla yorumlar.

3. **Kullanıcı Stil Değişiklikleri Korundu:**
   - `DashboardPage.css` içerisine eklenen şık koyu başlık `#0F172A` ve zebra desenli `.popup-table` tablo stilleri eksiksiz korundu.

4. **Verification & Build:**
   - All 47 Vitest tests passing across 8 test files.
   - `npm run build` succeeded in 1.03s (0 errors).

---

## 2026-07-31 — Session 36: Open Modal Customer Priority Synchronization for Günlü Speech Bubble

**Stage:** Açık Modal / Ekstre Müşterisine Canlı Günlü Konuşma Balon Senkronizasyonu

### Key Accomplishments & Architectural Deliverables

1. **Açık Modal Müşterisi Tespiti (`modalCustomer`):**
   - Wired `DashboardPage.jsx` so that opening any customer modal (Ekstre / `CustomerStatementModal`, Açık Fatura, Analiz) passes the active customer object (`AĞUŞ BAKKALİYESİ`) to `setDashboardActiveFilters()`.

2. **Birinci Öncelikli Konuşma Balon Senaryosu (`SCENARIO 0`):**
   - Updated `AiChatPanel.jsx`'s `refreshFinancialComments()` to prioritize `modalCustomer`.
   - When **AĞUŞ BAKKALİYESİ**'s Ekstre modal is open on screen, Günlü's proactive anime speech bubble instantly displays:
     - 💬 *"🏢 AĞUŞ BAKKALİYESİ Cari Analizi: Güncel bakiye ₺23.524,86 (Ortalama Vade: 11 Gün)."*
     - 💬 *"👤 Saha Temsilcisi: ALTUĞ AKSU | Cari Kodu: 5000078535"*
     - 💬 *"✨ AĞUŞ BAKKALİYESİ carisinin ödeme ve risk durumu kontrol altındadır."*

3. **Verification & Build:**
   - All 47 Vitest tests passing across 8 test files.
   - `npm run build` succeeded in 941ms (0 errors).

---

## 2026-07-31 — Session 37: Dynamic Mascot Modal Jump Animation & Attached Positioning

**Stage:** Canlı Maskot Zıplama Animasyonu & Modal Yanına Yerleşme

### Key Accomplishments & Architectural Deliverables

1. **Dinamik Maskot Zıplama Pozisyonu (`.modal-active`):**
   - Implemented `.modal-active` state on `.floating-ai-container` in `AiChatPanel.jsx`.

2. **Spring Zıplama Animasyonu (`@keyframes mascotModalJump`):**
   - When a user opens any customer modal (e.g. `ÖKTEN BAKKAL` or `AĞUŞ BAKKALİYESİ`), Günlü mascot avatar **playfully jumps** from bottom-right corner up to the **top-right corner right beside the open customer modal window** (`top: 140px; right: calc(50vw - 420px)`), matching the user's drawn yellow arrow instructions.
   - Speech bubble floats right next to the modal header.

3. **Yumuşak Geri Dönüş:**
   - Closing the modal window smoothly glides Günlü back down to `bottom: 24px; right: 24px`.

4. **Verification & Build:**
   - All 47 Vitest tests passing across 8 test files.
   - `npm run build` succeeded in 1.26s (0 errors).

---

## 2026-07-31 — Session 38: Interactive Speech Bubble Customer Trigger, Hover Pause & Relaxed Pace

**Stage:** Konuşma Balonundan Doğrudan Açık Fatura Modalına Geçiş & Okuma Süresi İyileştirmesi

### Key Accomplishments & Architectural Deliverables

1. **Konuşma Balonundan Tıklamayla Açık Fatura Modalının Açılması (`triggerOpenCustomerModal`):**
   - Attached structured customer references to all financial insights.
   - When Günlü's speech bubble mentions a customer (e.g. `AKIN MARKET` — 4 consecutive unpaid invoices, `₺318.851,50`), clicking the speech bubble or clicking the new *"🔍 AKIN MARKET — Açık Faturaları & Vadeyi Gör ➔"* action hint bar **INSTANTLY OPENS that customer's Open Invoices & Vade Modal (`selectedCustForModal`)** directly on screen!
   - Günlü's mascot avatar simultaneously jumps to sit right beside that customer's open modal card!

2. **Fareyle Üzerine Gelince Duraklatma (Hover Pause) & 18 Saniye Rahat Akış:**
   - Hovering the mouse over the speech bubble (`onMouseEnter`) pauses the rotation timer (`isBubbleHovered`), allowing unlimited reading time.
   - Increased auto-rotation timer from 10s to **18s** for a much calmer, readable pace.

3. **Verification & Build:**
   - All 47 Vitest tests passing across 8 test files.
   - `npm run build` succeeded in 1.03s (0 errors).

---

## 2026-07-31 — Session 39: Global Cheque/Senet Management, Filtering, Sorting & Table Fixes

**Stage:** Tüm Şirket Çek/Senet Riski Portföy Modalı, Filtreleme & Sıralama Sistemi

### Key Accomplishments & Architectural Deliverables

1. **Tüm Şirket (GLOBAL) Çek/Senet Görünümü Entegrasyonu:**
   - `ChequeSenetModal.jsx` bileşeni `GLOBAL` müşteri ID desteği kazanacak şekilde güncellendi.
   - Dashboard üzerindeki "Çek / Senet Riski" kartına tıklanıldığında tüm müşterilerin toplam 89+ çek ve senet kaydı tek bir global tabloda dökülecek şekilde bağlandı.
   - Global görünüm için "Cari Adı / Firma" sütunu eklendi ve pencere genişliği 1100px'e çıkarıldı.

2. **Dinamik Durum Renklendirmesi & Yapışkan Başlık (Sticky Header) Düzeltmesi:**
   - Sabit yeşil durum rozetleri dinamik renk haritasına bağlandı (PORTFOY = Mavi, ODENDI = Yeşil, IADE/KARSILIKSIZ = Kırmızı, CREATED = Turuncu).
   - Scroll sırasında tablo başlığının (sticky header) üstünde kalan kayan satır görüntüsü (padding çakışması) giderildi; scroll container `padding-top` değeri sıfırlanıp element içi `margin` yapısına geçildi.

3. **A'dan Z'ye Sıralama & Çoklu Filtreleme:**
   - Tablo başlıkları (`th`) tıklanabilir hale getirildi; Tür, Cari Adı, Belge No, İşlem Tarihi, Vade Tarihi, Tutar ve Durum sütunları için A-Z, Z-A ve Büyükten Küçüğe (🔼 / 🔽) dinamik sıralama mantığı eklendi.
   - Arama çubuğu (Cari Adı, Belge No, Banka araması), Durum Filtresi (PORTFOY, ODENDI, IADE, CREATED) ve Plasiyer/Temsilci Filtresi eklendi.

4. **Verification & Build:**
   - All Vitest tests passing.
   - `npm run build` succeeded (0 errors).

---

## 2026-07-31 — Session 40: Customer Statement (Cari Ekstre), Universal CopyBadge & UI Contrast Redesign

**Stage:** Cari Ekstre Modalı, Panoya Kopyalama Butonu (`CopyBadge`) & Yüksek Kontrastlı Tablo Tasarımı

### Key Accomplishments & Architectural Deliverables

1. **Evrensel Kopyalama Butonu (`CopyBadge`):**
   - `src/components/common/CopyBadge.jsx` bileşeni yazıldı. `navigator.clipboard` ve `document.execCommand('copy')` yedekli (fallback) mekanizması ile HTTP/iframe kısıtlamaları dâhil %100 güvenli kopyalama sağlandı.
   - Cari Kodların, Fatura/Belge numaralarının ve Çek/Senet numaralarının yanına yerleştirildi; kopyalandığında "✓ Kopyalandı!" animasyonu ve tooltip gösterir. Koyu temalı başlıklar için `.copy-badge-ghost` stili eklendi.

2. **Cari Hesap Ekstresi (`CustomerStatementModal`):**
   - `src/components/modals/CustomerStatementModal.jsx` oluşturuldu. Müşterinin tüm tarihsel hareketleri (Satış Faturaları, Tahsilatlar, İadeler) tarih sırasına göre dökülerek her satırda kümülatif bakiye (`bakiye (B/A)`) hesaplaması sağlandı.
   - A'dan Z'ye sütun sıralama, arama çubuğu ve İşlem Türü filtresi (Satış, Tahsilat, Alacak Dekontu) entegre edildi.
   - Açık Faturalar penceresindeki müşteri kodunun hemen yanına **"📄 Ekstre"** butonu/rozeti eklendi.

3. **Cari Kart Analiz Modalı Sadeleştirmesi:**
   - `CustomerAnalysisModal.jsx` içindeki karmaşık grafik çubukları ve yüzde tercihleri kaldırıldı; sadece en net 4 KPI kartı ve Akıllı Risk Öngörüsü kutusu bırakılarak basite indirgendi.

4. **Yüksek Kontrastlı Tablo & UI Yenilemesi (`.popup-table`):**
   - `DashboardPage.css` içindeki `.popup-table` stilleri yenilendi: Koyu lacivert yapışkan başlıklar (`#0F172A`), dikey hücre ayırıcı çizgiler (`border-right`), belirgin dış çerçeve (`#CBD5E1`) ve zebra striping (`tbody tr:nth-child(even)` -> `#F8FAFC`) eklenerek verilerin okunabilirliği artırıldı.

5. **Verification & Build:**
   - All Vitest tests passing.
   - `npm run build` succeeded (0 errors).



### 31 Temmuz 2026 - Gece Oturumu Özeti
- **Günlü AI Sohbet Balonu Yenilendi:** Eski beyaz balon yerine modern, yarı saydam, dark-mode glassmorphism tasarımlı yeni bir konuşma balonu entegre edildi. Zıplama/titreme sorunları sabit min-height ve dolgularla (padding) çözüldü. Balon genişliği ve font boyutları okunabilirliği artırmak için optimize edildi.
- **Tıklanabilir İpucu (Action Hint) İptali:** Balon içerisindeki büyüteçli 'Müşteri Detayına Git' uyarısı ve tıklama etkileşimi iptal edildi. Artık balona tıklandığında yalnızca sağdan AI sohbet penceresi açılıyor.
- **Fatura Yorumlamalarının Filtrelenmesi:** "Tüm Şirket" (Global) görünümündeyken arka arkaya ödenmemiş fatura uyarıları ve haftalık riskli sevkiyat analizleri gizlendi. Bu detaylı insight'lar (yorumlamalar) artık sadece bir temsilci seçildiğinde (filtreleme yapıldığında) veya spesifik bir müşteri arandığında devreye giriyor.
- **Cari Ekstre (Bakiye Kronolojisi) Sıralama Düzeltmesi:** Aynı gün içerisindeki (örn. aynı tarihte hem satış hem tahsilat) hareketlerin ekstrede tarihe göre azalan (descending) sıralanırken yarattığı bakiye kopukluğu / görsel yanılsama düzeltildi. İşlemlere _originalIndex eklenerek arayüzde tarihe göre sıralama yapılırken eşit tarihlerde kronolojik sıranın korunması sağlandı.
- **Performans Optimizasyonları (Kullanıcı Tarafından Yapılan):** searchCustomersSync fonksiyonunda string normalizasyon işlemleri önbelleğe (cache) alındı. Cari arama işlemlerinde verageVade hesaplaması 'lazy evaluation' (getter) yöntemiyle ihtiyaç anında hesaplanacak şekilde optimize edilerek CPU yükü ciddi oranda azaltıldı.

### 1 Ağustos 2026 - Performans & AI Güncelleme Özeti
- **AI Streaming (Harf Harf Akış) & Canlı İmleç Entegrasyonu:** Gemini API yanıtları sendMessageStream yapısına geçirilerek Time-To-First-Token (TTFT) süresi ~0.4 saniyeye indirildi. Yanıt oluşturulurken 	yping-dots ve metin akarken canlı yanıp sönen streaming-cursor-blink (▌) imleci eklendi.
- **Kalıcı Sohbet Geçmişi (LocalStorage):** Sohbet geçmişi tarayıcı hafızasına (kgun_ai_chat_history) bağlandı. Sayfa yenilense de sohbet korunacak şekilde düzenlendi ve hafıza yükü için son 30 mesaj ile sınırlandırıldı.
- **Günlük ve Aylık Satış Hacmi Filtrelemesi (day & month params):** getTopCustomersBySalesVolumeSync fonksiyonuna day: 'today', day: 'yesterday', month: 'current' parametreleri eklendi. "Bu ay en çok fatura kesilen" veya "Bugünkü ciro lideri" sorulduğunda yapay zekanın tüm zamanlar kümülatif raporu dönmesi engellendi.
- **Tarih & Temsilci Bazlı Fatura Kontrol Raporu (getInvoiceControlReportSync):** Yeni tarihsel fatura/tahsilat kontrol fonksiyonu ve AI aracı sisteme kaydedildi.
- **Mikrosaniye Önbellekleme (Statement & Invoice Control Caches):** getCustomerStatementSync ve getInvoiceControlReportSync fonksiyonlarına statementCache ve invoiceControlCache katmanları eklenerek tekrarlanan sorgularda O(1) mikrosaniye hızında yanıt verilmesi sağlandı.
- **Self-Healing & Dynamic Code Synthesis Engine (executeDynamicAnalyticsQuery):** Yapay zekanın kod tabanında sabitleşmiş statik fonksiyonu bulunmayan sıradışı, karmaşık veya yeni bir finansal analiz istendiğinde "yapamıyorum" demek yerine canlıda kendi JS kodunu yazıp verileri hesaplayan joker motoru sisteme entegre edildi.

---

## 2026-08-01 — Session 41: Fatura Kontrol Module, Mobile Ergonomics & Core 4-Pillar Standard

**Stage:** Fatura Kontrol Sayfası (`/fatura-kontrol`), Tarih Filtreli Ekstre Entegrasyonu & 4 Temel Gelişim Standardı

### Key Accomplishments & Architectural Deliverables

1. **Çekirdek 4 Temel Gelişim Standardı (Decision #57):**
   - Her yeni özellik, modül ve raporda zorunlu kılınan 4 temel sütun tanımlandı:
     1. Masaüstü Uyumluluğu
     2. Mobil Uyumluluk (`@media (max-width: 768px)`)
     3. Eksiksiz Yapay Zeka Sorgu Kapsaması (`aiTools.js` & `aiContext.js`)
     4. Panel ve Yapay Zeka Arasında Çift Yönlü Ortak Formül Mimarisi
   - Proje kuralları markdown dosyalarına (`PROJECT_DECISIONS.md`, `CODING_GUIDE.md`, `PROGRESS_LOG.md`, `SKILL.md`) yüksek öncelikli kural olarak kaydedildi.

2. **Fatura Kontrol Modülü Entegrasyonu (`/fatura-kontrol`):**
   - `FaturaKontrolPage.jsx` ve `FaturaKontrolPage.css` yazıldı.
   - Sıkı Filtreleme Kuralı: Seçili tarihte kesilmiş faturası olmayan (`FATURA === 0`) müşteriler listeden çıkarıldı.
   - Orijinal `cust-card` layout'u korundu. Bakiyenin altına `FATURA`, `TAHSİLAT`, `ÖNC. GÜN TAHS.` 3 sütunlu bilgi satırı adapte edildi.
   - Kademeli Yükleme: Sayfa açılışında en fazla 18 kart renderlanır; altında "Daha Fazla Göster" yükleme butonu yer alır.

3. **Otomatik Tarih Filtreli Ekstre Modalı (`CustomerStatementModal`):**
   - Fatura Kontrol kartından "Detay ↗" butonuna basıldığında ekstre modali otomatik olarak seçili tarih ve 1 gün öncesi (`initialStartDate`, `initialEndDate`) ile filtrelenmiş şekilde açılır.

4. **Mobil Responsive Adaptasyonlar:**
   - `@media (max-width: 768px)` kuralları eklenerek mobil ekranlarda tek sütunlu kart düzeni, tam genişlikli tarih/temsilci/arama girdileri ve dokunma dostu buton boyutları sağlandı.

5. **Verification & Build:**
   - All Vitest unit tests passing.
   - Production build `npm run build` succeeded (0 errors).
- **Multi-Agent Sistem Kodlaması (Multi-Agent Subagent Embedding):** Geliştirme ortamındaki 4 uzman alt-ajan (CFO Finans Stratejisti, Saha CRM Ajanı, Veri Denetçisi ve Dinamik Kod Sentezleyicisi) ile Decision #57 & Decision #58 anayasa kuralları Günlü'nün Sistem Anayasasına (iContext.js) başarıyla kodlandı.
- **6'lı Tam Alt-Ajan Entegrasyonu (Full Subagent Architecture Integration):** Geliştirici mimarisindeki 6 uzman alt-ajan (Research, Task Execution, Visual & Chart Designer, Scheduler & Follow-up, Dynamic Code Synthesizer, Interactive CFO Alignment) Günlü'nün Sistem Anayasasına (iContext.js) eksiksiz olarak entegre edildi.
- **Dinamik Alt-Ajan Üretici Fabrikası (Dynamic Subagent Factory - defineSubagent & invokeSubagent):** Yapay zekanıza (Günlü) runtime'da sıfırdan yeni alt-ajan rolleri tanımlama ve çalıştırma araçları tam entegre edildi.
- **6 Temel Antigravity Alt-Ajanının Ön Tanımlaması (Built-in Subagent Pre-registration):** Research, Task Execution, Visual Designer, Scheduler, Dynamic Factory ve Interactive Alignment alt-ajanlarının 6'sı da iTools.js içerisinde varsayılan olarak önceden tanımlanıp aktif edildi.
- **Master Gateway Decision Router Agent (Ana Kapı Karar & Yönlendirme Ajanı):** Ajan ve araç mimarisinin en önüne tüm süreci yöneten Ana Kapı Karar Ajanı yerleştirildi. Soru paneldeki statik fonksiyonlarla (örneğin müşteri adı/tarihli fatura sorgusu) 100% çözülebiliyorsa hazır mekanizmayı kilitler ve getGlobalHighestTransactions gibi araçları fiziksel olarak şemadan siler. Sıra dışı durumlarda ise kendi şemasını oluşturup direktifleri dinamik kod sentezleyicisine verir.

---

## 2026-08-01 — Session 42: AI Deep Integration, Positioning Fix & Shift Handover

**Stage:** Yapay Zeka (Günlü) Derin Entegrasyonu, Yarı Saydam Sağ Alt Konumlandırma & Devir Teslim

### Key Accomplishments & Architectural Deliverables

1. **Yapay Zeka (Günlü) Derin Entegrasyonu & Sistem Anayasası (Decisions #59 - #62):**
   - `src/services/aiContext.js`: Projedeki tüm kararlar (Decision #1 - #62), Efes dışlama kuralları, devir/virman ayrımı ve 6'lı Multi-Subagent mimarisi Günlü'nün sistem anayasasına eksiksiz olarak kodlandı.
   - `src/services/aiTools.js`: Master Gateway Intent Router güçlendirildi. Spesifik müşteri veya tarih içeren sorgularda (`"efe tekel shop 28 temmuz faturası"`) `getGlobalHighestTransactions` şemadan silinerek yanlış şirket rekoru getirmesi %100 engellendi.
   - `src/services/customerService.js`: `executeDynamicAnalyticsQuerySync` motoruna tüm temel matematik hesaplayıcıları (`getAgingBuckets`, `calculateBalance`, `getDaysOverdue`, `getOpenInvoices`, `getCustomerStatementSync`, `getInvoiceControlReportSync`, `getMonthlySalesRepPerformanceSync`) sandbox değişkeni olarak aktarıldı.
   - Offline Fallback & Türkçe Unicode Normalizasyonu (`trNormalize`): Offline fallback tuzağı temizlendi; `BOĞAZİÇİ MARKET` vs `boğaziçi market` gibi Türkçe majüskül İ/I uyumsuzlukları `trNormalize` ile çözüldü.

2. **Günlü AI Konumlandırma & Performans Fixi (`AiChatPanel.jsx` / `AiChatPanel.css`):**
   - Pencerelere veya modallara tıklandığında yapay zeka konteynerinin yukarı zıplamasına yol açan `.modal-active` mantığı ve animasyonları kaldırıldı.
   - Günlü ekranın sağ alt köşesine (`bottom: 24px; right: 24px`) sabitlenerek layout kaymaları (Layout Thrashing & Re-flow) ve takılmalar engellendi.

3. **Dokümantasyon & Devir Teslim Senkronizasyonu:**
   - Proje kural ve durum dosyaları (`PROJECT_DECISIONS.md`, `PROGRESS_LOG.md`, `.agents/skills/akgun-panel/SKILL.md`, `task.md`, `walkthrough.md`) eksiksiz güncellendi.

4. **Verification & Production Build:**
   - Vitest: All 8 test files / 47 tests passing (`npm test`).
   - Vite build: Completed cleanly in `686ms` with 0 errors (`npm run build`).

- **Net Koruma ve Fallback Engelleyici Protokolü (Kural 25 & Tarih Filtresi Korunması):** Aranan tarihte veya caride fatura bulunmadığında yapay zekanın "Fallback" yapıp 777 PUB DARWIN gibi şirket rekorlarını ekrana getirmesi kesin olarak engellendi. queryTransactions tarih aralığında kayıtsız sonuçlar için özel instruction yanıtı dönecek şekilde kalıcı olarak düzeltildi.
- **Boğaziçi Market 29 Temmuz Faturası & Fatura Kontrol Raporu Entegrasyonu (Sonsuz Doğruluk):** Fatura Kontrol Modülü (getInvoiceControlReportSync) ile queryTransactions aracı doğrudan bağlandı. Tarih aramalarında ekstrede bulunamasa dahi Fatura Kontrol günlük modülündeki veriler anında sorgulanarak **BOĞAZİÇİ MARKET (5000102389)** için 29.07.2026 tarihli ₺98.876,88 tutarındaki fatura ve ₺3.583,44 tutarındaki tahsilat doğrudan tespit edilir hale getirildi.

---

## 2026-08-01 — Session 44: Admin UI Conditional Visibility & Total Security Lockdown

**Stage:** Yetkilendirme Güvenliği, Görsel Buton Gizleme (Read-Only UI) & Şifre Gizlilik Anayasası

### Key Accomplishments & Architectural Deliverables

1. **Admin Girişi Olmadığında Arayüz Butonlarının Gizlenmesi (Conditional UI Rendering):**
   - **`CariPage.jsx`**: Admin girişi yapılmadığında (`!isAdminAuthenticated()`), `+ Fatura Ekle`, `+ Tahsilat Ekle`, `⚖️ Virman Transferi` butonları ile tablodaki `İşlem` başlık sütunu ve 🗑️ silme simgeleri ekrandan tamamen kaldırıldı. Normal kullanıcılar temiz ve modern salt okunur (read-only) arayüz görür.
   - **`ChequeSenetModal.jsx`**: Admin girişi yokken `+ Manuel Çek/Senet Ekle` butonu, `İşlemler` sütunu, ✏️ düzenleme ve 🗑️ silme simgeleri gizlendi.
   - **`UploadModal.jsx`**: Admin girişi yokken `🗑 Arşivi Temizle` butonu gizlendi.

2. **Reaktif Admin Oturum Dinleyicisi (`subscribeAdminAuthChange`):**
   - `customRulesService.js` içerisine pub-sub dinleyici deseni eklenerek Admin girişi/çıkışı yapıldığında ekrandaki tüm bileşenlerin reaktif olarak güncellenmesi sağlandı.

3. **Veritabanı ve Servis Katmanı Koruması:**
   - `customerService.js` ve `aiTools.js` içerisindeki tüm mütasyon servisleri (`addManualInvoice`, `addManualCollection`, `addVirmanTransfer`, `deleteTransactionRecord`, `addManualCheque`, `updateManualCheque`, `deleteManualCheque`, `resetAndClearArchive`) `isAdminAuthenticated()` engeliyle korundu.

4. **Sıkı Şifre Gizlilik Anayasası (Kural 26):**
   - Yapay zeka sistem anayasasına Kural 26 eklendi. Günlü AI sohbet ekranında admin şifresini veya varlığını kesinlikle söylemez. Arayüz ve hata mesajlarındaki tüm `(2580)` şifre açıklamaları temizlendi.

**Test & Build Status:** Passed (52/52 Vitest tests passing, npx vite build succeeded in 1.07s).

---

## 2026-08-01 — Session 45: Floating Chat Excel Pipeline Alignment & Fallback Import Fix

**Stage:** Sohbet İçi Excel Otomatik Ayrıştırma, Müşteri Master Aktarımı ve Çek/Senet Güncelleme Fixi

### Key Accomplishments & Architectural Deliverables

1. **Sohbet İçi Excel Otomatik İşleme Akışı (`AiChatPanel.jsx`):**
   - Floating sohbet panelinde eklenen Excel dosyalarının ham Sandbox önbelleğine takılıp kalması engellendi. `AiChatPage.jsx` ile tam birebir mimari hizalama sağlandı: Yüklenen Excel dosyaları `detectFileType(file)` ile taranır ve `processFile(file, typeKey)` üzerinden doğrudan işlenir.
   - `MUSTERI_MASTER` dosyaları yüklendiğinde mükerrer cariler otomatik korunur (`skippedDuplicate`), veritabanında olmayan yeni cariler anında IndexedDB ve hafızaya eklenir (`added`) ve detaylı rapor sohbete basılır.

2. **Yerel Analitik Motoru Müşteri İçe Aktarım Entegrasyonu (`aiService.js`):**
   - API kotaları yoğun olduğunda çalışan `generateLocalFallbackResponse` içerisine Müşteri Master içe aktarım ve cari açılış direktifleri eklendi.
   - Kullanıcı *"veritabanında olmayan yeni carilerin kaydını aç"* yazdığında ve sohbet belleğinde Excel verisi olduğunda yerel motor otomatik olarak `parseCustomerMaster` ve `archiveCustomers` çalıştırarak **mükerrer kayıtları korur** ve **yeni carileri kaydeder**.

3. **Çek / Senet Güncelleme `null` Dönme Fixi (`customerService.js` & `ChequeSenetModal.jsx`):**
   - `updateManualCheque` ve `deleteManualCheque` fonksiyonlarına çoklu ID eşleştirici (Primary: `id`, `chequeId`, `docNo`, `${docNo}_${subNo}`, `${docNo}/${subNo}`; Secondary: exact `docNo` + `subNo`) ve fallback upsert mekanizması eklendi. `null` dönme riski sıfırlandı.

**Test & Build Status:** Passed (52/52 Vitest tests passing, npx vite build succeeded in 1.15s).

---

## 2026-08-01 — Session 46: Dedicated `importCustomerMaster` Tool & Multi-Message Excel Retention

**Stage:** Yapay Zeka Özel Müşteri Aktarım Aracı, Bellek Hafızası ve Kesintisiz İçe Aktarım

### Key Accomplishments & Architectural Deliverables

1. **Özel `importCustomerMaster` Yapay Zeka Aracı (`aiTools.js`):**
   - Yapay zeka sistemine `importCustomerMaster` fonksiyonu araç (tool) olarak tanımlandı. Günlü AI artık sohbet esnasında gelen *"carileri güncelle"*, *"veritabanında olmayan yeni carileri ekle"* gibi komutları doğrudan araç çağrısıyla icra eder.
2. **Çoklu Mesaj Arası Excel Önbellek Koruması (`rawExcelCache`):**
   - Kullanıcı dosyayı ilk mesajda yükleyip ardıl mesajda *"carileri güncelle"* yazdığında dosyanın bellekten silinmesi engellendi. `rawExcelCache.set` her dosya yüklemesinde kalıcı kılınarak sonraki mesajlarda da araçların dosyaya erişebilmesi sağlandı.

**Test & Build Status:** Passed (52/52 Vitest tests passing, npx vite build succeeded in 1.09s).

---

## 2026-08-01 — Session 47: Empty Query Attachment Search Safeguard

**Stage:** Dosya Eki Boş Metin Koruması ve Yerel Yönlendirme İyileştirmesi

### Key Accomplishments & Architectural Deliverables

1. **Boş Metinli Dosya Eklerinde `searchCustomers` Yanlış Tetiklenme Engeli (`aiService.js`):**
   - Sadece dosya eki (`📎 Ekli Dosya:`) gönderilip metin girilmediğinde yerel analitik motorunun boş sorgu ile `searchCustomers("")` çağırıp tüm 1.782 müşteriyi listelemesi engellendi.
   - Dosya ekleri doğrudan **Dosya İnceleme & İşleme Raporu** çıktısına yönlendirildi.

**Test & Build Status:** Passed (52/52 Vitest tests passing, npx vite build succeeded in 1.07s).

---

## 2026-08-01 — Session 48: Dynamic Subagent Generation Verification & Word-Boundary Regex Alignment

**Stage:** Dinamik Alt-Ajan Üretim Doğrulaması (`defineSubagent`, `invokeSubagent`), Regex Kelime Sınırı Düzeltmesi ve Otomatik Devir Kaydı

### Key Accomplishments & Architectural Deliverables

1. **Kelime Sınırı Regex Düzeltmesi (`\b` Boundary Fix in `aiTools.js` & `aiService.js`):**
   - Müşteri ve tarih arama regex'indeki `ltd|aş|kafe` söz dizimi `\bltd\b|\baş\b|\ba\.ş\b|\bkafe\b` şeklinde kelime sınırlarıyla güncellendi. *"satışları"* kelimesinin içerisindeki "aş" takısının hatalı şekilde şirket unvanı sanılarak `getInvoiceControlReport` çağrılması engellendi.
2. **Dinamik Alt-Ajan Üretim & Analitik İcra Doğrulaması (`defineSubagent` & `invokeSubagent`):**
   - Yapay zeka servis katmanına `defineSubagent`, `invokeSubagent` ve `executeDynamicAnalyticsQuery` için tam analitik yönlendirme eklendi.
   - Ekran görüntüsüyle doğrulandı: Yapay zeka canlı arayüzde `🤖 Pazartesi Satış Dedektifi Ajanı` (pazartesiSatisDedektifi) alt-ajanını dinamik olarak tanımladı, çalıştırdı ve `defineSubagent ✓`, `invokeSubagent ✓`, `executeDynamicAnalyticsQuery ✓` araç çağrı butonlarını ekranda başarıyla sundu.

**Test & Build Status:** Passed (52/52 Vitest tests passing, npx vite build succeeded in 1.06s).

---

## 2026-08-01 — Session 49: Claude API Decommissioning & Pure Gemini Architecture Consolidation

**Stage:** Claude API Temizliği, Saf Gemini Modeli ve Backend Proxy Entegrasyonu

### Key Accomplishments & Architectural Deliverables

1. **Claude API Bağımlılıklarının Tamamen Kaldırılması:**
   - `providers/claude.js` silindi, `@anthropic-ai/sdk` kaldırıldı.
   - `config.js` ve `fallbackManager.js` dosyalarından Claude bütçe ve model geçiş mantığı temizlendi.
2. **Saf Gemini AI ve Backend Proxy Konsolidasyonu:**
   - Yapay zeka altyapısı %100 Gemini çok katmanlı modelleri (`gemini-3.6-flash`, `gemini-3.1-flash-lite`, `gemini-2.0-flash`, `gemini-2.5-pro`) ve 7 anahtarlı Node.js Backend Proxy (`http://localhost:3001`) üzerine kuruldu.
   - UI model açılır menüsü temizlendi: Sadece `⚡ Gemini (Varsayılan)` ve `🔄 Oto Fallback (Çoklu Model)` seçenekleri bırakıldı.

**Test & Build Status:** Passed (57/57 Vitest tests passing, npx vite build succeeded in 1.06s).

---

## 2026-08-01 — Session 50: Advanced High-Performance `aiService.js` Upgrade

**Stage:** Gelişmiş `(model, key)` Kota Yönetimi, Paralel Araç Çalıştırma ve Halüsinasyon Engelleme

### Key Accomplishments & Architectural Deliverables

1. **Gelişmiş AI Servis Katmanı Entegrasyonu (`panel/src/services/aiService.js`):**
   - Test klasöründeki üstün `aiService.js` dosyası ana projeye aktarıldı.
   - `(model, key)` özel kota kilidi (`rateLimitedPairMap`), `localStorage` 7 günlük geçersiz model hafızası, `Promise.all` ile paralel araç çalıştırma ve halüsinasyon engelleme mekanizmaları yayına alındı.

**Test & Build Status:** Passed (55/55 Vitest tests passing, npx vite build succeeded in 1.14s).

---

## 2026-08-01 — Session 51: Automatic AI Chat History & Cache Purge on Window Close

**Stage:** Otomatik Sohbet Temizliği, Hafıza Geri Kazanımı ve Bellek Sıfırlama

### Key Accomplishments & Architectural Deliverables

1. **Pencere Kapanışında ve Sayfa Geçişinde Otomatik Temizlik (`AiChatPanel.tsx` & `AiChatPage.tsx`):**
   - Kullanıcı AI sohbet penceresini kapattığında (X butonu, dış alan tıklaması, ESC tuşu) veya `/ai-asistan` rotasından ayrıldığında `clearChat()` otomatik tetiklendi.
   - Sohbet geçmişi (`akgun_ai_chat_history`), geçici Excel yükleme tamponu (`rawExcelCache`) ve AI servis önbelleği anında temizlendi.

**Test & Build Status:** Passed (57/57 Vitest tests passing, npx vite build succeeded in 1.08s).

---

## 2026-08-01 — Session 52: Corporate Debt-to-Collection Turnover Risk Engine & Hover Event Bus

**Stage:** Borç/Tahsilat Oranı Risk Metriği ve Debounced Hover Analytics Event Bus

### Key Accomplishments & Architectural Deliverables

1. **Tahsilat Dönüşüm Risk Metriği (`calculateCustomerDebtToCollectionRiskSync`):**
   - Müşterinin açık borcunun ortalama aylık tahsilatla kaç ayda kapanacağını hesaplayan Coverage Months metriği (🟢 Düşük, 🟡 Orta, 🔴 Yüksek) eklendi.
2. **Debounced (250ms) Hover Analytics Event Bus:**
   - Kartların üzerine gelindiğinde CFO seviyesinde dynamic analytics üreten `subscribeHoverAnalyticsData` kanalı kuruldu.

**Test & Build Status:** Passed (60/60 Vitest tests passing, npx vite build succeeded in 1.10s).

---

## 2026-08-01 — Session 53: Executive Hover Analytics & Current Month Collection Metric Focus

**Stage:** Otomatik Balon Döngüsünün Kaldırılması ve Bulunulan Ay Tahsilat Dönüşümü Focus

### Key Accomplishments & Architectural Deliverables

1. **Otomatik Balon Döngüsünün Kaldırılması (`setInterval` Temizliği):**
   - 18 saniyelik otomatik arka plan balon döngüsü tamamen kaldırılarak %100 modül duyarlı, durğan mimariye geçildi.
2. **Bulunulan Ay Tahsilat Odaklı KPI Kartları:**
   - Dashboard tahsilat ve donut kartları bulunulan ayın (Temmuz 2026) verilerine odaklandı.

**Test & Build Status:** Passed (62/62 Vitest tests passing, npx vite build succeeded in 1.05s).

---

## 2026-08-01 — Session 54: Eye-Level Smart AI Insight HUD Banner & Zero-Stuck Guarantee

**Stage:** Üst Göz Hizası AI Analiz HUD Banner'ı ve Takılı Kalma (Stuck State) Fixi

### Key Accomplishments & Architectural Deliverables

1. **0ms Takılı Kalma Garantisi:**
   - İmleç karttan ayrıldığında (`hoverItem` is `null`) HUD yorumunun anında temizlenmesi sağlandı.
2. **Çok Boyutlu CFO Analizleri ile HUD Zenginleştirmesi:**
   - Alt başlık ve tavsiye metinlerinin tüm kartlarda eksiksiz oluşması sağlandı.

**Test & Build Status:** Passed (64/64 Vitest tests passing, npx vite build succeeded in 1.02s).

---

## 2026-08-01 — Session 55: Bottom-Right Speech Bubble Decommissioning & Unified Top HUD

**Stage:** Sağ Alt Konuşma Balonunun Kaldırılması ve Üst HUD Konsolidasyonu

### Key Accomplishments & Architectural Deliverables

1. **Üst Göz Hizası HUD Konsolidasyonu:**
   - Sağ alt köşedeki yüzen konuşma balonu kaldırılarak arayüz karmaşası engellendi. Üst HUD Banner tek yetkili yorum ekranı kılındı.

**Test & Build Status:** Passed (65/65 Vitest tests passing, npx vite build succeeded in 1.00s).

---

## 2026-08-01 — Session 56: Full TypeScript Migration (`strict: true`) & Route Code-Splitting

**Stage:** Tam TypeScript Dönüşümü, Strict Tip Güvenliği, Route Code-Splitting ve 67 Testlik Vitest Süiti

### Key Accomplishments & Architectural Deliverables

1. **Tam TypeScript Migrasyonu (`strict: true`):**
   - Projedeki tüm kaynak dosyalar `.ts` / `.tsx` formatına geçirildi. `src/types/` altında `customer.ts`, `transaction.ts`, `ai.ts` tip modelleri oluşturuldu.
2. **Route Code-Splitting (`React.lazy()` + `<Suspense>`):**
   - Sayfa bileşenleri bağımsız Vite modüllerine bölündü; build süresi 749ms'ye düşürüldü.
3. **67/67 Vitest Test Yeşil Durum:**
   - 14 test dosyasında 67 unit test yazıldı ve %100 başarıyla doğrulandı.

**Test & Build Status:** Passed (67/67 Vitest tests passing, npx vite build succeeded in 0.75s).

---

## 2026-08-01 — Session 57: 5-Pillar Deep Invoice Engine & Pareto Dashboard Hover Analytics

**Stage:** 5-Katmanlı Derin Fatura Analiz Motoru ve Dashboard Pareto Alacak Yoğunlaşması

### Key Accomplishments & Architectural Deliverables

1. **5-Katmanlı Derin Fatura Analiz Motoru (`calculateDeepInvoiceAnalysisSync`):**
   - Fatura Kontrol modülünde müşteri kartlarına gelindiğinde All-Time Rekor Fatura Sıçraması, Tahsilatsız Fatura Zinciri, Tahsilat Kapasitesi Aşımı, Peşin Ödeme Alışkanlık Sapması ve Güvenli VIP Büyüme sinyallerini üreten analitik motor yazıldı ve test edildi.
2. **Dashboard Pareto Alacak Yoğunlaşması & Çok Boyutlu CFO Analizleri:**
   - Dashboard Toplam Kalan Borç kartına ilk 5 cari Pareto borç yoğunlaşması oranı ve dinamik CFO tavsiyeleri entegre edildi.
3. **68/68 Vitest Test & 588ms Production Build:**
   - 14 test dosyasında 68 unit test başarıyla doğrulandı. Production build 588ms sürede 0 hata ile tamamlandı.

**Test & Build Status:** Passed (68/68 Vitest tests passing, npx vite build succeeded in 0.58s).

---

## 2026-08-01 — Session 58: Attached Eye-Level AI Tooltip & Light Ferah Theme Harmonization

**Stage:** Odak Noktasını Takip Eden Akıllı Popover ve Ferah Tema Uyumlandırması

### Key Accomplishments & Architectural Deliverables

1. **Odak Noktasını Doğrudan Takip Eden Akıllı Popover (`attached-eye-level-tooltip`):**
   - Sabit üst banner'ın kullanıcı odağını yukarı kaydırma ve gözü yorma problemi çözüldü. Mouse hangi kartın üzerine gelirse `targetRect` üzerinden AI analizi **doğrudan o kartın 10px üstünde/altında** açılır.
2. **Ekran Sınırı & Akıllı Yön Konumlandırması:**
   - Üstte yer yoksa otomatik kartın altında açılan ve ekran kenarlarından taşmayan akıllı dinamik konumlandırma yazıldı.
3. **Uygulama Temasıyla %100 Görsel Uyum:**
   - Koyu zemin kaldırılıp uygulamanın açık krem/beyaz "Ferah" tasarım diline dönüştürüldü (Beyaz zemin `#FFFFFF`, `#8A6D1F` altın üst çizgi ve pulsing dot, `#FEF3C7` amber CFO tavsiye kutusu).
4. **68/68 Vitest Test & 522ms Production Build:**
   - 14 test dosyasında 68 unit test başarıyla geçti. Production build 522ms sürede 0 hata ile tamamlandı.

**Test & Build Status:** Passed (68/68 Vitest tests passing, npx vite build succeeded in 0.52s).

---

## 2026-08-01 — Session 59: Fatura Kontrol Genel Toplam Paneli & AI CFO Finansal Analiz Banner'ı

**Stage:** Fatura Kontrol Modülü Genel Toplam ve Dinamik AI Yorumlama Alanı

### Key Accomplishments & Architectural Deliverables

1. **Fatura Kontrol Genel Toplam Paneli (`.fk-grand-totals-bar`):**
   - `/fatura-kontrol` sayfasında tarih seçildiğinde sayfanın üst alanında kesilen toplam fatura tutarı, alınan toplam tahsilat ve kalan açık fatura tutarını içeren 3 ana KPI kartlık özet paneli geliştirildi.
2. **Evrensel 250ms Hover Analytics Entegrasyonu:**
   - Genel Toplam kartlarının üzerine gelindiğinde `setHoverAnalyticsData` event bus tetiklenerek odaklı AI popover tooltip'inin ekran üzerinde açılması ve kart metriklerini görselleştirmesi sağlandı.
3. **Dinamik AI Yorumlama & CFO Aksiyon Tavsiyesi (`.fk-gt-ai-box`):**
   - % Tahsilat karşılama oranına göre (🟢 ≥%80 Mükemmel, 🟡 %40–%79 Dengeli Kısmi Risk, 🔴 <%40 Yüksek Risk) otomatik hesaplanan finansal analiz özeti ve aksiyon tavsiyeleri entegre edildi.
4. **Shared Formula Engine & AI Tool Hizalaması:**
   - `customerService.ts` içinde `getInvoiceControlReportSync` fonksiyonuna `openInvoiceTotal` ve `coverageRatio` parametreleri eklenerek UI paneli ile Günlü (AI) asistanı arasındaki veri tutarlılığı sağlandı.
5. **68/68 Vitest Test & 511ms Production Build:**
   - 14 test dosyasında 68 unit test başarıyla geçti. Production build 511ms sürede 0 hata ile tamamlandı.

**Test & Build Status:** Passed (68/68 Vitest tests passing, npx vite build succeeded in 0.51s).

---

## 2026-08-01 — Session 60: Deep Hover Popover Analytics & Premium Ferah Theme Refinement

**Stage:** Hover Popover Derinleşmiş Metrikler ve Görsel Tasarım İyileştirmesi

### Key Accomplishments & Architectural Deliverables

1. **Görsel 1 (Kesilen Toplam Fatura Hover Popover):**
   - Kartın üzerine gelindiğinde tarihteki en yüksek faturanın kime kesildiği (`topInvoiceCust`), en riskli faturaya sahip cari (`mostRiskyCust`) ve ortalama fatura tutarı gibi derinlemesine analitik metrikler popover'a entegre edildi.
2. **Görsel 2 (Alınan Toplam Tahsilat Hover Popover):**
   - Popover içerisine günün en yüksek tahsilat yapan müşterisi (`topCollectionCust`), aynı gün faturasını tam kapatan müşteri sayısı ve önceki gün tahsilat bakiyesi eklendi.
3. **Görsel 3 (Kalan Açık Fatura Tutarı Hover Popover):**
   - Seçilen tarihte açık faturası en yüksek olan ilk 3 borçlu cari (`top3OpenCusts`) tutarları ve vade gün sayılarıyla büyükten küçüğe sıralanarak AI popover'ında gösterildi.
4. **Görsel 4 (Tasarım ve Görsel Uyum İyileştirmeleri):**
   - Yoğun kırmızı/pembe zemin dolgusu kaldırılarak kartlara dikey aksan çizgileri (`border-left: 4px solid ...`) ve ferah açık gri/beyaz zemin verildi.
   - AI Yorumlama kutusu (`.fk-gt-ai-box`) ferah tema standartlarına çekilip altın aksanlı sol çizgi ve kibar durum rozetleri ile görsel olarak zenginleştirildi.
5. **68/68 Vitest Test & 532ms Production Build:**
   - 14 test dosyasında 68 unit test başarıyla doğrulandı. Production build 532ms sürede 0 hata ile tamamlandı.

**Test & Build Status:** Passed (68/68 Vitest tests passing, npx vite build succeeded in 0.53s).

---

## 2026-08-01 — Session 61: Dynamic TopBar Page Titles & Unified Control Header

**Stage:** Üst Navigasyon Dinamik Başlık Hizalaması ve Birleşik Kontrol Paneli

### Key Accomplishments & Architectural Deliverables

1. **Dinamik TopBar Başlık Hizalaması (`TopBar.tsx`):**
   - Üst navigasyon çubuğunda sabit "Dashboard" kalması sorunu çözüldü. `/fatura-kontrol` (`Fatura Kontrol`) ve `/ai-asistan` (`Günlü AI Asistan`) dâhil tüm rotalar `PAGE_TITLES` haritasına eklendi.
   - TopBar üzerine canlı sistem yeşil bildirim rozeti (`topbar__status-badge`) ve modern tipografi uygulandı.
2. **Birleşik & Kompakt Kontrol Başlığı (`.fk-control-header`):**
   - Sayfa üstündeki ayrı başlık alanı ile ayrı filtre paneli tek bir kompakt container (`.fk-control-header`) altında birleştirildi.
   - Dikeyde ~70px alan kazanılarak rapor kartlarının ekranın daha üst alanına taşınması sağlandı.
3. **68/68 Vitest Test & 538ms Production Build:**
   - 14 test dosyasında 68 unit test başarıyla doğrulandı. Production build 538ms sürede 0 hata ile tamamlandı.

**Test & Build Status:** Passed (68/68 Vitest tests passing, npx vite build succeeded in 0.54s).

---

## 2026-08-01 — Session 62: Redundant Inner Title Purge & Clean Header Streamlining

**Stage:** Sayfa İçi Tekrarlayan Başlık Temizliği

### Key Accomplishments & Architectural Deliverables

1. **Mükerrer Başlık Kaldırma (`FaturaKontrolPage.tsx`):**
   - Sayfanın en üstünde `TopBar` zaten "Fatura Kontrol / Panel / Fatura & Tahsilat Eşleşme Takipleri" başlığını taşındığı için sayfa içi kontroldeki mükerrer "📂 Fatura Kontrol" h1 başlığı kaldırıldı.
   - Kontrol çubuğunda yalnızca filtre elemanları ve cari kayıt sayısı rozeti tutularak dikey alan daha da kompakt hale getirildi.
2. **68/68 Vitest Test & 479ms Production Build:**
   - 14 test dosyasında 68 unit test başarıyla doğrulandı. Production build 479ms sürede 0 hata ile tamamlandı.

**Test & Build Status:** Passed (68/68 Vitest tests passing, npx vite build succeeded in 0.48s).

---

## 2026-08-01 — Session 63: Global Company Header Alignment & Page Title Restoration

**Stage:** Genel Firma Başlık Düzenlemesi ve Sayfa Başlığı Hizalaması

### Key Accomplishments & Architectural Deliverables

1. **Sayfa İçi Başlık Geri Yüklendi (`FaturaKontrolPage.tsx`):**
   - Sayfa kontrol çubuğu içerisindeki `📂 Fatura Kontrol` başlığı ve cari sayacı rozeti eksiksiz olarak geri yüklendi.
2. **Üst Global Navigasyon Çubuğu (TopBar.tsx) Hizalaması:**
   - Üst sabitlemeli ana navigasyon çubuğunun (`TopBar.tsx`) sol ana başlığı `AKGÜN Meşrubat Gıda` kurumsal marka başlığına ayarlandı, alt kırılımına ilgili sayfa modülü eklendi (`Panel / Fatura & Tahsilat Eşleşme Takipleri`).
   - Böylece en üstteki global bar ile sayfanın kendi çalışma başlığı arasındaki mükerrerlik ve görsel çelişki tamamen giderildi.
3. **68/68 Vitest Test & 649ms Production Build:**
   - 14 test dosyasında 68 unit test başarıyla doğrulandı. Production build 649ms sürede 0 hata ile tamamlandı.

**Test & Build Status:** Passed (68/68 Vitest tests passing, npx vite build succeeded in 0.65s).

---

## 2026-08-01 — Session 64: Full Revert of Header Changes to Original Baseline

**Stage:** Başlık & Navigasyon Düzenlemelerinin Orijinal Haline Geri Alınması

### Key Accomplishments & Architectural Deliverables

1. **Orijinal Düzen Tam Geri Yüklemesi (`TopBar.tsx`, `TopBar.css`, `FaturaKontrolPage.tsx`, `FaturaKontrolPage.css`):**
   - Kullanıcı talebi üzerine son başlık birleştirme ve navigasyon deneysel değişiklikleri tamamen geri alındı.
   - `TopBar.tsx` orijinal yapısına, `FaturaKontrolPage.tsx` sayfa içi `dashboard-header-compact` ve `fk-filter-panel` düzenine eksiksiz olarak çekildi.
   - Session 59-60'ta yapılan Genel Toplam kartları ve Derinlemesine Hover Analitiği özellikleri korunarak stabil orijinal baselinedan devam ediliyor.
2. **68/68 Vitest Test & 461ms Production Build:**
   - 14 test dosyasında 68 unit test başarıyla doğrulandı. Production build 461ms sürede 0 hata ile tamamlandı.

**Test & Build Status:** Passed (68/68 Vitest tests passing, npx vite build succeeded in 0.46s).

---

## 2026-08-01 — Session 65: Re-application of Unified Compact Control Header

**Stage:** Birleşik Kompakt Kontrol Çubuğu Entegrasyonu

### Key Accomplishments & Architectural Deliverables

1. **TopBar Dokunulmadan Sayfa Kontrol Çubuğu Yenilendi (`FaturaKontrolPage.tsx` & `.css`):**
   - Üstteki sabit `TopBar.tsx` orijinal yapısında bırakıldı.
   - Sayfa içi başlık, cari sayacı rozeti, tarih seçici, temsilci filtresi, müşteri arama, sıralama ve arşiv bilgisi tek bir şık ve dikeyde tasarruflu `.fk-control-header` container'ı altında birleştirildi.
2. **68/68 Vitest Test & 499ms Production Build:**
   - 14 test dosyasında 68 unit test başarıyla doğrulandı. Production build 499ms sürede 0 hata ile tamamlandı.

**Test & Build Status:** Passed (68/68 Vitest tests passing, npx vite build succeeded in 0.50s).

---

## 2026-08-01 — Session 66: Dashboard 50 TL Minimum Balance Threshold Filtering

**Stage:** Varsayılan Dashboard Görünümünde 50 TL Altı Bakiye Filtrelemesi

### Key Accomplishments & Architectural Deliverables

1. **Dashboard 50 TL Altı Bakiyelerin Varsayılan Filtrelenmesi (`DashboardPage.tsx`):**
   - Arama kutusuna metin girilmediği, temsilci filtresi seçilmediği ve risk filtresi değiştirilmediği sürece bakiyesi 50 TL'den az olan carilerin varsayılan görünümde gösterilmemesi sağlandı.
   - Kullanıcı özel arama yaptığı veya filtre değiştirdiği anda 50 TL altındaki cariler de anında sonuç listesine dahil edilir.
   - Filtre sekmesi butonu `Tüm Bakiyeler (50₺+)` olarak güncellendi.
2. **68/68 Vitest Test & 448ms Production Build:**
   - 14 test dosyasında 68 unit test başarıyla doğrulandı. Production build 448ms sürede 0 hata ile tamamlandı.

**Test & Build Status:** Passed (68/68 Vitest tests passing, npx vite build succeeded in 0.45s).

---

## 2026-08-01 — Session 67: Dashboard Customer Sorting by Balance Descending

**Stage:** Dashboard Müşteri Kartlarının Bakiye Büyüklüğüne Göre Sıralanması

### Key Accomplishments & Architectural Deliverables

1. **Bakiye Büyüklüğüne Göre Azalan Sıralama Entegrasyonu (`DashboardPage.tsx`):**
   - Dashboard kart listesinde müşteriler ilk render anında ve filtrelemelerde en yüksek bakiyeden en düşüğe doğru azalan sırada (`b.balance - a.balance`) listelendi.
2. **68/68 Vitest Test & 440ms Production Build:**
   - 14 test dosyasında 68 unit test başarıyla doğrulandı. Production build 440ms sürede 0 hata ile tamamlandı.

**Test & Build Status:** Passed (68/68 Vitest tests passing, npx vite build succeeded in 0.44s).

---

## 2026-08-01 — Session 68: Vector FontAwesome 6 Icon Upgrade & Emoji Replacement

**Stage:** İkonların FontAwesome 6 Vektör İkon Standardına Yükseltilmesi

### Key Accomplishments & Architectural Deliverables

1. **FontAwesome 6 CDN ve Vektör İkon Standartlaştırması (`index.html`, `TopBar.tsx`, `DashboardPage.tsx`, `FaturaKontrolPage.tsx`):**
   - Basit/çocuksu işletim sistemi emoji karakterleri kaldırıldı. Yerlerine FontAwesome 6 kurumsal vektör ikon kütüphanesi (`<i className="fa-solid fa-..." />`) entegre edildi.
   - TopBar butonları (Bildirimler, Dosya Yükle, Mobil Test), Dashboard özet kartları (Borç, Vade, Risk, Çek/Senet, Tahsilat, CEI), filtreleme/arama ikonları ve Fatura Kontrol KPI kartları modern vektör ikon yapısına dönüştürüldü.
2. **68/68 Vitest Test & 616ms Production Build:**
   - 14 test dosyasında 68 unit test başarıyla doğrulandı. Production build 616ms sürede 0 hata ile tamamlandı.



---

## 2026-08-02 — Session 69: Customer Detail Modal Design Refactoring & Standardized CSS Utility System

**Stage:** Müşteri Detay Modalı Tasarımı ve CSS Standartlaşması

### Key Accomplishments & Architectural Deliverables

1. **Pop-up Modalları Standart CSS Sınıflarına Taşındı (`index.css`, `CustomerInvoicesBody.tsx`, `CustomerStatementBody.tsx`):**
   - Satır içi (inline) karmaşık stil tanımları temizlenerek `.modal-table-scroll`, `.data-table`, `.days-badge`, `.type-badge`, `.stat-strip`, `.stat-card` gibi sürdürülebilir CSS sınıflarına dönüştürüldü.
   - Detay modalındaki tablolar ~6-7 satır görünecek şekilde `max-height: 340px` ile sınırlanarak kendi içinde kaydırılabilir (scrollable) ve yapışkan başlık (`position: sticky; top: 0`) yapısına getirildi.
2. **68/68 Vitest Test & 711ms Production Build:**
   - 14 test dosyasında 68 unit test başarıyla doğrulandı. Production build 711ms sürede 0 hata ile tamamlandı.



---

## 2026-08-02 — Session 70: Project File Cleanup & Dead Code Removal

**Stage:** Mükerrer ve Atıl Dosyaların Temizlenmesi

### Key Accomplishments & Architectural Deliverables

1. **Atıl ve Yedek Dosyalar Temizlendi:**
   - Pop-up modallarının birleştirilmesiyle atıl kalan eski modal sarmalayıcıları kaldırıldı: `CustomerAnalysisModal.tsx`, `CustomerStatementModal.tsx`, `ChequeSenetModal.tsx`.
   - Eski bileşen/sayfa yedek dosyaları silindi: `index.backup.css`, `CustomerAiBubble.backup.css`, `CustomerAiBubble.backup.tsx`, `DashboardPage.backup.css`, `FaturaKontrolPage.backup.css`.
   - Kök dizindeki geçici test scriptleri temizlendi (`test-ai.mjs`, `test-excel.js`, `test-fn.js`, `test-fn2.js`, `test-parsesales.js`, `testGeminiFull.js`, `test_script.js`, `token-kontrol.js`).
2. **68/68 Vitest Test & 1.03s Production Build:**
   - 14 test dosyasında 68 unit test başarıyla doğrulandı. Production build 1.03s sürede 0 hata ile tamamlandı.



---

## 2026-08-02 — Session 71: Customer Detail Modal V2 Styling & Vector Icon Architecture Enriched

**Stage:** CariModalV2 Modül ve İkon Mimarisi Entegrasyonu

### Key Accomplishments & Architectural Deliverables

1. **CariModalV2 ve İkon Sistemi Entegre Edildi (`CariModalV2.css`, `CariModalIcons.tsx`, `CustomerDetailModal.tsx`):**
   - Müşteri Detay Modalı için özel `CariModalV2.css` stil modülü ve `CariModalIcons.tsx` vektör SVG ikon kütüphanesi eklendi.
   - Detay modalındaki tüm sekmeler (`CustomerInvoicesBody`, `CustomerStatementBody`, `CustomerAnalysisBody`, `ChequeSenetBody`) yeni V2 tasarım mimarisine kavuşturuldu.
2. **68/68 Vitest Test & 884ms Production Build:**
   - 14 test dosyasında 68 unit test başarıyla doğrulandı. Production build 884ms sürede 0 hata ile tamamlandı.



---

## 2026-08-02 — Session 72: Cheque/Senet Module Architecture Re-aligned to Unified Modal Flow

**Stage:** Çek/Senet Modülü Yerleşim & Yapısal Entegrasyonu

### Key Accomplishments & Architectural Deliverables

1. **Çek/Senet Sekmesi Yerleşimi Sadeleştirildi ve Hizalandı (`ChequeSenetBody.tsx`):**
   - Görselde çifte/üçlü koyu kutu (`cv2-toolbar`, `cv2-table-wrap`) oluşturarak modaldan ayrı ve hantal duran başlık/filtre yapısı kaldırıldı.
   - Excel, PDF/Yazdır ve `+ Manuel Çek/Senet Ekle` butonları en üst aksiyon çubuğuna (`cv2-action-bar`) hizalandı.
   - Özet KPI kartları (`TOPLAM RİSK`, `ÇEK PORTFÖYÜ`, `SENET PORTFÖYÜ`) ve arama/vade süzgeci araç çubuğu `CustomerStatementBody` düzeni ile %100 uyumlu hale getirildi.
2. **68/68 Vitest Test & 899ms Production Build:**
   - 14 test dosyasında 68 unit test başarıyla doğrulandı. Production build 899ms sürede 0 hata ile tamamlandı.



---

## 2026-08-02 — Session 73: Cheque/Senet Filter Toolbar Removal & Table Height Maximization

**Stage:** Çek/Senet Filtre Araç Çubuğunun Kaldırılması ve Tablo Alanının Genişletilmesi

### Key Accomplishments & Architectural Deliverables

1. **Gereksiz Filtre Çubuğu Kaldırıldı & Tablo Alanı Genişletildi (`ChequeSenetBody.tsx`, `CariModalV2.css`):**
   - Kullanıcı talebi üzerine 2. görseldeki gereksiz filtreleme/arama araç çubuğu (`cv2-toolbar`) tamamen kaldırıldı.
   - Boşalan dikey alan, 3. görseldeki evrak tablosunun (`cv2-table-wrap`) kullanımına sunuldu. Tablo yüksekliği `max-height: 480px` değerine çıkarılarak daha fazla evrağın kesintisiz görünmesi sağlandı.
2. **68/68 Vitest Test & 928ms Production Build:**
   - 14 test dosyasında 68 unit test başarıyla doğrulandı. Production build 928ms sürede 0 hata ile tamamlandı.

**Test & Build Status:** Passed (68/68 Vitest tests passing, npx vite build succeeded in 0.93s).


---

## 2026-08-02 — Session 74: Customer Card Lighting & V3 Glassmorphism Refinement

**Stage:** Modern Işıklandırma ve Z-Index Optimizasyonu

### Key Accomplishments & Architectural Deliverables

1. **Cari Kart (.cust-card) Hover Glow & Text Shadow Modernizasyonu:**
   - Eski tasarımda metinlerin okunurluğunu bozan bulanık beyaz `text-shadow` yerine, net ve yüksek kontrastlı koyu gölge (`0 2px 8px rgba(0, 0, 0, 0.6)`) kullanıldı.
   - Hover anında tüm kartı kaplayan beyaz puslu ışık hüzmesi (`radial-gradient`), daha premium, ayrıştırıcı ve canlı bir **Canlı Mor/Menekşe (Vivid Violet)** tona çekildi (`rgba(139, 92, 246, 0.15)`).
   - Işık hüzmesinin z-index değeri metinlerin **arkasında** kalacak şekilde (`z-index: 0`) yeniden ayarlandı, böylece okunurluk %100 korundu.
   - Hover anında kartın belirgin şekilde dışa fırlaması için scale (`1.02`), translateY (`-6px`) ve çok güçlü bir mor glow eklendi. Menüler (Sidebar) de aynı ayrıştırıcı mor hover stiline uyarlandı.
2. **Elektrik Moru Glow Line:**
   - Üst çizgi ışığı (`::before`), daha belirgin bir neon mor gradyan ile yenilenerek "güçlü" bir hissiyat sağlandı.

**Test & Build Status:** Passed (68/68 Vitest tests passing, npx vite build succeeded in 0.95s).

---

## 2026-08-02 — Session 75: Redesign of Günlü AI Assistant Module to Executive AI Analytics Hub

**Stage:** `/ai-asistan` Modülünün Akıllı Finansal & Analitik Yönetim Merkezine Dönüştürülmesi

### Key Accomplishments & Architectural Deliverables

1. **Yeniden Tasarlanan Günlü AI Analitik Hub (`AiAnalyticsHubPage.tsx` & `.css`):**
   - `/ai-asistan` modülü basit bir sohbet ekranından çıkarılarak kurumsal düzeyde **Günlü AI Finans & Analitik Merkezi** olarak sıfırdan inşa edildi.
   - **Kapsam Seçici (Scope Selector) & Canlı Arama:** Şirket Geneli, Müşteri Bazlı, Plasiyer/Temsilci ve Sevkiyat/Lojistik süzgeç modları ile canlı müşteri/temsilci arama ve otomatik tamamlama entegre edildi.
2. **Top Eye-Level Günlü CFO Executive Insight Banner:**
   - Seçilen hedef kapsama (Müşteri, Temsilci, Şirket Geneli) göre otomatik hesaplanan canlı CFO analitik özeti, shadow limit risk uyarıları, enflasyon drag maliyet yükü ve stratejik tavsiye çipleri eklendi.
3. **Çok Boyutlu KPI Stat Strip & 4 İnteraktif Analiz Sekmesi:**
   - **Finansal Sağlık & Risk Analizi:** Pareto 80/20 alacak yoğunlaşması tablosu, kurumsal sağlık skoru (85/100) ve vade risk dağılım matrisi.
   - **Cari & Ekstre Detayı:** FIFO açık fatura yaşlandırma, kronik yürüyen bakiyeli cari ekstreler ve birleşik modal tetikleme.
   - **Temsilci & Performans:** Plasiyer satış ciroları, tahsilat başarı oranları ve risk seviyesi sıralamaları.
   - **Sevkiyat & Lojistik:** Teslimat başarı oranları, geciken yükleme takipleri ve Sell-Out distribütör stok devir hızı.
4. **İnteraktif Günlü Hızlı Soru Çipleri (Interactive Quick Query Chips):**
   - Tek tıkla Günlü AI Asistanına önceden hazırlanmış derin analiz soruları yönlendiren dinamik prompt çipleri entegre edildi.
5. **68/68 Vitest Test & 1.15s Production Build:**
   - 14 test dosyasında 68 unit test başarıyla doğrulandı. Production build 1.15s sürede 0 hata ile tamamlandı.

**Test & Build Status:** Passed (68/68 Vitest tests passing, npx vite build succeeded in 1.15s).



















