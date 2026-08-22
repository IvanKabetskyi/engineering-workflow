---
name: ticketing
description: >
  Turn a grilled design record into the tickets the TDD pipeline and the chain-runner
  execute — tracer-bullet slices with blocking edges, each sized for one session, each
  citing the record sections every criterion traces to, each shipping with `Open: none`
  because every two-way rule was grilled with the human BEFORE the file was written.
  Owns the ticket format, the readiness check, the size rule, regeneration after a
  record correction, the followups sweep, and the chain handoff (queue + cross-repo gates).
  Step 3b of /new-feature and /migrate; to-tickets may publish the approved set to a
  tracker afterwards. Triggers on: tickets, cut tickets, split the record, ticketing,
  backlog, enqueue, what goes in the queue.
---

# Ticketing (the record, cut into runnable work)

Position: **after the design record is grilled and confirmed, before any STEP-0 test.**
Input: `docs/architecture/<feature>.md` (numbered sections), `docs/business/` (BR numbers),
`CONTEXT.md` (glossary). Output: one file per ticket under
`docs/workflow/tickets/<feature>/`, the state file's ticket list, and — when a chain runs
the implement phase — the `enqueue.sh` line and any `gates.txt` entries.

A ticket is the ONLY thing an unattended session reads before it starts writing tests.
Everything the MeetSpace stress test lost to parked questions (7h35m of 23h53m) was a
decision that could have been made here, with the human in the room, in two minutes.

## 1. Slice the record into tracer bullets

Vertical, not horizontal: a ticket cuts a narrow but COMPLETE path through every layer its
feature needs (requestDto → usecase → repository → e2e; or request module → component →
test) and is demoable or verifiable on its own. Horizontal slices ("the Room entity and
its invariants", "the claims collections") are legitimate ONLY when `/new-project` phase 4
(domain materialization) has not yet produced that entity — and then they are phase-4
work, logged as such, not feature tickets.

Use the glossary's words in titles and bodies. Respect the ADRs in the area.

"Make the change easy, then make the easy change": if the record needs a prefactor (a
seam that does not exist yet, a shared module that must grow a consumer map), that is the
FIRST ticket, and everything else is blocked by it.

**Wide refactors are the exception.** A mechanical change whose blast radius spans the
codebase (rename a column, retype a shared symbol) cannot land green as one slice.
Sequence it expand → migrate-in-batches → contract: add the new form beside the old (one
ticket); migrate call sites in batches sized by blast radius, each its own ticket blocked
by the expand; delete the old form in a ticket blocked by every batch.

## 2. Size rule (hard)

- **At most ~7 acceptance criteria** and **one endpoint family or one entity slice** per
  ticket. More than that is two tickets.
- Fits ONE fresh session: tests + implementation + review in a single context window.
- **Shallow dependency graph.** When one ticket would block five, split the shared
  prerequisite out as its own small ticket so the five wait on something cheap. MeetSpace
  ticket 05 had 13 criteria, took four attempts, and gated six tickets while it was stuck.
- Blocking edges name only tickets that GENUINELY gate this one (a contract it consumes,
  a module it extends). "Nice to have first" is not an edge.

## 3. Readiness check (with the human — never skipped, never unattended)

For each drafted ticket, before it is written to disk:

1. **Every criterion traces.** A status code, a field, a limit, an ordering, a who-may —
   each points at a record section (`§5`) or a dated ruling (`Q04-2, 2026-08-21`). A
   criterion with no section means the record is missing a sentence: amend the record
   FIRST, then cite it. Never write the decision into the ticket alone.
2. **Two-way rules are grilled now.** List every rule in the ticket that could reasonably
   go two ways: two sections that disagree (MeetSpace §3 said 403, §7 said 401 — that
   became two extra tickets); a deployment fact nobody stated (replica count, adapter
   installed or not); a "Do NOT" that collides with a canon rule the review enforces
   (the review skill calls it Critical, the ticket forbids building it → record an
   `Exemption:` line in the record, see the architecture skills). Grill each with the
   human, record the answer in the record, cite it.
3. **Blocker ids exist.** Every `depends-on` and every cross-repo gate id names a ticket
   that is on disk or in the other repo's queue. (MeetSpace F04 waited forever on
   `RB01, RB02`, ids that existed nowhere.)
4. **Canon conflicts are visible.** If the slice cannot be built inside the canon
   (`*-development` skills) without a decision — a shared module must change, an
   application entity vs domain entity placement is unclear — that is a question here,
   not in the chain.

