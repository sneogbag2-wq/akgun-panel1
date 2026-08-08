# /controlled-development
Target location: `.agents/workflows/controlled-development.md` (per-project) or `~/.gemini/antigravity/global_workflows/controlled-development.md` (all projects). This is a saved command triggered in agent chat by typing `/controlled-development`; it launches the Worker Agent → Auditor → Judge chain in one go, without having to invoke each role manually in sequence.

Run the task below through the entire Worker Agent → Auditor → Judge control pipeline. Do not skip, merge, or shorten any stage by calling it "simple."

Task: {{task description goes here}}
Task ID: {{e.g. package-1, feature-x — determines the name of the record file under .agents/logs/}}

Steps:
1. Use the `isci-ajan` (Worker Agent) skill to produce a plan. Show the plan in full.
2. Use the `denetci` (Auditor) skill to review the plan. If the plan proposes a new module/folder/responsibility boundary, the Auditor also invokes the `mimari-bekcisi` (Architecture Guard) skill at this step (see the Control Map at the top of the `denetci` skill) — not needed for narrow-scope plans. Show the decision (APPROVED/REJECTED) and its justification in full. If REJECTED, return to step 1 — do not proceed without approval.
3. After approval, write the code and gather evidence using the `isci-ajan` skill.
4. Audit the code with the `denetci` skill. If the deliverable touches migrations/financial calculations/parsers/authorization/AI tools, the Auditor invokes the relevant specialist skill (see the Control Map at the top of the `denetci` skill) as an additional evidence source. If REJECTED, return to step 3.
5. Independently verify the task as a whole with the `yargic` (Judge) skill and present the final status report to the user.

Show the output of every step (plan, decision, code evidence, report) to the user without skipping any, in a visible way. This workflow itself lists the 3 mandatory roles; the full list of which specialist skill kicks in when is in the `denetci` skill — it is not repeated here, only referenced.

**Note:** If a task meets the four conditions in Article 12 of `control-pipeline-rule-02.md`, the Worker Agent may request the light chain in its plan (steps 2 and 4 merge into a single Auditor approval) — but this is not the default; it requires the Auditor's explicit approval. For high-risk tasks (schema, security, payment/financial logic), run the Auditor/Judge steps with contextual isolation via `invoke_subagent(self)` where possible, per Article 11; if this is not possible, tell the user.

## Use for Multi-Package / Multi-Phase Plans
If you already have a coding plan pre-split into package 1, package 2, package 3, etc.:

1. **Place the plan file in the project folder** (`plan.md`, `roadmap.md`, etc.). Article 0 of `control-pipeline-rule-01.md` scans this automatically; you don't need to paste its contents separately.
2. **Each package is a separate "Task."** Do not submit the entire plan as a single task at once — each package is run separately, in sequence, with this template. Write the package name in the Task ID field (e.g. `package-1`); this determines the name of the record file under `.agents/logs/` and keeps packages from being mixed up.
3. **Order is mandatory.** Package N+1 does not start until Package N has received a "COMPLETE" report from the Judge — Articles 1 and 2 apply at the package scale as well.
4. **Continuity**: each package's Worker Agent plan, in its "Basis in rules" section, references both the master plan file and the log records of previously completed packages (`.agents/logs/package-<N-1>.md`) — packages are not evaluated in isolation from each other.
5. **After all packages are done (optional, recommended)**: invoke the `yargic` skill standalone, outside the chain, under Article 6 of `control-pipeline-rule-01.md` — "render a verdict on whether the entire plan, as a whole, complies with [plan.md] and whether packages are integrated correctly with each other." This is to catch cross-package inconsistencies that per-package checks might miss; it does not change existing package statuses, it only produces an additional report.

### Example invocation
```
/controlled-development
Task: Package 1 — [package 1 summary] as defined in plan.md
Task ID: package-1
```
