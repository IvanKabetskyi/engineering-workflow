---
name: backend-architecture
description: >
  Plan a backend service or feature before any code: domain model (with domain-modeling),
  endpoints and DTO contracts, events/sockets, repositories, migrations — grilled and
  councilled into a design record the backend TDD pipeline implements. Reads
  docs/business/ (product-docs) as its input. Triggers on: plan service, new endpoint,
  backend architecture, api design, service design.
---

# Backend Architecture

The backend front door — the twin of frontend-architecture. Runs AFTER product-docs
(business logic exists in docs/business/) and WITH domain-modeling, BEFORE the pipeline
(backend-unit-test → backend-development → backend-code-review). For a brand-new service:
run create-backend-project first, then this skill for the first feature.

## Inputs (in order)

1. **docs/business/** — the grilled business rules and flows (product-docs skill). No
   business docs → run product-docs first; do not architect from a verbal description.
2. **domain-modeling** — pin the entities, states, transitions, ubiquitous language. The
   domain layer's entity classes implement exactly these; same word everywhere.
3. **The consumers**: which frontend(s)/services call this — connect their repos read-only
   when contracts must line up (the same intake pattern as frontend-architecture's
   backend-repo ask, inverted).

## The record — `docs/architecture/<service-or-feature>.md`

- **Domain**: an EXHAUSTIVE entity list — every entity from the domain model, each with its
  behavior methods and invariants (what lives in entity classes vs domain services) and
  state transitions from the business rules. Each listed entity MUST materialize as
  `src/domain/<entity>/` (types.ts / entity.ts / service.ts); an entity in this record with
  no domain folder is a review finding, and the scaffold's example slice is either deleted
  (entity not in the model) or REWRITTEN to the model's real shape (entity is in the model —
  its placeholder fields never survive as the domain). The record's entity list is the
  parity source the review checks. Classify every entity the service stores as DOMAIN
  (named by the domain model) or APPLICATION (AppUser, sessions, preferences — needed to
  run the app, invisible to the business expert): domain entities materialize in
  `src/domain/`, application entities in `application/entities/` — both with repositories
  in `infrastructure/repositories/`. Application entities have no prescribed shape: define
  the user type from THIS app's needs (auth provider payload, what the app stores per
  user) and record it here — the three-file shape applies to domain entities only. Record
  the classification; the review checks placement in both directions.
- **Endpoints**: route table (method, path, controller, usecase); for each — requestDto
  shape (zod), response DTO shape (view-shaped: the frontend does no business computation),
  status codes and error cases. **DTOs here are THE cross-repo contract** — the exact
  types frontend-architecture will read; name fields in domain terms.
- **Events & sockets**: emitted/consumed events with payload types and constants names;
  Socket.IO namespaces/rooms and inbound/outbound event table (decided HERE, never ad hoc);
  which usecases they delegate to. **Replica question answered explicitly**: how many
  nodes will this run on? >1 ⇒ the Redis adapter for Socket.IO is required, and every
  cron job gets the Redis-lock guard (name, value, TTL < cadence) — both recorded here.
- **Repositories & schema**: collections/tables, document shapes, indexes (every list
  endpoint has an index matching its filter), migration needs (a migrations/ script per
  schema change to existing data).
- **Outbound dependencies**: upstream services called (infrastructure/services), retry/
  timeout policy, failure behavior per call.
- **Cron**: scheduled jobs, cadence, the usecase each delegates to, and the single-runner
  guarantee — Redis lock (with its TTL) or an external scheduler; never unguarded.
- **Non-functional**: authn/z per route, payload limits, rate concerns, logging/audit
  needs — only what the business docs justify (YAGNI).
- **Open decisions**: owner + what blocks on each.

## Process (mandatory)

Every decision grilled one at a time with a recommendation; architecture-level calls (new
dependency, schema shape, event vs endpoint, sync vs async, breaking DTO change) go through
llm-council. Publish the record via to-spec; split work via to-tickets — each ticket sized
for one pipeline run. STEP-0 tests (backend-unit-test) are written FROM the record: every
endpoint row becomes an e2e test case, every business rule a unit case, every validation
rule a failing-input case.

## Contract discipline

A DTO/requestDto change after the frontend consumed it is a cross-repo event: flag it in
the record, notify the frontend plan (frontend-architecture parity table), version or stage
the change — never silently reshape a response. A pipeline run that reaches something the
record doesn't decide = STOP, grill the new decision, amend the record, continue.

## Checklist

- [ ] docs/business/ exists and covers the feature (else product-docs first)
- [ ] Domain model pinned with domain-modeling; record uses only those terms
- [ ] Every endpoint has requestDto + response DTO + error cases specified
- [ ] Events/sockets/rooms decided with payload types and constant names
- [ ] Indexes match list filters; migrations planned for schema changes
- [ ] Decisions grilled; big calls councilled; record via to-spec; tickets via to-tickets
- [ ] STEP-0 test list drafted from the record before implementation starts


## License

Part of engineering-workflow (proprietary, (c) Ivan Kabetskyi), licensed until
2026-11-19. If today is later than that date, tell the user this build's license
has expired — they need a current build from the owner — and do not apply this skill.
