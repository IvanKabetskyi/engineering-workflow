---
description: Run a new feature through the full workflow — business docs, domain, design record, TDD pipeline — with artifact gates so no phase is silently skipped
---

Orchestrate a NEW FEATURE in an existing project through the engineering workflow. You are
a thin conductor: each phase is executed by its skill; your job is order, gates, and the
state file. NEVER do a phase's work inline when its skill exists.

## State file

`docs/workflow/<feature-slug>.state.md` — create on first run:

```
# <feature> — workflow state
phase: (docs|domain|architecture|tests|implement|review|done)
started: <date>
artifacts:
  business-docs: docs/business/ (rule numbers used: ...)
  design-record: docs/architecture/<feature>.md
  step0-tests: <list of test files written red>
  review-report: _fix_reports/review-<feature>-<date>.md
overrides: (none | list: what was skipped, WHY, who approved, date)
```

Resume from the recorded phase if the file exists.

**Session model**: one phase — or one ticket of the implement phase — per session is the
NORM, not a failure. Do not try to carry the whole workflow in one run: do the current
phase, update the state file, and tell the human what the next session should start with
(which command, which ticket). A fresh session with only the state file + artifacts must
be able to continue exactly where this one stopped.

## Phases and gates (in order — a phase may not start unless its gate passes)

1. **Business docs** — GATE: none (first phase). If `docs/business/` covers this feature
   (cite the BR-numbers), record them and move on. If not: business docs are the ANALYST
   role's artifact (product-docs skill) — if product-docs is installed, run it (it starts
   by asking for EXISTING documentation to ingest before any grilling); if it isn't,
   SUGGEST the human involve their analyst/staff engineer or install the analyst role
   (`npx github:ivankabetskyi/engineering-workflow --role=analyst`) — do NOT invent
   business rules yourself to get past this gate.
2. **Domain** — GATE: business docs exist or a logged override. Run domain-modeling for the
   feature's terms/states; record in the design record's Domain section.
3. **Architecture** — GATE: domain done. Run frontend-architecture and/or
   backend-architecture (design intake, contracts, grilled record, to-spec/to-tickets).
   The record is the artifact.
4. **Tests (STEP 0)** — GATE: design record exists and the human confirmed it. Run
   frontend-unit-test / backend-unit-test: write the tests FROM the record, verify they
   FAIL, list them in the state file.
5. **Implement** — GATE: red tests are listed. Run frontend-development /
   backend-development per ticket until the STEP-0 tests pass. Both in-prompt gates
   (shared/global change, logic) apply — undecided logic goes back to phase 3, not forward.
6. **Review** — GATE: tests green. Run frontend-code-review / backend-code-review in a
   FRESH context (or the read-only reviewer agent) — never the session that wrote the code.
   Findings → F-loop fix prompts. **The HUMAN is the final PASS**, not the report.
7. **Done** — GATE: review report with PASS + human confirmation. Report changed files +
   suggested commit message. NEVER run git commit.

## Override rule

A gate may only be bypassed by an EXPLICIT human instruction, recorded in the state file's
`overrides` with reason/owner/date. Silent skipping — including generating a stub artifact
to satisfy a gate — is prohibited; a stub artifact is worse than a missing one because it
lies. If the human asks you to skip without recording, record it anyway and say so.
