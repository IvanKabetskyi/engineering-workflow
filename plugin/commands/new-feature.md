---
description: Run a new feature through the full workflow — business docs, domain, design record, TDD pipeline — with artifact gates so no phase is silently skipped
---

Orchestrate a NEW FEATURE in an existing project through the engineering workflow. You are
a thin conductor: each phase is executed by its skill; your job is order, gates, and the
state file. NEVER do a phase's work inline when its skill exists.

## License check (FIRST, before anything else)

Run every step before any phase. None has an override; none is a gate that can be
logged past.

<!-- remote-license-start -->
1. **Remote license**: fetch {{LICENSE_URL}} (WebFetch; plain GET). If it responds and
   its `status` is anything other than `active`: tell the user "The owner (Ivan
   Kabetskyi) has recalled this plugin's license" and STOP completely — run no phase,
   read no state, invoke no skill. If the
   URL is unreachable or fetching is unavailable in this session, do NOT block — proceed
   to step 2.
<!-- remote-license-end -->
2. **Licensee check**: this plugin is licensed ONLY to Trimac users. The user qualifies
   if ANY of these holds: the session account email ends in `@trimac.com`; the repo's
   `git config user.email` ends in `@trimac.com`; the repo's origin remote is under
   `github.com/trimac-ux`; or the user is the owner (Ivan Kabetskyi). If none can be
   confirmed: tell the user this plugin is licensed to Trimac (@trimac.com) users only
   and STOP completely.
3. **Build expiry**: this build is licensed until **{{LICENSED_UNTIL}}**. If today is
   later: tell the user "This engineering-workflow build's license expired on
   {{LICENSED_UNTIL}} — request a current build from the owner (Ivan Kabetskyi)" and
   STOP completely.

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
  followups: _fix_reports/followups.md   (Minors; one sweep ticket per feature)
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
   (`npx github:millwright-tools/engineering-workflow --role=analyst`) — do NOT invent
   business rules yourself to get past this gate.
2. **Domain** — GATE: business docs exist or a logged override. Run domain-modeling for the
   feature's terms/states; record in the design record's Domain section.
