---
alwaysOn: true
---

# AKGÜN Distribution Panel — Project Rules

> These rules are automatically loaded by Antigravity at the start of every session.
> They replace the need to manually read CODING_GUIDE.md for basic coding standards.

## Autonomous Execution & Decision Protocol

- **Zero Confirmation for Code & Commands**: Never ask the user for permission or confirmation when executing terminal commands, creating/editing code files, fixing bugs, refactoring, or running tests. Proceed fully autonomously.
- **When to Involve the User**: Only ask the user when there is a high-level application direction decision, a major architectural pivot, or a new core business feature scope choice.

## Strict Token & Context Window Optimization Protocol (CRITICAL)

- **Compact Context First (No Full Doc Dumping)**:
  - NEVER read `PROGRESS_LOG.md` (~80KB), `PROJECT_DECISIONS.md` (~59KB), `DATA_MODEL.md` (~28.7KB), or `CODING_GUIDE.md` (~17.4KB) in full upon session start or during routine tasks.
  - Always use `.agents/skills/akgun-panel/SKILL.md` as the primary, compact (~3K tokens) single source of truth for architecture and decisions.
- **Lazy Loading Only**: Read referenced `.md` files ONLY when a specific past decision or schema detail is explicitly needed, and read only targeted line ranges using slice parameters (`StartLine`/`EndLine`).
- **Data Output Truncation**: Never output or print full Excel file rows or large dataset arrays into context logs. Slice console outputs to max 10 rows.
- **Session Turn Threshold & Automatic Handover Logging**:
  - Monitor session turn length. When turns reach 15–20 turns or a feature task is completed, the agent MUST **automatically** log the session achievements into `PROGRESS_LOG.md` (adding Session N+1 entry) and update `PROJECT_DECISIONS.md` / `SKILL.md` if new architectural decisions were made.
  - The agent does this autonomously WITHOUT needing the user to ask for documentation updates.
  - After logging, the agent informs the user: *"Oturum kazanımları PROGRESS_LOG.md ve SKILL.md dosyalarına işlendi. Token kotalarını korumak ve hızı artırmak için yeni oturuma geçilmesi önerilir (/start-session)"*.
- **Subagent Restraint**: Do NOT spawn subagents (`invoke_subagent`) for simple single-file edits, minor bug fixes, or quick lookups. Use subagents strictly for heavy, multi-step background research.

## Language

- **Application UI** is in Turkish. Never translate UI strings, Excel column names,
  or enum values (`NAKİT`, `HAVALE`, `CREATED`, `CANCELLED`, `Cari Kodu 2`).
- **Documentation files** (*.md) are written in English.

## Project Location

- Workspace: `c:\Users\monds\Desktop\test`
- Application: `panel/` (React 19 + Vite 8)
- Commands: `cd panel && npm run dev` / `npm test` / `npm run build`
- Dev server: `http://localhost:5173`

## Critical Coding Rules (enforced)

1. **Dates**: always `safeIsoDate(val)`, never `new Date(val).toISOString()`.
2. **Async reads in customerService.js**: must start with `await ready()`.
   Sync twins (`*Sync()`) skip `ready()` — used only as `useState` initialisers.
3. **Never hand-merge** the in-memory store — write to IndexedDB, then re-read.
4. **`parseAmount()`** in every parser — never raw `parseFloat()`.
5. **Invoice grouping**: `Map` by `invoiceId`, never `push()`.
6. **Recharts**: literal hex colours only, never CSS variables.
7. **No fabricated fallback values**. Show 0 or remove the element.
8. **Parallel loads**: single `Promise.all`, one state write, run-id guard.
9. **Page state**: `useState(() => getSomethingSync())` lazy initialisers.
10. **React DOM**: wrap conditional text in `<span key="...">`.
11. **File inputs**: `display:none` + `ref.current.click()`.
12. **ErrorBoundary** already wraps `App.jsx` — don't wrap pages again.
13. **Never copy reference app code** — visual guide only.

## Architecture Invariants

- `calculations/` layer has NO UI dependencies — shared by panel + AI assistant.
- `customers` is the master collection; transactions store only `customerId` (FK).
- CANCELLED filter is two-pass: both CANCELLED and its CREATED twin removed.
- Aging: 5 computed buckets, 4 UI cards; `>90 days` = `days90 + over90`.
- Collections include `customer_credit_notes` (HIZMET/IADE reduce customer debt).
- Seed data and real data never coexist (`usingSeedData` flag).

## Performance Rules

- `useDebounce(value, 300)` on every search input.
- `useMemo` for derived summaries.
- `isMounted` guard in every async `useEffect`.
- `subscribeDataChange` for auto-refresh after upload.

## AI Assistant Architecture (Decision #28–#29)

- AI uses Google Gemini API with Function Calling.
- `aiTools.js` maps tool calls → `customerService.js` Sync functions.
- `aiContext.js` builds system prompt with live data summary.
- `aiService.js` has an offline analytical fallback when API key is absent.
- `useAiChat.js` manages chat state (messages, loading, errors).
- UI: full page at `/ai-asistan` + floating `AiChatPanel` on all pages.
