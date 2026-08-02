# CODING GUIDE — Distribution Panel

*Last updated: 2026-08-01 · Version 1.1*

> **Read this file FIRST at the start of every session.** It contains the architecture,
> the decisions, and everything you need to know before touching code.
>
> Note on language: the app's **user interface stays in Turkish** (the users are Turkish).
> Only these documentation files are in English. Do not translate UI strings, Excel
> column names, or enum values such as `NAKİT` / `HAVALE` — they must match the source data.

---

## Project Structure

```
c:\Users\monds\Desktop\test\
├── panel/                          ← THE working application (React 19 + Vite 8 + TypeScript strict)
│   └── src/
│       ├── index.css               ← Single global design system (tokens, .popup-table, high-contrast)
│       ├── App.tsx                 ← Router + ErrorBoundary + init gate (waitForInit) + AiChatPanel
│       ├── main.tsx                ← React root entry & async init bootstrapper
│       ├── config/
│       │   └── fileTypes.ts        ← Canonical config for the 5 Excel file types
│       ├── types/                  ← TypeScript strict type definitions (#63, #81)
│       │   ├── customer.ts         ← Customer, CustomerMaster, AgingBucket interfaces
│       │   ├── transaction.ts      ← SalesInvoice, Collection, CreditNote, Cheque interfaces
│       │   └── ai.ts               ← AiMessage, ToolDeclaration, InvoiceControlReport
│       ├── calculations/           ← SHARED business formulas. NO UI dependencies.
│       │   ├── index.ts            ← Single export point
│       │   ├── cancelledFilter.ts  ← Decision #11: two-pass CANCELLED document filter
│       │   ├── phoneValidator.ts   ← Decision #7: Turkish phone normalisation
│       │   └── cariCalculations.ts ← Balance, FIFO aging, statement generator (Decision #12)
│       ├── parsers/                ← Excel row → Record mappers (Decision #5, #9, #10, #23, #24)
│       ├── services/
│       │   ├── uploadService.ts    ← Reads file, parses, triggers saveUploadedData
│       │   ├── archiveService.ts   ← IndexedDB archive engine (500MB+ capacity, Decision #14)
│       │   ├── customerService.ts  ← In-memory store + listeners + Sync getters + report engines + Debt/Col Risk (#74)
│       │   ├── aiService.ts        ← Pure Gemini API + (model, key) rate limiting + Parallel Tools + Offline Fallback
│       │   ├── aiTools.ts          ← 15+ tool declarations, Master Gateway Intent Router, subagent executors (#29, #59, #61)
│       │   ├── aiContext.ts        ← Executive system prompt & data summary constructor
│       │   └── customRulesService.ts← Admin auth session & reactive auth listeners (#66)
│       ├── hooks/
│       │   ├── useDebounce.ts      ← 300ms debounce hook
│       │   └── useAiChat.ts        ← AI Assistant state & messaging hook
│       ├── utils/
│       │   ├── formatters.ts       ← TR currency/date/number formatting
│       │   ├── dateUtils.ts        ← safeIsoDate(): never throws RangeError
│       │   ├── fileTypeDetector.ts ← Auto-detects Excel type from filename/columns
│       │   └── exportUtils.ts      ← Date-filtered corporate PDF/Excel exports & query parsing (#64)
│       ├── components/
│       │   ├── common/
│       │   │   ├── ErrorBoundary.tsx← UI crash wrapper
│       │   │   └── CopyBadge.tsx   ← Universal fallback-ready copy button (#54)
│       │   ├── layout/             ← Sidebar (AKGÜN brand), TopBar, MainLayout
│       │   ├── upload/             ← UploadModal, FileUploadZone, ArchiveLogPanel
│       │   ├── modals/             ← Unified Customer Detail Modal Architecture (#82, #83, #84, #85)
│       │   │   ├── CustomerDetailModal.tsx   ← Unified Tab Shell (Invoices, Statement, Analysis, Cheques)
│       │   │   ├── CustomerInvoicesBody.tsx  ← Open Invoices Body Tab
│       │   │   ├── CustomerStatementBody.tsx ← Chronological Statement Body Tab
│       │   │   ├── CustomerAnalysisBody.tsx  ← Modern 4-KPI & AI Risk Insight Body Tab
│       │   │   ├── ChequeSenetBody.tsx       ← Integrated Cheque/Senet Portfolio & Risk Tab
│       │   │   ├── CariModalV2.css           ← Dedicated V2 Modal Glassmorphism Stylesheet
│       │   │   └── CariModalIcons.tsx        ← SVG Vector Icon Library for Modals
│       │   └── ai/                 ← AiChatPanel, MascotAvatar, ChatMessage, SuggestedQuestions
│       └── pages/
│           ├── DashboardPage.tsx/css ← Executive KPIs, donut charts, customer grid, open invoices modal
│           ├── CariPage.tsx/css      ← Search + master-detail statement + aging cards (/cari)
│           ├── FaturaKontrolPage.tsx ← Date-filtered invoice & collection tracker (/fatura-kontrol, #58)
│           └── AiChatPage.tsx/css    ← Full-screen AI assistant (/ai-asistan)
├── MD/                             ← Comprehensive Documentation Suite
│   ├── PROJECT_DECISIONS.md        ← All architectural decisions (#1–#85)
│   ├── DATA_MODEL.md               ← Data schema & Excel specs
│   ├── PROGRESS_LOG.md             ← Session-by-session history
│   └── CODING_GUIDE.md             ← THIS FILE
```

