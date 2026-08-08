# Changelog

## v6.2.1
Antigravity-specific adaptation. No article number was changed or removed.

**Compatibility (critical)**
- `control-pipeline-rule.md` (12,720 characters) exceeded Antigravity's 12,000-character-per-Rule-file limit — it was unclear whether the file would even save in this state or be silently truncated, but either way there was at least a risk that Articles 14-15 would end up effectively inactive. The file was split into `control-pipeline-rule-01.md` (Articles 0-8, 6,264 characters) and `control-pipeline-rule-02.md` (Articles 9-15, 6,812 characters); total overhead added is only +356 characters (~3%). Both are marked with `trigger: always_on` under `.agents/rules/`.
- All file-path references (7 skill files + workflow + changelog) were updated to the new two-part file names, correctly routed by article number.

**Antigravity-specific clarification**
- The "Claude Code Task tool / Antigravity new agent chat" comparison in Article 11 (Perspective Independence) was removed; in its place, Antigravity's official Subagents mechanism (the built-in `self` sub-agent invoked via `invoke_subagent` — uses the same toolset as the main agent, does not inherit prior conversation history) was added as a concrete example. This is both shorter and more accurate; per Antigravity's documentation, since it doesn't pollute the main agent's context, it reduces rather than increases token consumption.
- The "separate session" wording in `controlled-development-workflow.md` was tied to the same concrete mechanism.
- The installation paths in `GETTING-STARTED.md` were made concrete per official Antigravity documentation: workspace skill → `.agents/skills/`, global skill → `~/.gemini/config/skills/`, workspace rule → `.agents/rules/` (requires Always On activation), global rule → single file `~/.gemini/GEMINI.md` (insufficient capacity for this package, not recommended). Claude-Code-specific setup instructions (`CLAUDE.md` adaptation, etc.) were removed.

**Not addressed**
- Packaging the Auditor/Judge as a persistent, named Antigravity Subagent (`.agents/agents/`) was deliberately not done: a custom `tools:` list requires tool names that vary by Antigravity version, and a wrong tool name can cause the subagent to lock up (a known issue per Antigravity's own documentation). The built-in `self` sub-agent, which requires no extra configuration, was recommended instead — see Article 11.

## v6.2
Updates made following an external review. No existing article number was changed or removed (only additions) — moving to this version does not invalidate `.agents/logs/` records from v6.

**Security**
- **Secret Redaction** added to Article 8 of `control-pipeline-rule-01.md`: if a specialist skill (particularly `rls-yetki-denetcisi`) finds an actual key/token during a scan, the value itself is no longer written to the permanent log file — only its location. Under the previous behavior, detecting a leak meant copying that leak into a second file.

**Process**
- New **Article 14 — Deadlock Protocol**: after a third rejection on the same point, the chain no longer automatically loops a fourth time — it's escalated to the user.
- New **Article 15 — Rule Conflict Notice**: if two project rule files conflict with each other, no role can silently resolve it — the task is treated as REJECTED/INCOMPLETE until the user resolves it. (This category already existed in Article 13's summary list but had no binding mechanism.)
- Concrete "how to open a separate session" examples (Claude Code / Antigravity) were added to Article 11 (Perspective Independence).
- **Documentation/Comment Exception** added to Article 12: for comment/doc/whitespace changes with zero behavior change, the "diff consists only of these lines" evidence condition replaces the "test" condition.
- `kural-celiskisi` (rule-conflict) and `cikmaz` (deadlock) codes added to the `ogrenen-hafiza` (Learning Memory) category dictionary; an optional **Permanent Rule Suggestion** field added to the Finding Format (if a pattern looks systemic, it produces a rule-addition suggestion contingent on user approval — no role can modify a rule file on its own).

**Structure / portability**
- The 3 core roles (`isci-ajan`, `denetci`, `yargic`) were moved to the same `skills/<name>/SKILL.md` folder convention as the 7 specialists. In the previous version these 3 files stayed at the project root; in tools that only discover skills from their own directory (e.g. Claude Code), the 3 most critical roles risked never triggering automatically.
- File names converted to ASCII (`İŞÇİ_AJAN.md` → `isci-ajan/SKILL.md`, `DENETÇİ.md` → `denetci/SKILL.md`) — to avoid inconsistencies that Turkish uppercase İ/Ç characters can cause in some filesystem/tool combinations.
- File-path references (like `` `DENETCİ.md` ``) were converted to skill-name references (like `` the `denetci` skill ``), so references don't break even if the folder structure is reorganized.
- The `GETTING-STARTED.md` Installation section was expanded: a `CLAUDE.md` adaptation note for Claude Code, and an explicit statement that the project-specific file names in the specialist skills (`SISTEM_HESAPLAMA_MATRISI.md`, etc.) are examples/placeholders that the adopter must replace with their own file names.

**Not addressed / deliberately deferred**
- An end-to-end example scenario (a mini transcript) was not added in this version — left as a separate request to avoid scope creep.
- Tamper-resistance of the log files (actually enforcing append-only, e.g. via a hash chain) was deferred as being outside the natural limits of a prompt-based system.

## v6 and earlier
Not included with this package; this changelog starts at v6.2.
