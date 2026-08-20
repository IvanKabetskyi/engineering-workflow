# Chunk prompt template

One chunk = one session = one human commit/PR. The prompt must be self-contained: a fresh
session with only this prompt + the per-migration skill folder can execute it.

```
MISSION: <chunk NN> — <one sentence: what this chunk delivers>.

CONTEXT: read .claude/skills/<migration>/SKILL.md, references/target-patterns.md,
references/source-map.md, references/visual-spec.md (visual ground truth — the DEPLOYED app,
never the source), references/lessons-learned.md (all numbered rules apply),
references/session-context.md.

SCOPE: <exact files/folders allowed to change>. Nothing outside this scope — if the chunk
seems to require touching other files, STOP and report why instead of doing it.

═══════════════════════════════════════════════
TASKS — TDD ORDER IS MANDATORY
═══════════════════════════════════════════════
STEP 0 (frontend-unit-test skill): write the tests FIRST — they are the source of truth.
  Derive them from references/visual-spec.md + the old app's observed behavior:
  - unit tests for every mapper, validation schema, hook, and derived value this chunk ports;
  - component tests (@testing-library/react) for rendered behavior: what shows, when errors
    surface, what user interactions do.
  The tests MUST fail before implementation and pass at DoD. Do not weaken a test to make
  it pass — a test that contradicts the captured spec is a DISCREPANCY, not a rewrite target.

1. <precise step, with the source item (from source-map) and the target pattern (from
   target-patterns) named explicitly — implemented with the frontend-development skill>
2. ...

FINAL STEP (frontend-code-review skill): self-review the diff against the review skill's
checklist; unresolved findings go into the report, not silently fixed out of scope.

═══════════════════════════════════════════════
CONSTRAINTS
═══════════════════════════════════════════════
- Global conversion rules and dependency ban list per SKILL.md.
- Search before you create: grep shared roots for an existing implementation; reuse it and
  adapt call sites, not the shared code. Creating new files under the shared component root
  is OUT OF SCOPE — if a needed app-wide piece genuinely cannot be found, STOP and ask.
- Promotion ladder: 1 consumer → colocated under it; few consumers in a feature → nearest
  common/; consumers on multiple pages → global common. hooks/utils/mappers/types colocate at
  the nearest parent level (no common/ subfolder — that marker is components-only).
- SHARED/GLOBAL CHANGE GATE (MANDATORY): shared roots and any common/ folder have multiple
  consumers by definition. Map EVERY consumer before touching one. Never stretch a shared
  component for one caller — the caller owns its specialization. A shared contract/style/
  behavior change is NEVER decided unattended: propose to the human FIRST with before/after
  and the full consumer list — headless, STOP the item into DISCREPANCIES with the proposal
  and continue with the rest. DRY, KISS, Law of Demeter, Boy Scout Rule, YAGNI.
- LOGIC GATE (MANDATORY): all logic in this chunk (validation, submit flows, hydration/
  mapping, state transitions, derived values, error surfacing) was decided with the human via
  grilling before this prompt was written and is spelled out in TASKS. If implementation
  reaches logic the tasks do not decide, STOP that item into DISCREPANCIES with the open
  questions — never design logic unattended.
- Styling parity is judged against references/visual-spec.md, never against source code.

═══════════════════════════════════════════════
DEFINITION OF DONE
═══════════════════════════════════════════════
- <verifiable, greppable check specific to this chunk>
- <lint> && <typecheck> && <tests> — green.
- Report: changed files, DISCREPANCIES (stopped items with proposals/questions), DEFERRED
  SMOKE (manual side-by-side checks vs the deployed old app).
- Do NOT run git commit. Suggested message: "<migration>(NN): <chunk title>".
```
