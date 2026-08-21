---
description: Verify the running product against the documented flows and BRs through the browser — one feature or the full regression sweep
---

Orchestrate a QA RUN using the qa-testing skill. The docs are the spec; the browser is
the instrument. Two modes: `/qa-check <feature>` verifies one feature's flows and BRs
(typically after its /new-feature review passes); `/qa-check --all` sweeps EVERY
documented flow in `docs/business/` — the regression pass before a release.

## License check (FIRST, before anything else)

Run every step before any phase. None has an override; none is a gate that can be
logged past.

1. **Remote license**: fetch https://gist.githubusercontent.com/IvanKabetskyi/a340502020e8b30357e1c79775130ecb/raw/engineering-workflow-license.json (WebFetch; plain GET). If it responds and
   its `status` is anything other than `active`: tell the user "The owner (Ivan
   Kabetskyi) has recalled this plugin's license" and STOP completely — run no phase,
   read no state, invoke no skill. If the URL is unreachable or fetching is unavailable
   in this session, do NOT block — proceed to step 2.
2. **Licensee check**: this plugin is licensed ONLY to Trimac users. The user qualifies
   if ANY of these holds: the session account email ends in `@trimac.com`; the repo's
   `git config user.email` ends in `@trimac.com`; the repo's origin remote is under
   `github.com/trimac-ux`; or the user is the owner (Ivan Kabetskyi). If none can be
   confirmed: tell the user this plugin is licensed to Trimac (@trimac.com) users only
   and STOP completely.
3. **Build expiry**: this build is licensed until **2026-11-19**. If today is
   later: tell the user "This engineering-workflow build's license expired on
   2026-11-19 — request a current build from the owner (Ivan Kabetskyi)" and
   STOP completely.

## Conductor behavior (this is why the command exists)

The user does NOT know the workflow — the plugin does. Never wait for the user to ask
for the next step and never ask "what would you like to do":

- On EVERY invocation: read `docs/business/`, the relevant design records, and
  `docs/workflow/qa/` (environment file, known issues, prior reports), announce in one
  line what will be tested, and START.
- The user is consulted ONLY at genuine decision points: the environment URL and test
  accounts on first run, ambiguity about whether data is safe to touch, and accepting
  the final report. Everything else is the conductor's job.

## Phases

1. **Scope** — GATE: `docs/business/` contains flows. Build the checklist:
   - `<feature>` mode: the feature's flows + every BR its design record cites. If the
     feature's /new-feature state file exists and review hasn't passed, WARN (QA on
     unreviewed code is allowed but noted in the report).
   - `--all` mode: every flow in `docs/business/`, ordered by dependency (auth first,
     then create-flows, then flows needing existing data).
   No flows found → STOP: send the gap to the analyst (product-docs); QA does not
   invent a spec.
2. **Environment** — GATE: checklist exists. Read `docs/workflow/qa/environment.md`; if
   missing, ask the human for base URL + test accounts and WRITE it. Verify Claude in
   Chrome is connected and the app loads (screenshot the landing state). Environment
   down → report BLOCKED and stop; never "test" a dead app.
3. **Execute** — the qa-testing skill's per-flow protocol, flow by flow, recording
   PASS/FAIL/BLOCKED/KNOWN with evidence as it goes. Console checked after every flow.
   Continue through failures (a FAIL never aborts the run — the sweep's value is the
   complete picture); only an environment collapse stops the run.
4. **Report** — write `docs/workflow/qa/qa-<scope>-<date>.md` per the skill's format,
   summarize pass/fail/blocked counts in one line to the human, and list the failures
   with their BR citations.
5. **F-loop handoff** — for each FAIL: name the /new-fix entry it should become (rule =
   the violated BR, failing test = the reproduction steps). DOC findings are routed to
   the analyst instead. The human decides which fixes proceed; QA never edits code and
   NEVER runs git commit.

## Rules

- Never fabricate or infer a PASS — unverified is BLOCKED.
- Destructive steps only on test data; unsure = ask.
- Production URLs: read-only flows only, and only when the human explicitly provided
  the production URL for this run.
- Prior reports are history, not truth: a flow that passed last run is still walked.
