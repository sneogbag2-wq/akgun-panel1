# Getting Started
*Version 6.2.1 — Antigravity-specific adaptation*

This package is a control pipeline that never treats a plan/code produced by an AI agent (Worker Agent) as "done" until it passes through two independent gates (Auditor, Judge). The goal is not speed — it is evidence-based correctness.

## Reading Order
1. **`controlled-development-workflow.md`** — the system's one-page summary, the flow diagram
2. **`control-pipeline-rule-01.md`** and **`control-pipeline-rule-02.md`** — the 15-article binding rule set (chain order, independence, evidence records, deadlock protocol, rule conflicts, etc.), split into two files due to Antigravity's 12,000-character-per-file limit — both carry the same binding force and should be read together
3. **`GLOSSARY.md`** — shared definitions for Evidence, Assumption, Loophole, Pattern deviation; all three roles reference this, none repeat it
4. **`skills/isci-ajan/SKILL.md`** → **`skills/denetci/SKILL.md`** → **`skills/yargic/SKILL.md`** — the three roles themselves, in order

## How the Chain Works
```
Worker Agent (produces plan/code)
    ↓
Auditor (Plan Gate + Code Gate — APPROVED/REJECTED)
    ↓
Judge (independent final verification — COMPLETE/INCOMPLETE/REJECTED)
```
The order may not be skipped, reversed, or merged (`control-pipeline-rule-01.md` Article 1).

## The `skills/` Folder — All Roles and Specialist Skills
In this package, **all 10 files** carrying skill front-matter (`name:`, `description:`) — the 3 mandatory roles (`isci-ajan`, `denetci`, `yargic`) and 7 specialist skills — are packaged as `skills/<name>/SKILL.md`, one file per folder, following that convention. Reason: Antigravity only auto-discovers skills from its own skill directory (`.agents/skills/` or `~/.gemini/config/skills/`); leaving the 3 core roles outside this directory would risk the 3 most critical roles never triggering via natural-language cues (like "run the worker agent"). This is why all of them must be placed together, under the same `skills/` convention — see Installation.

The specialist skills **do not add a new mandatory step to the chain**. The Auditor invokes them as needed, based on the deliverable's scope; they never activate for unrelated deliverables. See the **Control Map** table at the top of the `denetci` skill for the full list and triggers.

| Skill | When |
|---|---|
| `mimari-bekcisi` (Architecture Guard) | At the plan stage, when a new module/folder is proposed (stops the issue at its cheapest point) |
| `sema-bekcisi` (Schema Guard) | Structural presence of migrations/schema/RLS |
| `finansal-tutarlilik-denetcisi` (Financial Consistency Auditor) | Ledger/FIFO/reconciliation/inventory calculations |
| `parser-veri-butunlugu-denetcisi` (Parser Data Integrity Auditor) | Excel/CSV parsers, data normalization |
| `rls-yetki-denetcisi` (RLS/Authorization Auditor) | *Correctness* of RLS, key leaks, authorization scenarios |
| `ai-arac-sozlesme-denetcisi` (AI Tool Contract Auditor) | AI tool declarations/registries, AI mutations |
| `ogrenen-hafiza` (Learning Memory) | Passive — only when a violation is seen a second time, or a summary is requested |

## Installation (Antigravity)
1. **Copy the 5 non-role files** (`GETTING-STARTED.md`, `GLOSSARY.md`, `control-pipeline-rule-01.md`, `control-pipeline-rule-02.md`, `controlled-development-workflow.md`) to your project's root folder. These files are for reference only; the only copies Antigravity actually reads automatically are the ones moved in step 3 below.

2. **Move the entire `skills/` folder** (10 subfolders, each containing a `SKILL.md`) to:
   - **Workspace (this project only)**: under `.agents/skills/` — e.g. `.agents/skills/isci-ajan/SKILL.md`. The folder names (`isci-ajan`, `denetci`, etc.) already follow this convention and don't need renaming.
   - **Global (all your projects)**: under `~/.gemini/config/skills/`, with the same subfolder structure.
   - Antigravity also offers backward-compat support for `.agent/skills/` (singular, the older convention); use `.agents/skills/` (plural) for new installs.

3. **Copy the rule files into `.agents/rules/`** (both `control-pipeline-rule-01.md` and `control-pipeline-rule-02.md` — if one is missing, Articles 9-15 go inactive). In Antigravity, from the Customizations panel (the "…" menu at the top → Rules), set the activation mode for these two files to **"Always On"** — this guarantees they're read automatically in every session. The `trigger: always_on` front-matter at the top of the files serves the same purpose, but confirming it via the UI is still recommended. If left in "Model Decision" or "Manual" mode, the "read automatically every session" guarantee no longer holds.
   Note: If you want a global rule (across all projects), Antigravity consolidates global rules into a **single file** (`~/.gemini/GEMINI.md`), and the same 12,000-character limit applies to that file *in its entirety* — moving these two files there as-is will likely not fit. This system is designed as a project-specific (workspace) rule; for global use you'll need to summarize the content separately.

4. **Copy the workflow file** into `.agents/workflows/` (per-project) or `~/.gemini/antigravity/global_workflows/` (all projects). Once saved, you can trigger it in agent chat by typing `/controlled-development`.

5. **The file names in the specialist skills are examples.** Names like `SISTEM_HESAPLAMA_MATRISI.md`, `VERITABANI_YENIDEN_TASARIM_KARARLARI.md`, `STOK_METRIK_KATALOGU.md`, `KODLAMA_ASAMALI_UYGULAMA_PLANI.md`, and `FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md` are specific to the project this system was built for. Find the equivalent decision/catalog file names in your own project and replace them in the relevant skill file (`sema-bekcisi`, `finansal-tutarlilik-denetcisi`, `parser-veri-butunlugu-denetcisi`, `rls-yetki-denetcisi`) — if you don't, the skill will be looking for a file that doesn't exist.

## FAQ
**"Do all 7 skills run on every task?"** No. Only the Auditor's own 5-point checklist is always mandatory. The specialist skills are only invoked if the deliverable touches that specific area — this is by design, to add depth without adding weight to the system.

**"Can the specialist skills make decisions?"** No. They only produce findings/evidence. The APPROVED/REJECTED decision always belongs to the Auditor; the COMPLETE/INCOMPLETE decision always belongs to the Judge.

**"What happens if the Auditor keeps rejecting and the Worker Agent keeps fixing?"** If the same point is rejected a third time, Article 14 (Deadlock Protocol) of `control-pipeline-rule-02.md` kicks in and the decision is handed to the user — the system does not enter an infinite loop.

**"What if two different project rule files conflict with each other?"** No role can resolve this on its own; per Article 15, the task is treated as REJECTED/INCOMPLETE until the user resolves the conflict.

**"I really want to run the Auditor/Judge independently (with a separate context), how?"** Call Antigravity's built-in `self` sub-agent using the `invoke_subagent` tool — it uses the same toolset but does not inherit prior conversation history. See Article 11 of `control-pipeline-rule-02.md` for details.

See `CHANGELOG.md` for what changed in this package relative to the previous version (v6.2).
