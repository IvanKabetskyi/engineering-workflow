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

- **Domain**: entities, their behavior methods and invariants (what lives in entity classes
  vs domain services), state transitions from the business rules.
- **Endpoints**: route table (method, path, controller, usecase); for each — requestDto
  shape (zod), response DTO shape (view-shaped: the frontend does no business computation),
  status codes and error cases. **DTOs here are THE cross-repo contract** — the exact
  types frontend-architecture will read; name fields in domain terms.
- **Events & sockets**: emitted/consumed events with payload types and constants names;
  Socket.IO namespaces/rooms and inbound/outbound event table (decided HERE, never ad hoc);
  which usecases they delegate to.
- **Repositories & schema**: collections/tables, document shapes, indexes (every list
  endpoint has an index matching its filter), migration needs (a migrations/ script per
  schema change to existing data).
- **Outbound dependencies**: upstream services called (infrastructure/services), retry/
  timeout policy, failure behavior per call.
- **Cron**: scheduled jobs, cadence, and the usecase each delegates to.
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
