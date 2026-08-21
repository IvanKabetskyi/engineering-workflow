---
description: Turn a finding into a gated fix — failing test first, scoped prompt, review — the F-loop entry point
---

Orchestrate a FIX (from a review finding, a bug report, or a human observation) through the
F-loop. Works inside any of the three workflows.

## Conductor behavior (this is why the command exists)

The user does NOT know the workflow — the plugin does. Never wait for the user to ask for
the next step and never ask "what would you like to do":

- On EVERY invocation: read the state file + ticket files, announce in one line where the
  feature stands, and immediately START executing the current phase (invoke its skill).
- When a phase completes: continue straight into the next phase if the session has room;
  otherwise end by telling the user the exact next action ("open a session and run
  /new-feature — it will do X").
- The user is consulted ONLY at genuine decision points: grilling answers, record
  confirmation, overrides, and the final PASS. Everything else is the conductor's job.

## Phases and gates

1. **Finding → rule** — state the defect in one sentence; if it violates (or reveals) a
   canon rule, add/amend the numbered rule in the relevant lessons/canon file FIRST. The
   rule is the artifact.
2. **Failing test (STEP 0)** — GATE: rule recorded. Per frontend/backend-unit-test: write a
   test that REPRODUCES the finding and fails (unit for logic; component/e2e for behavior;
   pure styling exempt — say so and rely on the visual spec). List it.
3. **Fix prompt** — GATE: red test exists (or styling exemption logged). SCOPE comes from
   the graph: graphify `get_neighbors` on the defective module maps every consumer the fix
   can break (refresh a stale graph with `graphify extract . --update` first). Write
   `prompts/fixes/F<NN>-*.md` from the fix template: MISSION, FINDING (citing the rule),
   SCOPE (exact files; nothing outside), TASKS with the decided shape (undecided logic →
   grill FIRST), both gates, DoD with the failing test + suite green + no commit.
4. **Execute** — run the prompt (interactive or chain). STOPs go to DISCREPANCIES, never
   silent decisions.
5. **Review** — code-review pass on the diff in fresh context; the HUMAN is the final PASS
   and makes the commit ("fix(F<NN>): <title>").

Frozen-prompt rule: once F<NN> has a report, its bytes never change — corrections ship as
a new delta prompt. One finding = one prompt = one review round.
