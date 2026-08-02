---
name: akgun-panel
description: >
  AKGÜN Distribution Panel — alcoholic-beverage distribution management system
  (React + Vite). Activate this skill when working on any code in the panel/ directory,
  when the user asks about the project architecture, data model, decisions, or when
  starting a new coding session. This skill provides a condensed project context that
  replaces the need to read CODING_GUIDE.md, PROJECT_DECISIONS.md, and PROGRESS_LOG.md
  at the start of every session.
---

# AKGÜN Meşrubat Gıda — Distribution Panel (v1.1)

> **Purpose of this skill:** provide a compact, token-efficient project context so the
> AI agent does not need to read large markdown files (~60K tokens combined) at session
> start. This file contains everything needed to start coding immediately.
>
> For full details, read the referenced files only when specifically needed:
> - [CODING_GUIDE.md](file:///c:/Users/monds/Desktop/test/CODING_GUIDE.md) — full architecture
> - [PROJECT_DECISIONS.md](file:///c:/Users/monds/Desktop/test/PROJECT_DECISIONS.md) — decisions #1–#56
> - [DATA_MODEL.md](file:///c:/Users/monds/Desktop/test/DATA_MODEL.md) — Firestore schema & Excel analysis
> - [PROGRESS_LOG.md](file:///c:/Users/monds/Desktop/test/PROGRESS_LOG.md) — session history (40 sessions)

> **Autonomous Execution Protocol:** Never prompt the user for terminal command approvals (`npm run build`, `npm test`), file edits, or bug fixes. Proceed 100% autonomously without conversational friction.

> **Context & Token Optimization:** Keep turns concise. Monitor context accumulation; when turns exceed 25+, summarize completed work and update documentation before handing over (`/start-session`).

---

## Quick Reference

| Item | Value |
|---|---|
| Stack | React 19 + Vite 8 + TypeScript (`strict: true`), IndexedDB archive |
| App path | `c:\Users\monds\Desktop\test\panel\` |
| Dev server | `npm run dev` → `http://localhost:5173` |
| Unit Tests | `npm test` (Vitest, 14 test files / 67 tests passing) |
| Build | `npm run build` (0 errors, 749ms) |
| UI Language | **Turkish** (never translate UI strings, column names, enums) |
| Doc Language | **English** |
| Current Version | 1.1 (74 sessions / 86 decisions completed) |

---

## File Map (`src/`)

```
index.css               ← Global Design system (tokens, high-contrast tables)
App.tsx                 ← Router + ErrorBoundary + AiChatPanel
main.tsx                ← React root & async init bootstrapper

config/fileTypes.ts     ← 5 Excel file types configuration

types/                  ← TypeScript strict type definitions (#63, #81)
  customer.ts           ← Customer, CustomerMaster, AgingBucket interfaces
  transaction.ts        ← SalesInvoice, Collection, CreditNote, Cheque interfaces
  ai.ts                 ← AiMessage, ToolDeclaration, InvoiceControlReport

calculations/           ← SHARED business formulas (UI-independent)
  index.ts              ← Calculation hub
  cancelledFilter.ts    ← Two-pass CANCELLED deduplication (#11)
  phoneValidator.ts     ← Turkish phone normalization (#7)
  cariCalculations.ts   ← Balance, FIFO aging, statement generator (#12)

parsers/                ← Excel row parsers & column mappers (#5, #9, #10, #23, #24)
services/
  uploadService.ts      ← File parse → archive → store re-read (#18)
  archiveService.ts     ← IndexedDB engine (500MB+ capacity) (#14)
  customerService.ts    ← In-memory store, sync getters, live filter bus, monthly report engines, debt/col risk (#74)
  aiService.ts          ← Gemini API function calling, (model, key) rate limiting & parallel tools (#50, #72)
  aiTools.ts            ← 15+ tool declarations, Master Gateway Intent Router & subagent executors (#29–#31, #59, #61)
  aiContext.ts          ← Executive prompt builder & multi-rule AI intelligence (#49)
  customRulesService.ts ← Admin session state & reactive auth listeners (#66)

hooks/
  useDebounce.ts        ← 300ms debounce hook
  useAiChat.ts          ← AI state & chat thread management

utils/
  formatters.ts         ← TR currency & date formatters
  dateUtils.ts          ← safeIsoDate() helper
  exportUtils.ts        ← Date-filtered corporate PDF/Excel exports (#64)

components/
  common/
    ErrorBoundary.tsx   ← UI crash wrapper
    CopyBadge.tsx       ← Universal fallback-ready copy-to-clipboard mini button (#54)
  layout/               ← Sidebar, TopBar, MainLayout
  upload/               ← UploadModal, FileUploadZone
  modals/
    CustomerDetailModal.tsx   ← Unified Tab Shell (Invoices, Statement, Analysis, Cheques, #82-#85)
    CustomerInvoicesBody.tsx  ← Open Invoices Body Tab
    CustomerStatementBody.tsx ← Chronological Statement Body Tab
    CustomerAnalysisBody.tsx  ← Modern 4-KPI & AI Risk Insight Body Tab
    ChequeSenetBody.tsx       ← Integrated Cheque/Senet Portfolio & Risk Tab
    CariModalV2.css           ← Dedicated V2 Modal Glassmorphism Stylesheet
    CariModalIcons.tsx        ← SVG Vector Icon Library for Modals
  ai/
    AiChatPanel.tsx     ← Floating AI assistant panel, auto-clear on close (#73)
    MascotAvatar.tsx    ← Living mascot avatar component

pages/
  DashboardPage.tsx     ← Executive KPIs, donut charts, open invoices modal (/), live filter emitter
  CariPage.tsx          ← Customer search & statement detail (/cari)
  FaturaKontrolPage.tsx ← Date-filtered invoice & collection tracking (/fatura-kontrol, #58)
  AiChatPage.tsx        ← Full-screen AI assistant (/ai-asistan)
```

---

## Key Decisions (Condensed)

| # | Decision |
|---|---|
| 1 | `calculations/` is UI-independent — shared by panel + AI assistant |
| 5 | Purchase HIZMET/IADE = customer credit notes (reduce debt) |
| 7 | Customer keys: 10-digit `5000XXXXXX`; 6-digit Migros excluded |
| 8 | Transactions store only `customerId` FK → join to `customers` |
| 9 | Collection method from row data (Banka Kodu → HAVALE, Kasa 11 → NAKİT, 12 → KREDİ_KARTI) |
| 11 | CANCELLED filter: two-pass, removes both CANCELLED + CREATED twin |
| 12 | FIFO aging; balance ≤ 0 → all buckets zero |
| 13 | Passive/Cancelled + <30 TL hidden from UI lists; included in reports |
| 14 | IndexedDB archive — data survives page reload |
| 17 | Seed data discarded on first real upload |
| 18 | After upload, re-read from archive — never hand-merge |
| 19 | 5 computed aging buckets, 4 UI cards; >90 days = days90+over90 |
| 23 | `parseAmount()` — handles TR and EN number formats |
| 27 | Sync getters for instant component initialisation (no tab-switch flash) |
| 34 | Virman transfers excluded from sales turnover & cash collection totals |
| 39 | Global Cheque/Senet modal: supports `GLOBAL` customer ID, multi-filter, A-Z / amount sorting |
| 49 | `getMonthlyRiskAndRevenueReport`: dedicated month-based risk, revenue & top debtor engine |
| 50 | Live filter event bus (`setDashboardActiveFilters`): updates Günlü AI commentary |
| 54 | Universal `CopyBadge`: dual-layer copy (`navigator.clipboard` + `execCommand` fallback) with `.copy-badge-ghost` variant |
| 55 | `CustomerStatementModal`: chronological transaction statement with running balance (B/A), A-Z sorting, live type filters |
| 56 | High-contrast `.popup-table`: dark slate sticky headers (`#0F172A`), vertical cell borders, outer border, zebra striping |
| 57 | **Core 4-Pillar Development Standard**: Desktop Ergonomics, Mobile `@media (max-width: 768px)`, Full AI Query Coverage, Shared Calculation Engine |
| 58 | `/fatura-kontrol` module: strict `FATURA > 0` date filter, standard `cust-card` layout, 18-card load-more pagination, context-aware statement modal |
| 59 | Master Gateway Intent Router Agent: strictly blacklists `getGlobalHighestTransactions` on specific customer/date queries |
| 60 | Self-Healing Dynamic Code Synthesizer (`executeDynamicAnalyticsQuery`): sandboxed JS execution over raw datasets |
| 61 | Multi-Subagent Architecture & Dynamic Subagent Factory: 6 built-in personas + runtime `defineSubagent` / `invokeSubagent` |
| 62 | Offline Fallback Overhaul & `trNormalize`: destroyed generic fallback traps, added Turkish Unicode normalization (`İ` / `I`) |
| 63 | TypeScript Infrastructure & Interfaces: `tsconfig.json`, `src/types/`, `.env.example` template |
| 64 | Query-Driven Date Range Export & Global Statement Modal mounting in `MainLayout.tsx` |
| 65 | Stream Timeout (45s) & Space key shortcut for AI panel toggle |
| 66 | Admin UI conditional visibility (`isAdminAuthenticated()`) & reactive auth subscription |
| 67 | Multi-format ID matching & fallback upsert in `updateManualCheque` |
| 68 | Automatic Excel auto-detection and Müşteri Master import pipeline in chat |
| 69 | Dedicated AI tool `importCustomerMaster` for natural language customer upsert |
| 70 | Attachment-only prompt guard: prevents empty `searchCustomers("")` calls |
| 71 | Pure Gemini Architecture & Claude API decommissioning |
| 72 | Advanced `aiService.ts` upgrade: `(model, key)` rate limiting, 7-day model blacklist, `Promise.all` parallel tool calls |
| 73 | Automatic AI chat history & cache purge on panel close and route unmount |
| 74 | Corporate Debt-to-Collection Turnover Risk Metric (`Coverage Months`) & Universal 250ms Hover Analytics Event Bus |
| 75 | Decommissioning 18s background comment rotation loop for pure context-aware HUD |
| 76 | Current Month Collection Metrics focus for Dashboard KPI cards & Tahsilat Donut |
| 77 | AI Tool integration for Debt/Collection Risk (`calculateCustomerDebtToCollectionRisk`) |
| 78 | Top Eye-Level Smart AI Insight HUD Banner & 0ms Stuck State Guarantee |
| 79 | Enriched Top AI Insight HUD with multi-dimensional CFO analysis |
| 80 | Decommissioned bottom-right speech bubble; Top Eye-Level HUD is single unified commentary engine |
| 81 | Full TypeScript Migration (`strict: true`), Route Code-Splitting (`React.lazy()`) & Vitest 67/67 Test Suite |

---

## Architectural & UX Guidelines

1. **Core 4-Pillar Development Standard (MUST SATISFY ON ALL FEATURES):**
   - **Pillar 1 — Desktop Ergonomics:** High-density desktop layouts, grid alignment, hover states, interactive modals, high-contrast tables.
   - **Pillar 2 — Mobile Responsiveness (`@media (max-width: 768px)`):** Every component MUST have explicit mobile styles with single-column grid collapses, full-width inputs, touch-friendly tap targets, scrollable filter bars, and zero horizontal overflow.
   - **Pillar 3 — Full AI Query Coverage:** Whenever a new feature, page, or report is introduced, ALL possible natural language query variations regarding that feature (dates, customer names, sales reps, unpaid status, comparisons, historical trends) MUST be registered as tools in `aiTools.ts` and added to `aiContext.ts` system prompt.
   - **Pillar 4 — Shared Formula & Calculation Engine:** UI Panel and AI Assistant MUST execute the EXACT SAME underlying calculation functions from `customerService.ts` and `cariCalculations.ts`. Zero mathematical discrepancy or floating point drift between what is rendered on screen and what Günlü (AI) reports.

2. **Top Eye-Level Smart AI Insight HUD Banner (`ai-top-insight-hud`):**
   - Serves as the single, unified, eye-level financial commentary and hover analytics bar across all pages (Dashboard, Cari, Fatura Kontrol).
   - Bottom-right speech bubble is decommissioned; bottom-right mascot button acts solely as the AI Chat toggle.

3. **High Contrast Table System (`.popup-table`):**
   - Table headers (`th`) use deep dark slate (`#0F172A`), uppercase text (`#F8FAFC`), and dikey border dividers (`border-right: 1px solid #1E293B`).
   - Cells (`td`) use explicit cell borders (`border-bottom: 1px solid #E2E8F0`, `border-right: 1px solid #F1F5F9`) and zebra striping (`tbody tr:nth-child(even)` -> `#F8FAFC`).
   - Outer container wrapped in `border: 1px solid #CBD5E1`.

4. **Sticky Header Padding Rule:**
   - Never apply `padding-top` directly to scroll containers with sticky table headers (`position: sticky; top: 0`).
   - Use `padding: 0 20px 20px 20px` on the scroll container and apply `margin-top: 20px` to the first inner child to prevent table rows from bleeding above the sticky header.

5. **Fallback Copy Mechanism (`CopyBadge`):**
   - Always wrap copy-to-clipboard functionality with a dual-fallback algorithm (`navigator.clipboard.writeText` → `document.execCommand('copy')`) so copying works in HTTP, iframe, and embedded webviews without throwing security exceptions.

6. **Automatic Memory & Chat Cleanup:**
   - Closing the AI Chat panel or unmounting the route automatically purges chat history and temporary raw Excel arrays (`clearChat()`), preventing memory leaks and stale data.


---

## 🤖 CORE DIRECTIVE: The AI As The #1 System Priority (CRITICAL)

The embedded AI Assistant (`aiService.js`, `aiContext.js`, `aiTools.js`) is **the fundamental building block** of the AKGÜN Panel.

**Future agents MUST:**
1. **Never Break AI Tools:** When changing `customerService.js` or `archiveService.js`, ensure return schemas match what `aiTools.js` expects.
2. **Align UI to AI (Not Vice Versa):** The AI's calculation tools are the Absolute Source of Truth. The UI must always wire into the AI's calculation modules.
3. **Respect Gemini SDK Strictness:** Map ID fields precisely in `functionResponse` arrays for parallel tool calls.
4. **Prevent LLM Hallucinations:** Use strict semantic guidelines in `aiContext.js` to force JSON function calls rather than text fallback apologies.
