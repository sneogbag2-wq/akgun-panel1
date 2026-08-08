---
trigger: always_on
---

# Control Pipeline Rule — 1/2 (Articles 0-8)
Target location: `.agents/rules/` (this file + `control-pipeline-rule-02.md`, Articles 9-15 — together the two form a single rule set). Reason for the split: Antigravity's 12,000-character-per-Rule-file limit (the single file was ~12,700 characters, exceeding the limit). Antigravity automatically reads `always_on` files under `.agents/rules/` in every session — unlike skills, which only load "if deemed relevant," these load every time.

Why a separate rule file is needed: skills only activate when the agent judges a task to be "relevant." What actually makes the sequence binding is these rule files, which are loaded automatically in every session.

## Binding Rules

0. **Rule File Discovery**: Before any role activates, the currently open project folder (the workspace root the agent is operating in, and its subfolders) is scanned; every `.md` file containing a README, docs/, project schema, architecture note, general report, etc. is reviewed. The scan is automatic — the user does not need to name a file. Scope is limited to the active project folder only. Even if the user does not label a file as a "rule," every `.md` that defines project context/requirements counts as a binding source under Article 1 of the `judge` skill's Reference Hierarchy.

1. **Scope and Order**: "Code change" may not be interpreted narrowly. If **any** of the following changes the state of the project, the full chain (Worker Agent → Auditor → Judge) is mandatory: source code, configuration files, infrastructure/deployment definitions, database schema/migrations, adding or removing dependencies, deleting/renaming/moving files, permission/access settings. In case of doubt ("does this count as code?"), the default assumption always leans toward "it counts" — a narrowing interpretation is not left to the Worker Agent. The order may not be skipped, reversed, or merged. The sole exception is defined in Article 6.

2. **Approval Gate**: The Worker Agent may not modify any file or run any state-changing command without an explicit APPROVED decision from the Auditor. Proceeding on the assumption "it'll probably be approved anyway" is a violation of this rule; a delayed approval is not an excuse.

3. **Completion Notice**: A task is reported to the user as complete only once the Judge issues a "COMPLETE" decision. A task in which the chain was knowingly skipped at any point can **never be closed as "COMPLETE,"** no matter how flawless it later appears — at most it is logged with the note "executed with chain skipped, unverified." If the user later requests full verification, the Judge does not inherit the previously skipped process; it starts from scratch.

4. **Correction Ban**: The Auditor and the Judge do not fix code for the Worker Agent "as a favor" — they only evaluate. If they want to fix an issue, they send it back to the Worker Agent as a new finding.

5. **Bypass Transparency**: This sequence may not be silently skipped for any reason — time pressure, "this change is too small," or the user urgently requesting approval. Even if the user knowingly and explicitly wants to bypass the sequence, the agent does not skip it without visibly flagging this — it explicitly tells the user "the control pipeline is being knowingly skipped" and reminds them of the consequence in Article 3 (never COMPLETE).

6. **Standalone Audit/Judgment Exception**: Read-only requests that involve no code/state change — e.g. "audit the current state against rules X" or "render a verdict" — may be run standalone, outside the full chain. However:
   - (a) If such an audit finds a violation/gap, a fix may not be self-initiated. The findings are passed to the Worker Agent as a new task, and this task automatically triggers the full chain under Article 1.
   - (b) A standalone Judge decision cannot, by itself, reverse or re-approve a task that already went through the full chain and received "COMPLETE" status — it only produces a new finding/report; changing the status still requires the full chain.
   - (c) Standalone calls must use the same evidence standard and decision format; there is no "lightweight mode."

7. **Pre-Check Declaration**: At the start of every task, the role that is activating and the list of `.md` files scanned under Article 0 are explicitly declared (`ROLE: ...`, `RULE FILES SCANNED: ...`). No role may produce output without this declaration.

8. **Permanent Record**: The output of every stage (plan, decision, evidence, report) is not limited to being shown in the chat window — it is appended (never overwritten) to `.agents/logs/<task-id>.md` in the project folder. This prevents earlier APPROVED/REJECTED records from being lost due to context summarization/pruning in long sessions, and ensures the Auditor's Escalation mechanism (detecting repeated violations) rests on a concrete data source.

   At the same time, a one-line summary is appended to `.agents/logs/index.md`: `<date> | <task-id> | <ROLE> | <DECISION> | <1-sentence rationale category>`. The category dictionary in the `learning-memory` skill may be used to prefix the rationale field with a fixed category code (this is optional, but it speeds up scanning). This index file is scanned **first** for every operation that requires "looking back" at past records (the Auditor's Escalation, the Judge's pattern check, the Article 13 Activity Summary); the full record (`.agents/logs/<task-id>.md`) is only opened for a specific task that the index flags as suspicious/relevant. This does not eliminate the full evidence chain — it only spares the system from the cost of "re-reading everything every time" growing exponentially as unrelated past tasks accumulate. If the index file cannot be found or is incomplete, this gap is not skipped over — the index is re-derived on the spot by scanning the existing `.agents/logs/` files.

   **Secret Redaction**: If a piece of evidence to be committed to the permanent record (command output, grep result, diff) matches a known secret/key pattern (API key, service-role key, token, password — e.g. patterns like `sk-`, `eyJ`, a long hex/base64 string), the value itself is not written under `.agents/logs/` — only the file path, line number, and a note reading "secret detected, value redacted" are recorded. This is especially binding for the `rls-yetki-denetcisi`'s (RLS/Authorization Auditor's) key-leak scan — detecting a leak and then copying it a second time, this time into a permanent log file, defeats the purpose and is by itself a violation of this article.

## Continued
Articles 9-15 → `control-pipeline-rule-02.md` (same folder, same binding force).
