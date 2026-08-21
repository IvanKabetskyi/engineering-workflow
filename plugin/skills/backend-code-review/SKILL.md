---
name: backend-code-review
description: >
  Review Node/Express/TypeScript service changes against the backend canon. Graph-first
  global pass (graphify), mechanical battery, diff-scoped deep read with blast radius,
  test-integrity, security, and contract-parity passes. Critical/Major/Minor with a PASS
  verdict; gate violations are Critical; findings feed the F-loop. Step 3 of the backend
  pipeline. Triggers on: review backend, review api, check service, pre-commit backend review.
---

# Backend Code Review

STEP 3 of the backend pipeline — every endpoint, usecase, and fix ends here before the
human commits. Same review machinery as frontend-code-review (severities, verdict, report,
F-loop); backend rules and detectors. Standalone full-audit mode reads every file.

## Verdict (shared system)

**Critical** = production breaks, data loss/corruption, security hole, swallowed error on a
write path, unvalidated request input reaching a usecase, migration missing for a schema
change — and every GATE VIOLATION (undecided business logic implemented; a shared module /
DTO changed without the consumer map + human approval; a weakened test).
**Major** = layer-rule violation, missing error case, DTO drift from the record, missing
index for a list filter, coverage drop, `process.env` outside config.
**Minor** = naming/pattern/style, file >200 lines.
**PASS only with zero Critical AND zero Major.**

## Passes

### Pass 0 — graph-first (graphify)

Same as frontend: `god_nodes` ∩ diff ⇒ extra scrutiny; `get_neighbors` on every changed
shared module (anything two usecases/services import) ⇒ the blast-radius reading list;
`get_community` ⇒ duplicate usecases/mappers/services; structure smells (a controller
importing a repository, domain importing outward). No graph ⇒ grep fallback, note it.

### Pass 1 — mechanical battery

```bash
# domain purity: no framework/outer-layer imports in domain/            → Critical
grep -rnE "^import .*(express|mongoose|axios|zod|redis|socket\.io)" src/domain/

# controllers doing more than validate→usecase→respond                  → Major
grep -rln "Repository\|Model\|mongoose" src/application/controllers/

# models/schemas touched outside infrastructure                         → Critical
grep -rln "infrastructure/repositories/.*/schema" src/ | grep -v "^src/infrastructure/"

# raw req.* reaching usecases (unvalidated input)                       → Critical
grep -rn "req\.\(body\|params\|query\)" src/application/usecases/

# process.env outside config/                                           → Major
grep -rn "process\.env" src/ | grep -v "^src/config/"

# console.log (winston only)                                            → Major
grep -rn "console\.log" src/

# swallowed errors: empty catch or catch that only logs on write paths  → Critical
grep -rnA2 "catch" src/application src/infrastructure | grep -B1 "^\s*}"

# socket/event string literals at emit/on sites (constants only)        → Major
grep -rnE "\.(emit|on)\(['\"][A-Z_]+['\"]" src/ | grep -v constants

# cron job without the Redis lock guard (multi-node duplicate execution) → Critical
grep -rln "cron.schedule" src/ | xargs grep -L "isJobProcessing"

# Socket.IO server without the Redis adapter in a multi-replica service  → Critical
grep -rln "new Server(" src/application/modules/socket/ | xargs grep -L "createAdapter"

# silent safeParse that continues on failure (validation must THROW or   → Major
# explicitly log-and-stop; check each hit)
grep -rn "safeParse" src/ | grep -v test

# date library imported outside services/date (dates are SEPARATE)       → Major
grep -rn "from 'luxon'\|from 'date-fns'" src/ | grep -v "services/date"

# res.status outside controllers/middlewares                            → Major
grep -rn "res\.status" src/ | grep -v "controllers\|middlewares"

# comments, 200+ lines, .only/.skip, ../../../ — same as frontend battery
```

### Pass 2 — diff-scoped deep read (+ blast radius)

Human-grade checks: usecase logic vs the backend-architecture record (undecided logic =
Critical gate breach); entity behavior lives in entities, not usecases; every layer
crossing goes through a mapper; StatusError with correct httpStatus per the record's error
table; repository not-found/failed-write handling; outbound calls have retry+timeout and a
decided failure behavior; event/cron handlers delegate to usecases; naming = domain terms.

### Pass 3 — test integrity

STEP-0 tests listed and were red first; every new/changed endpoint has an e2e (incl. the
validation-failure case); mocks at the repository/outbound seam only; no weakened
assertions (Critical); coverage didn't drop; e2e uses the test DB (NODE_ENV=intTest),
never dev.

### Pass 4 — security

Auth middleware coverage per the record's route table (an unguarded new route = Critical);
JWT handling sane; no secrets in code/logs; zod validation on EVERY input surface (HTTP
params/body/query, socket payloads, cron inputs from queues); payload/file-upload limits;
injection surfaces (raw regex from user input, `$where`, string-built queries); rate/loop
concerns on fan-out code.

### Domain-parity check (part of Pass 2, mandatory on new projects/features)

Compare `src/domain/` against the architecture record's entity list: every listed entity
has its three-file folder (**missing real entity = Critical** — the business logic doesn't
exist); a domain folder still carrying the SCAFFOLD EXAMPLE's placeholder shape
(title/body Note with no model-derived behavior) = Major — it was neither deleted nor
rewritten to the model's real entity; a domain folder for an entity the record doesn't
know = Major (undocumented domain — amend the record or remove the code).

Placement direction also checks BOTH ways: an application-level entity (AppUser/session/
preferences — anything the domain model doesn't name) sitting in `src/domain/` = Major
(it belongs in `application/entities/`); a business entity from the model sitting in
`application/entities/` = Major (it escaped the domain layer). Repositories for
application entities still live in `infrastructure/repositories/` like everything else —
an application entity reaching the DB without one = the usual boundary Critical. Do NOT
flag an application entity for lacking the domain three-file shape — that shape is domain
canon only; application entities take whatever type the app's needs dictate (as recorded
in the architecture record).

### Pass 5 — contract parity

For every DTO/requestDto touched: does it still match the record? does the FRONTEND read
this field (check the FE repo's types when connected — the parity table from
frontend-architecture)? A reshaped response with a live FE consumer and no coordination
note = Critical. Events: payload type changes checked against every listener, both repos.

## Report

Same format as frontend-code-review (`[C1]/[M1]/[m1]`, File/Location/Problem/Fix/Rule) to
`_fix_reports/review-<scope>-<date>.md`; verdict; surviving findings → lessons rule + fix
prompt (F-loop). The reviewer never fixes code in pipeline mode.
