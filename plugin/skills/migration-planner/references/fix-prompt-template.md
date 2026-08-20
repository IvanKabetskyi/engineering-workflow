# Fix F<NN> — <short title>

Produced from a review finding (human review, side-by-side parity check, or report audit).
One fix prompt = one finding = one review round. Prompts are FROZEN once a report exists —
corrections ship as a new delta prompt (F<NN>b or a later number), never as edits.

```
MISSION: fix-F<NN> — <one-sentence statement of the defect>.

FINDING (from review): <what was observed, where, and why it is wrong — reference the
numbered rule in references/lessons-learned.md it violates; if no rule exists yet, the
finding CREATES one — add it before writing this prompt>.

VISUAL GROUND TRUTH (styling/behavior findings only): <the captured spec entry or screenshot
from references/visual-spec.md this must match — the DEPLOYED old app, never its source>.

SCOPE: <exact files/folders allowed to change>. Nothing outside this scope — if the fix
seems to require touching other files, STOP and report why instead of doing it.

═══════════════════════════════════════════════
TASKS — TDD ORDER IS MANDATORY
═══════════════════════════════════════════════
STEP 0 (frontend-unit-test skill): write a FAILING test that reproduces the finding
  (unit test for logic findings; @testing-library/react component test for behavior/render
  findings; pure styling findings that a DOM assertion cannot capture are exempt — say so).
  The fix is done when this test passes and nothing else broke.

1. <precise step>
2. <precise step>

FINAL STEP (frontend-code-review skill): self-review the diff before writing the report.

═══════════════════════════════════════════════
CONSTRAINTS
═══════════════════════════════════════════════
- All numbered rules in references/lessons-learned.md apply.
- No refactors beyond the finding. No "improvements while here."
- SHARED/GLOBAL CHANGE GATE (MANDATORY): shared roots (global requests/hooks/core, shared
  ui/form/common components) and any common/ folder have multiple consumers by definition.
  Before touching one: map EVERY consumer (the blast radius). Never stretch a shared
  component's functionality for one caller — the caller owns its specialization. A change to
  a shared/global module's contract, base styles, or behavior is NEVER decided unattended:
  propose it to the human FIRST with concrete examples (what changes, before/after, the full
  consumer list) — in a headless run, STOP the item into DISCREPANCIES with the proposal and
  continue with the rest. DRY, KISS, Law of Demeter, Boy Scout Rule, YAGNI.
- LOGIC GATE (MANDATORY): any logic in this fix (validation, submit flows, data hydration/
  mapping, state transitions, derived values, error surfacing) was decided WITH the human via
  grilling BEFORE this prompt was written, and the decided shape is spelled out in TASKS. If
  implementation reaches logic the tasks do not decide, STOP that item into DISCREPANCIES
  with the open questions — never design logic unattended.

═══════════════════════════════════════════════
DEFINITION OF DONE
═══════════════════════════════════════════════
- <verifiable check, grep/test, specific to this fix>
- <lint> && <typecheck> && <tests> — green.
- Report to _fix_reports/F<NN>-report.md: changed files, DISCREPANCIES, DEFERRED SMOKE.
- Do NOT run git commit. Suggested message: "fix(F<NN>): <short title>".
```