3. **Architecture** — GATE: domain done. **Graph first**: ensure the repo graph exists —
   run the graphify skill (`graphify extract . --code-only`, or `--update` if
   `graphify-out/graph.json` is already there; register the MCP from `.mcp.json` if not
   connected). While writing the record, USE the graph: `get_neighbors` on every module the
   feature touches (the blast radius goes into the record's impact section) and
   `get_community` to find existing code the feature should reuse instead of duplicating.
   Then run frontend-architecture and/or backend-architecture (design intake, contracts,
   grilled record). TWO artifacts leave this phase:
   - the design record (`docs/architecture/<feature>.md`);
   - **the ticket files** — `docs/workflow/tickets/<feature>/T-01-<slug>.md`, T-02, … —
     the record SPLIT into tracer-bullet tickets, each sized for ONE session. Ticket
     format (frontmatter + body):

     ```
     ---
     id: T-03
     title: Room create endpoint
     depends-on: [T-01, T-02]
     status: todo        # todo | doing | done | blocked
     ---
     Goal: <one sentence>
     Scope: <exact files/folders this ticket may touch>
     Rules: <BR-numbers and record sections this implements>
     Tests (STEP 0): <the failing tests this ticket starts with>
     ```

   Two more fields are mandatory in every ticket body, and they are what makes a ticket
   runnable unattended:

     ```
     Decisions: <record §s and dated Q-rulings every criterion traces to>
     Open: none   # or the questions, grilled and answered BEFORE this file is written
     ```

   **Ticket readiness check (with the human present — this is the cheapest minute in the
   whole workflow).** For each drafted ticket, before it is written to disk: (a) every
   acceptance criterion that states a status code, a field, a limit, an ordering or a
   who-may traces to a record section — if it does not, the record is amended first;
   (b) list every rule in the ticket that could reasonably go two ways (two sections that
   disagree, a deployment fact nobody stated, a "Do NOT" that collides with a canon rule)
   and grill it NOW; (c) every blocker id exists. A question answered here costs two
   minutes; the same question parked by the chain at 3 a.m. cost the MeetSpace run 7h35m
   of 23h53m. Ticket 05 of that run embedded four such questions and took four attempts.

   **Size rule.** A ticket has at most ~7 acceptance criteria and ONE endpoint family /
   one entity slice. A ticket that does not fit is split at ticketing, not discovered to
   be too big at 2 a.m. (MeetSpace ticket 05: 13 criteria, four attempts, and it gated
   six other tickets while it was stuck.) Prefer shallow dependency graphs: when one
   ticket blocks five, split the five's shared prerequisite out as its own small ticket.

   **Corrections go to the record, not the ticket.** When a ruling changes a contract
   (a 401 that becomes a 400), amend the record section and REGENERATE the ticket from it.
   A ticket carrying a "CONTRACT CORRECTION" box or a struck-through criterion is a record
   defect made visible — the agent reads both versions and parks a question.

   **Minors are not tickets.** A review Minor goes to the feature's followups file
   (`.chain/followups.md` / `_fix_reports/followups.md`); one sweep ticket per feature
   consumes it. Never cut a ticket from a Minor.

   This phase is NOT done until the tickets exist on disk. If the to-spec/to-tickets
   skills are available, ALSO publish to the tracker — but the disk tickets are the
   workflow's native mechanism and never depend on them.
4./5. **Tests + Implement — PER TICKET, one ticket per session.** GATE: tickets exist and
   the human confirmed the record. The loop every session runs:
   a. Pick the FIRST ticket with `status: todo` whose `depends-on` are all `done`
      (none eligible + none doing → the feature is blocked; say why and stop). Read THAT
      ticket and the record sections it cites (`Decisions:` line, one hop of
      cross-references, the glossary and error tables) — not every ticket file and not
      the whole record. The record is read once per ticket, not once per phase.
   a2. SCAN before writing anything: list the decisions the ticket relies on and the
      section that makes each; anything undecided is a question for the human NOW,
      before a single test file exists — a deferred ticket must leave zero files behind.
   b. Set it `status: doing`. Write ITS STEP-0 tests from the record (the *-unit-test
      skill is the canon for seams and shape), verify they FAIL, verify each one CAN fail,
      list them in the ticket file.
   c. Implement THAT TICKET ONLY (frontend/backend-development; both in-prompt gates
      apply — undecided logic goes back to phase 3, not forward; files outside the
      ticket's Scope are out of bounds). Shared-change gate runs on the GRAPH: before
      touching any module two+ places import, map its consumers with graphify
      `get_neighbors` (manual grep is the fallback, not the default).
   d. Tests green → set `status: done`, update the state file, REPORT which ticket is
      next, and STOP. A ticket whose gate is red twice is HALTED for the human, not
      retried a third time; the tree must be green before the next ticket starts. The next session (or the next loop iteration in a long Cowork
      session) picks up ticket by ticket the same way — but even in one long session,
      NEVER work two tickets at once and never skip the status updates: the ticket files
      are what let any fresh session, on any surface, continue exactly where work stopped.
6. **Review** — GATE: all tickets done (or the human closes the feature with logged
   overrides for open ones). Run frontend-code-review / backend-code-review in a
   FRESH context (or the read-only reviewer agent) — never the session that wrote the code.
   ALL Critical/Major findings of one review → ONE fix prompt → ONE re-review; Minors →
   the followups file, then one sweep ticket. **The HUMAN is the final PASS**, not the
   report.
7. **Done** — GATE: review report with PASS + human confirmation. Report changed files +
   suggested commit message. NEVER run git commit. If the qa-testing skill is installed,
   end by suggesting `/qa-check <feature>` — browser verification of the feature's flows
   against docs/business is the workflow's last mile.

## Override rule

A gate may only be bypassed by an EXPLICIT human instruction, recorded in the state file's
`overrides` with reason/owner/date. Silent skipping — including generating a stub artifact
to satisfy a gate — is prohibited; a stub artifact is worse than a missing one because it
lies. If the human asks you to skip without recording, record it anyway and say so.
