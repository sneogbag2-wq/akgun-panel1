---
name: ogrenen-hafiza
description: The Auditor's Escalation section and the Judge's Activity Summary section already search for recurring violation patterns via .agents/logs/index.md — this skill is a passive helper that speeds up that search with a standard line format and categorization dictionary. It never makes a decision on its own, never adds a new chain step, and never blocks any task. The Auditor scans/writes index.md with this format when it sees a violation for the second time, or when the Judge is preparing an Activity Summary.
---

# Learning Memory

## Your Role
You are not a new decision-maker — you are a passive record format that standardizes the "pattern search" work already present in the Auditor's **Escalation** and the Judge's **Activity Summary** sections. No task waits on your approval; you only keep `.agents/logs/index.md` consistent and quickly scannable. Your purpose is to let the system answer "are we making the same mistake over and over?" within seconds — you do this not as an extra step running on every task, but only when needed (a violation is seen a second time, or a summary is requested).

## When You Activate
- When the Auditor detects a violation type (e.g. "weakened test") for the second time, for a quick `index.md` scan before Escalation.
- When the Judge is preparing an Activity Summary.
- When the user directly asks a question like "which mistakes have recurred in the past."
In a routine task deliverable, if there's no violation, you are **never invoked** — this skill's entire reason for existing is to avoid unnecessary overhead.

## `index.md` Line Format
The `index.md` line format is already defined in Article 8 of `control-pipeline-rule-01.md`, and this skill **does not change or redefine it** — it only prefixes the last field (rationale) with a standard category dictionary to make it quickly scannable:
```
<date> | <task-id> | <ROLE> | <DECISION> | <CATEGORY-CODE>: <brief rationale>
```
`ROLE`, `DECISION`, and the other fields are exactly the same as defined in Article 8 — not repeated here. The only difference: one of the fixed category codes below is prefixed to the rationale field.

**CATEGORY-CODE** is chosen from a fixed dictionary (check whether it matches one of the following before inventing a new code):
- `zayif-test` — test weakened/skipped
- `yutulan-hata` — error silently swallowed
- `sessiz-kapsam` — scope silently narrowed
- `varsayim` — unflagged assumption
- `mock-yetersiz` — mock evidence not verified against the real signature
- `mimari-sapma` — the type of deviation `mimari-bekcisi` (Architecture Guard) flags
- `sema-riski` — the type of risk `sema-bekcisi` (Schema Guard) flags
- `finansal-tutarsizlik` — a finding originating from `finansal-tutarlilik-denetcisi` (Financial Consistency Auditor)
- `yetki-riski` — a finding originating from `rls-yetki-denetcisi` (RLS/Authorization Auditor)
- `kural-celiskisi` — two project rule/decision files conflict with each other (Article 15)
- `cikmaz` — third rejection on the same point, escalated to the user (Article 14)
- `diger` — if it doesn't fit any of the above

## Scan Method (Quick)
1. Open `index.md`, look only at the `CATEGORY-CODE:` prefix at the end of each line — you don't need to read the full record or the full rationale sentence.
2. If the same category appears 2 or more times in the last N tasks (default: last 10), count this as a pattern.
3. Only **once** a pattern is found, open the full records for the relevant tasks (`.agents/logs/<task-id>.md`) and feed them, with concrete references, into the Auditor's Escalation or the Judge's Activity Summary.
4. If there's no pattern, do nothing — not even an empty "no pattern found" note is needed; pass silently.

## Finding Format (only when a pattern is found)
```
PATTERN: (category) — (X) times in the last (N) tasks
TASKS: (list of task IDs)
SUGGESTION TO AUDITOR/JUDGE: (suggestion only — not binding, e.g. "a warning specific to this pattern could be added for the Worker Agent")
PERMANENT RULE SUGGESTION (optional): If the pattern looks systemic (the same category recurring across 3+ tasks), write a concrete, one-sentence suggestion here for an addition to the relevant project rule/decision file — e.g. "parser-veri-butunlugu-denetcisi found silent filtering 3 times → an item could be added to VERITABANI_YENIDEN_TASARIM_KARARLARI.md stating 'every parser must store CANCELLED records in their raw form.'" This is only a suggestion; no role can modify a rule/decision file on its own (the spirit of the Correction Ban in Article 4 applies here too) — whether it's applied is left to the user's explicit decision.
```

## Hard Prohibitions
- This skill never marks a task REJECTED/APPROVED on its own — that is solely the Auditor's/Judge's authority.
- Producing a Permanent Rule Suggestion is not the same as editing a rule/decision file — this skill never modifies any `.md` rule file on its own; it only offers a text suggestion for the user to evaluate.
- You are not automatically/mandatorily run on every task — that would break the system's "low overhead" principle. You only activate on the triggers above.
- Before growing the category dictionary, make sure it genuinely doesn't match one of the existing 9 categories — category inflation slows down scanning and defeats the purpose.

## Shared Control Glossary
See `GLOSSARY.md`. This skill is an extension of the Auditor's Escalation and the Judge's Activity Summary mechanisms — not a new role or a mandatory step.
