---
trigger: always_on
glob: panel/src/**/*
description: Mandatory V3 Glassmorphism Design System Rules & Architectural Standards for AKGÜN Panel
---

# AKGÜN Panel — Mandatory Design System & Architectural Rules

All new features, pages, modals, components, and refactorings MUST strictly adhere to the project's **V3 Glassmorphism Dark Mode Design System**.

---

## 1. Visual & Color System (V3 Glassmorphism)

- **Canvas & Backgrounds:** Deep void dark slate (`#03050B`, `#070A13`, `#0F172A`). NEVER use light background cards (`#FFFFFF`) or grey canvas (`#EEF1F6`).
- **Glass Containers & Cards:** Use semi-transparent glass cards (`background: rgba(255,255,255,0.035)` or `rgba(18,23,38,0.97)`), with `backdrop-filter: blur(24px)` and subtle edges (`border: 1px solid rgba(255,255,255,0.08)`).
- **Header Glow Lines:** Top edge accents use gradient hüzme lines (`background: linear-gradient(90deg, transparent, #3B82F6, transparent)`).
- **Typography & High-Contrast Colors:**
  - Headers: `#F6F8FC`
  - Secondary text: `#9BA6BC`
  - Dim text: `#5C6479`
  - Monospaced / Tabular numbers: `font-variant-numeric: tabular-nums` (`.num` class).
- **Color Accents & Badges:**
  - **Blue / Primary:** `#4F8CFF` / `#3B82F6` (Faturalar, Çekler, Genel Aksiyonlar)
  - **Green / Success:** `#3DDC9A` / `#10B981` (Tahsilat, Düşük Risk, Ödendi)
  - **Violet / Purple:** `#9E7CFA` / `#8B5CF6` (Çek Portföyü, 12 Aylık Hız)
  - **Red / Warning:** `#FB7B85` / `#EF4444` (Vadesi Geçen, İade, Yüksek Risk)
  - **Amber / Gold:** `#F6BB4D` / `#F59E0B` (Orta Risk, Vade Yükü)

---

## 2. Layout & Ergonomics Standards

- **Action Bars (`.cv2-action-bar`):** Top-level controls use pill buttons (`border-radius: 999px`) for Excel, PDF, and Modal actions.
- **KPI Stat Strips (`.cv2-stat-row` / `.stat-strip`):** Horizontal stat cards with hairline vertical dividers (`border-right: 1px solid rgba(255,255,255,0.065)`).
- **Tables (`.data-table` / `.cv2-table-wrap`):**
  - Sticky headers (`position: sticky; top: 0; background: rgba(13,17,28,0.96); backdrop-filter: blur(6px)`).
  - Explicit cell borders, tabular monetary values aligned to the right.
  - Table scroll container (`.cv2-table-scroll`) height set to `max-height: 480px` or `40vh` to fill space cleanly.
- **Vector Icons Only:** Use FontAwesome 6 or SVG vector icons (`<svg className="cv2-ic">` / `CariModalIcons.tsx`). NEVER use OS emoji characters.

---

## 3. Strict Consistency Directives

1. **No Double Box Nesting:** Never nest multiple heavy dark rounded boxes inside each other (`box inside box inside box`). Keep toolbars and tables seamlessly integrated.
2. **Unified Modal System:** All customer-related details MUST be implemented as tabs inside `CustomerDetailModal.tsx` (`CustomerInvoicesBody`, `CustomerStatementBody`, `CustomerAnalysisBody`, `ChequeSenetBody`). Standalone modal wrapper popups are forbidden.
3. **Core 4-Pillar Standard:** Desktop Ergonomics, Mobile Responsiveness (`@media (max-width: 768px)`), Full AI Query Coverage (`aiTools.ts`), and Shared Calculation Engine (`customerService.ts` / `cariCalculations.ts`).
4. **Proactive CFO & AI Integration (OPTIMUM ATTENTION LEVEL - ZERO ERROR TOLERANCE):** Whenever a new module is created, a new data type is introduced, or a new file format is uploaded, cutting-edge CFO-level financial calculations (shadow limits, dynamic profiling, inflation costs) MUST be simultaneously integrated into both the UI and Günlü's (AI Assistant) reporting tools automatically. **This requires extreme meticulousness and deep research before execution. There is NO ROOM FOR ERROR in financial math or logic.** Do NOT wait for explicit user instructions to add deep financial reasoning, rich interactive tooltip effects (like typewriter animations), and strategic risk warnings to new data layers.

---

## 4. Single Source of Truth Mandate (Müşteri Master Data Cari Kodu Eşleme Kuralı)

- **Master Customer Metadata Authority:** All reports, file parsers (Sellout, Sales Invoices, Collections, Shipment, Cheques, etc.), FKNS calculations, target tracking, AI tools (`aiTools.ts`), and UI modules MUST strictly use **Müşteri Master Data (`CustomerMaster`)** matched by `customerId` (Cari Kodu / Müşteri Kodu) as the absolute single source of truth.
- **Join Key (`customerId`):** Any transaction or analytical record must resolve customer metadata (`customerName`, `signName`, `ssmName`, `salesRepName`, `salesChannel` / Open vs Closed Channel, `customerStatus` / Active vs Passive, `province`, `district`, `address`, `phone`, `taxNo`, `creditLimit`) by looking up the record's `customerId` against the loaded `CustomerMaster` dataset.
- **No Guessing or Fallback Heuristics:** Never use title text guessing or fallback keywords to deduce channels or statuses when the authoritative `CustomerMaster` record exists.