---

## Core 4-Pillar Development Standard (Decision #57)

Every feature, page, module, or report built or modified MUST strictly satisfy these 4 core pillars:

1. **Pillar 1 — Desktop Ergonomics:** High-density desktop layouts, grid alignment, hover states, interactive modals, high-contrast tables.
2. **Pillar 2 — Mobile Responsiveness (`@media (max-width: 768px)`):** Every component MUST have explicit mobile styles with single-column grid collapses, full-width inputs, touch-friendly tap targets, scrollable filter bars, and zero horizontal overflow.
3. **Pillar 3 — Full AI Query Coverage:** Whenever a new feature, page, or report is introduced, ALL possible natural language query variations regarding that feature (dates, customer names, sales reps, unpaid status, comparisons, historical trends) MUST be registered as tools in `aiTools.ts` and added to `aiContext.ts` system prompt.
4. **Pillar 4 — Shared Formula & Calculation Engine:** UI Panel and AI Assistant MUST execute the EXACT SAME underlying calculation functions from `customerService.ts` and `cariCalculations.ts`. Zero mathematical discrepancy or floating point drift between what is rendered on screen and what Günlü (AI) reports.

---

## V3 Glassmorphism Dark Mode Design System

Color tokens and glass styles live in `src/index.css` and `src/components/modals/CariModalV2.css`. All new components MUST maintain this unified dark slate theme.

| Token / Concept | Value / Variable | Use / Description |
|---|---|---|
| **Canvas / Background** | `#03050B`, `#070A13`, `#0F172A` | Deep void dark slate background |
| **Glass Card** | `rgba(255,255,255,0.035)`, `backdrop-filter: blur(24px)` | Cards, panels, modal content areas |
| **Glass Edge** | `1px solid rgba(255,255,255,0.08)` / `var(--cv2-edge-soft)` | Subtle card borders |
| **Primary Text** | `#F6F8FC` / `var(--cv2-ink-0)` | Titles, headers, primary data |
| **Secondary Text** | `#9BA6BC` / `var(--cv2-ink-1)` | Labels, subtext, dates |
| **Dim Text** | `#5C6479` / `var(--cv2-ink-2)` | Tertiary metadata |
| **Blue Accent** | `#4F8CFF` / `#3B82F6` | Primary actions, invoices, cheque links |
| **Green Accent** | `#3DDC9A` / `#10B981` | Collections, paid status, low risk |
| **Violet Accent** | `#9E7CFA` / `#8B5CF6` | Cheque portfolio, 12M trend speed |
| **Red Accent** | `#FB7B85` / `#EF4444` | Overdue debt, return status, high risk |
| **Amber Accent** | `#F6BB4D` / `#F59E0B` | Average vade, medium risk |

### High-Contrast Table System (`.data-table` / `.cv2-table-wrap` — Decision #56, #82, #85)
- **Table Headers (`th`):** Deep dark slate background (`rgba(13,17,28,0.96)`), uppercase text, sticky top positioning (`position: sticky; top: 0; z-index: 1`).
- **Cells (`td`):** Explicit cell boundaries (`border-bottom: 1px solid rgba(255,255,255,0.035)`), tabular monetary values aligned to the right.
- **Scroll Container (`.cv2-table-scroll` / `.modal-table-scroll`):** Height set to `max-height: 480px` or `40vh` to fill space cleanly.

---

## Critical Architecture Decisions (Summary)

Full details in `MD/PROJECT_DECISIONS.md`.