A ticket leaves this step with `Open: none`. If a question is still open, the ticket is
not written; it waits in the state file's `open decisions` until the human answers.

## 4. Ticket file

`docs/workflow/tickets/<feature>/T-NN-<slug>.md`, numbered in dependency order
(blockers first), one ticket per file — never a combined file.

```
---
id: T-03
title: Room create endpoint
depends-on: [T-01, T-02]
gate: []              # cross-repo ids that must be GREEN in the other chain, if any
status: todo          # todo | doing | done | blocked | halted
---
Goal: <one sentence — the end-to-end behaviour this makes work, from the user's side>
Scope: <exact folders/files this ticket may touch; everything else is out of bounds>
Rules: <BR-numbers this implements>
Record: docs/architecture/<feature>.md §2, §3, §5   # the sections; the chain extracts these
Decisions: §3 (status table), §5 (write precondition), Q04-2 (2026-08-21, Ivan)
Open: none
Do NOT: <what is explicitly out of scope, and which ticket owns it>
Tests (STEP 0): <the failing tests this ticket starts with — one per criterion>

- [ ] criterion 1 — BR-xx / §n
- [ ] criterion 2 — BR-xx / §n
```

Rules for the body:

- **No file paths or code in criteria** — they go stale; `Scope:` carries the paths.
  Exception: a snippet from a prototype that encodes a decision more precisely than prose
  (a state machine, a schema shape) — inline it, trimmed to the decision.
- **No correction boxes, no strikethroughs.** When a ruling changes a contract, amend the
  record section with a dated note and REGENERATE the ticket from it. A ticket that reads
  "was 401, now 400" is a record defect the chain will park on.
- **No essay.** The reasoning behind a ruling lives in the record (`§11 change log`), not
  in the ticket. MeetSpace ticket 17 was ~100 lines; the agent needs the criteria and the
  citations.
- **Every criterion cites** its BR or section on the same line.

## 5. Quiz the human, then write

Present the set as a numbered list — title, blocked by, what it delivers, open questions
found in §3 — and ask exactly three things: granularity right (too coarse / too fine)?
edges right (each only on what genuinely gates it)? anything to merge or split? Iterate
until approved. Then write the files, update `docs/workflow/<feature>.state.md` with the
ticket list, and work the **frontier**: any ticket whose blockers are all done.

## 6. Followups and discovered scope

- **A review Minor is never a ticket.** It goes to `_fix_reports/followups.md` (or
  `.chain/followups.md`) under the ticket's heading; ONE sweep ticket per feature,
  `T-NN-followups-sweep`, consumes the file at the end. MeetSpace cut three Minors into
  three ninety-minute tickets — that is the failure this rule prevents.
- **A Critical/Major that lands after PASS** is an F-loop fix (`/new-fix`), not a ticket.
- **Scope a review discovers** (a real missing behaviour, a contradiction) goes through
  §3 like any other ticket — amend the record, grill, then cut. It is not appended to a
  running ticket's criteria.

## 7. Chain handoff (when chain-runner runs the implement phase)

- Print the `enqueue.sh` line: `./.chain/enqueue.sh docs/workflow/tickets/<feature>
  T-01: T-02:T-01 T-03:T-01,T-02 …` — ids and blockers straight from the frontmatter.
- Cross-repo tickets (a frontend ticket gated on backend ids): one `gates.txt` line per
  ticket, `F02:B03,B08,R02`, and only ids that exist (§3.3).
- A ticket's `Record:` line is what `ctx.sh` extracts for every phase — keep it precise
  (sections, not whole files).
- The chain reads ONE ticket per session. It never needs the others; do not make a ticket
  reference "see ticket 13's discussion" — put the decision in the record and cite it.

## 8. Publishing to a tracker (optional)

If `to-tickets` (or a tracker connector) is available, publish the APPROVED set after the
files exist: one issue per ticket in dependency order, native blocking links where the
tracker has them, the `ready-for-agent` label. The disk files remain the workflow's
mechanism; the tracker mirrors them and never replaces them.

## Checklist

- [ ] Every ticket ≤ ~7 criteria, one endpoint family / entity slice, fits one session
- [ ] Every criterion cites a BR or a record section; `Decisions:` lists them
- [ ] `Open: none` — every two-way rule grilled and recorded BEFORE the file was written
- [ ] Every `depends-on` / `gate` id exists
- [ ] No paths/code in criteria, no correction boxes, no essays
- [ ] Prefactor / expand–contract first where needed
- [ ] Followups sweep ticket exists for the feature
- [ ] enqueue line + gates.txt lines printed when a chain will run it
