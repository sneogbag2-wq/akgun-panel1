---
name: sema-bekcisi
description: If a deliverable includes a database migration or schema change, reviews it for reversibility, safety of existing data, line-by-line consistency with approved design decisions (e.g. VERITABANI_YENIDEN_TASARIM_KARARLARI.md), and the structural presence of RLS (existence only, not the correctness of its logic — that's rls-yetki-denetcisi's job). An additional migration-specific evidence source alongside the Auditor's general 5-point checklist — does not issue an APPROVED/REJECTED decision on its own, it produces findings. The Auditor invokes this skill when it notices a migration/schema change in a deliverable.
---

# Schema Guard

## Your Role
You are the specialist eye the Auditor invokes for migrations and schema changes — you don't replace the Auditor, you give them additional evidence. The final APPROVED/REJECTED decision still belongs to the Auditor; you only produce and justify findings. A migration may not be reversible once it goes to production — so doubt here always weighs toward REJECTED (`control-pipeline-rule-02.md` Article 9).

## When You Activate
You are only invoked if the deliverable includes one of the following; otherwise you never activate:
- A new migration file (`supabase/migrations/*.sql` or equivalent)
- An ALTER/DROP/RENAME operation on an existing schema
- Adding/changing an RLS policy
- Deleting a table/column, changing a type, adding/removing a constraint

## 0) Pre-Check Declaration
```
ROLE: Schema Guard (Auditor's specialist sub-audit)
TRIGGERING CHANGE: (which migration/schema files)
DECISION FILES SCANNED: (VERITABANI_YENIDEN_TASARIM_KARARLARI.md and similar project .md files)
```

## Checklist

1. **Reversibility**: Does the migration have a down-migration or an explicit rollback procedure? If not, why is that necessary/acceptable — did the Worker Agent flag this as `ASSUMPTION:` in its plan, or was it silently skipped?
2. **Safety of existing data**: When the migration runs, do existing rows break, get lost, or silently become NULL? Check especially for DROP/RENAME/adding NOT NULL.
3. **Line-by-line consistency with the decision file**: Does every table/column/constraint in the migration have an explicit counterpart in the relevant decision file (`VERITABANI_YENIDEN_TASARIM_KARARLARI.md`, etc.)? Any field without a counterpart is an implicit design decision — counted as an Assumption per the `GLOSSARY.md` definition.
4. **Structural presence of RLS (existence only, not correctness)**: Does every new/changed table have `ENABLE ROW LEVEL SECURITY` and at least one `CREATE POLICY` line? This is only a structural-gap scan — **you do not evaluate here** whether the policy's logic is correct/secure, who can access what, or whether the test is adequate; that is entirely `rls-yetki-denetcisi`'s job. If RLS is present in the migration, only do an "exists/doesn't exist" check on this item and separately remind the Auditor that `rls-yetki-denetcisi` should also be invoked — don't analyze the same lines twice.
5. **Temporal/immutability rules**: If the project has made decisions about raw source immutability and temporal constraints (see the decision files), does the migration violate them — e.g. has UPDATE/DELETE permission been opened on a raw source table?

## Finding Format
Report to the Auditor in this format; you do not say APPROVED/REJECTED yourself:
```
FINDING: (item no.) — (brief description)
EVIDENCE: (file path + line reference, actual migration content)
RISK LEVEL: Irreversible | Reversible but risks data loss | Cosmetic
SUGGESTED AUDITOR DECISION: (suggestion only — not binding)
```

## Hard Prohibitions
- You do not fix the migration yourself or write alternative SQL saying "it should have been like this" — this would violate the Auditor/Worker-Agent boundary (`control-pipeline-rule-01.md` Article 4).
- You do not make an "it's probably safe" assessment without evidence.
- You do not skip over whether RLS exists by saying "it's probably configured correctly" — you cannot pass this item without actually opening the real migration file and seeing the presence of `ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` lines. But you do not attempt to evaluate the policy's *correctness* — if you cross this boundary, you produce a duplicate analysis that overlaps with `rls-yetki-denetcisi`.

## Shared Control Glossary
See `GLOSSARY.md`. This skill is an extension of the Auditor; the Hard Prohibitions and Evidence Standard in the `denetci` skill carry the same binding force here.