| # | Decision | Why / Impact |
|---|---|---|
| **1** | Calculation layer in `src/calculations/` — independent of UI | Shared between UI and AI assistant; prevents math divergence |
| **5** | Purchase file split: `SATIN ALMA` → supplier debt; `HIZMET`/`IADE` → customer credit notes | Service/return invoices reduce customer debt |
| **7** | Customer master keys are 10-digit `5000XXXXXX`. 6-digit = Migros, excluded | Data hygiene & scope boundary |
| **8** | `customers` master collection; transactions store `customerId` FK | Normalisation & single source of truth |
| **9** | Collection method derived from row data (Bank Code → HAVALE; Kasa 11 → NAKİT, 12 → KREDİ_KARTI) | Accurate collection categorization |
| **11** | Two-pass CANCELLED document filter | Removes both CANCELLED and CREATED twin rows |
| **12** | FIFO aging. Balance ≤ 0 → all buckets zero | Correct accounting principles |
| **14** | IndexedDB archive (`archiveService.js`) | Data survives page reloads (500MB+ capacity) |
| **18** | Re-read in-memory store after upload | Prevents archive↔memory drift |
| **23** | `parseAmount()` in all parsers | Handles TR (`1.004,50`) and EN (`1004.50`) number formats safely |
| **24** | Parser row grouping via `Map` | Prevents line-items overwriting invoice totals |
| **27** | Sync getters (`*Sync`) for all service methods | Instant React state initialisation without tab-switch flash |
| **39** | Global Cheque/Senet modal with multi-filter & sorting | Supports global portfolio (`GLOBAL`) and customer-specific views |
| **54** | Universal `CopyBadge` component | Dual-layer fallback (`navigator.clipboard` + `execCommand`) |
| **55** | `CustomerStatementModal` | Chronological customer transaction statement with running balance (B/A) |
| **56** | High-contrast `.popup-table` styling | Dark slate headers (`#0F172A`), cell borders & zebra striping |
| **57** | Core 4-Pillar Development Standard | Desktop, Mobile (`@media 768px`), Full AI coverage, Shared formulas |
| **58** | `/fatura-kontrol` module | Strict `FATURA > 0` date-filtered customer list & statement modal integration |
| **59** | Master Gateway Intent Router Agent | Blacklists company-wide tools on specific customer/date queries |
| **60** | Self-Healing Dynamic Code Synthesizer (`executeDynamicAnalyticsQuery`) | Sandboxed JS execution over raw datasets |
| **61** | Multi-Subagent Architecture & Factory | 6 built-in personas + runtime `defineSubagent`/`invokeSubagent` |
| **63** | TypeScript Infrastructure & Types | Strict type safety with `src/types/` and `tsconfig.json` |
| **64** | Date-Filtered Export Parameterization & Global Statement Modal | Pre-applies query date ranges to PDF/Excel exports and mounts modal in `MainLayout` |
| **66** | Read-Only vs Admin Mode UI Security | Hides mutation controls when `isAdminAuthenticated()` is `false` |
| **68** | Auto Chat Excel File Detection | Floating chat automatically detects & processes `MUSTERI_MASTER` files |
| **69** | `importCustomerMaster` AI Tool | Gemini AI can execute customer master imports via function calling |
| **71** | Pure Gemini AI Architecture | Decommissioned Claude; 100% Gemini multi-tier models & Backend Proxy |
| **72** | Advanced High-Performance `aiService.js` | `(model, key)` rate limiting, 7-day 404 blacklist, parallel tool calls |

---

## Bug-Free Coding Rules

1. **Dates:** Always `safeIsoDate(val)`. Never `new Date(val).toISOString()` — RangeError risk.
2. **Async reads:** Must start with `await ready()`. Use `*Sync` getters for React `useState` initializers.
3. **No hand-merging:** In `saveUploadedData`, write to IndexedDB archive, then re-read with `loadAll*()`.
4. **Recharts:** Pass literal hex colours (`#3C7A56`), never CSS variables (`var(...)`).
5. **No Fake Fallbacks:** Render 0 or hide elements if data is missing. Never fabricate dummy values.
6. **Amount Parsing:** Always use `parseAmount(val)` in Excel parsers.
7. **Invoice Grouping:** Always group multi-line invoices with a `Map` before producing records.
8. **Admin Security:** Mutation buttons (+ Fatura, + Tahsilat, Virman, Evrak, Delete) MUST be conditional on `isAdminAuthenticated()`.

---

## Commands

```bash
cd c:\Users\monds\Desktop\test\panel

npm test          # Vitest, single run (67/67 tests passing)
npm run test:watch
npm run dev       # Dev server (http://localhost:5173)
npm run build     # Production build (0 errors)
```

---

## Next Steps (Priority Order)

- [x] **FIFO Open Invoices & Turkish Search Normalisation** (Session 21)
- [x] **Cari Ekstre UI & Manual Management** (Session 21)
- [x] **High-Contrast Tables & Customer Statement Modal** (Session 55, 56)
- [x] **Core 4-Pillar Standard & Mobile Responsiveness** (Session 57)
- [x] **Fatura Kontrol Module (`/fatura-kontrol`)** (Session 58)
- [x] **TypeScript Migration (`src/types/`)** (Session 63)
- [x] **Pure Gemini Architecture & Advanced `aiService.js`** (Session 71, 72)
- [ ] Dedicated Sales Invoices (`/satis`), Collection Tracking (`/tahsilat`), and Stock (`/stok`) pages
- [ ] Firebase SDK integration (Firestore sync)
- [ ] Cloud Functions / Backend API calculation layer migration
- [ ] AI Assistant response streaming & PDF export expansion
- [ ] Advanced BI & Aging PDF Export Reports
- [ ] Multi-tenant Auth & Role Management
