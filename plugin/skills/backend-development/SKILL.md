---
name: backend-development
description: >
  The company backend canon for Node/Express/TypeScript services — clean architecture
  (domain / application / infrastructure), zod request validation, usecase classes,
  repositories with document↔entity mappers, StatusError flow, events and cron modules.
  Step 2 of the backend pipeline: backend-unit-test → backend-development →
  backend-code-review. Triggers on: backend, service, endpoint, usecase, implement api.
---

# Backend Development (the canon)

Position in the pipeline: **STEP 2.** Tests exist and FAIL first (backend-unit-test owns
STEP 0/1); the work is done when they pass; the diff then goes through backend-code-review.
New services/features are planned by backend-architecture (with product-docs +
domain-modeling) before the pipeline starts.

Canonical reference implementation: driver-rest-service. The layer rules below ARE that
service's structure, generalized.

## The layers (dependency arrows point INWARD only)

```
src/
  domain/<entity>/            entity.ts (class), service.ts, types.ts — ZERO framework
                              imports: no express, no mongoose, no axios, no zod
  application/
    requestDto/               zod schema + z.infer type + validateXxx(data: unknown)
    usecases/                 one class per operation: constructor(repos/services), run(dto)
    controllers/<area>/       one file per endpoint: validate → usecase.run → res.status.send;
                              try/catch with next(error) — NOTHING else
    dto/                      response DTOs (what leaves the service — view-shaped)
    mappers/<entity>/         fromDocumentToEntity, fromEntityToDto, fromEntityToDocument —
                              every layer crossing is an explicit mapper
    router/                   express Router wiring paths to controllers
    statusError/              StatusError(message, httpStatus)
    modules/event/            emitter + listeners + constants + types (when events exist)
    services/cron/            scheduled jobs (when cron exists)
  infrastructure/
    repositories/<entity>/    class over the DB model + schema.ts; ONLY place that touches
                              the database; returns/accepts ENTITIES, never documents
    services/                 outbound HTTP clients (axios + axios-retry), one per upstream
  middlewares/                error middleware (zod-aware), auth, logging
  services/                   connect-db, date — process-level plumbing
  config/                     env parsing, single source for process.env
  utils/                      logger (winston + morgan-json), helpers
  test/e2e/                   supertest request tests per endpoint
migrations/                   one-off data migrations, runnable by script
```

## Layer rules (each violation is a review finding)

- **domain/** imports nothing from outer layers and no frameworks. Entities are classes:
  private data, `static create()`, getters, behavior methods (`updateGroup(...)`) — not
  bags of public fields. Domain services hold multi-entity logic.
- **Controllers are thin**: validate the request (zod requestDto), call ONE usecase, send
  the result with an explicit `httpStatus` constant, `next(error)` on catch. No business
  logic, no DB, no mapping in controllers.
- **One usecase per operation**, named for it (`UpdateDriverGroup`), dependencies injected
  via constructor, a single `run(dto)` entry. Usecases orchestrate: repositories + domain
  behavior + mappers. They never see express (`req`/`res`) or mongoose documents.
- **Repositories are the only DB boundary**: they own the model + schema, convert with
  `fromDocumentToEntity`/`fromEntityToDocument`, and throw `StatusError` on not-found/
  failed writes. Nothing outside infrastructure imports a model or schema.
- **Every request body/params/query is zod-validated** in requestDto before the usecase —
  `validateXxx(req.params)` — the usecase receives a typed DTO, never `req.anything`.
  The error middleware translates ZodError into a 400 with path+message list.
- **Response DTOs are explicit** (`application/dto`) and view-shaped — the frontend
  performs no business computation on them. These DTOs are THE contract
  frontend-architecture reads; changing one is a cross-repo event, not a refactor.
- **Errors**: throw `StatusError(message, httpStatus)`; the error middleware is the only
  res.status caller outside controllers. No swallowed errors — `.catch` either rethrows,
  maps to StatusError, or logs with context AND handles.
- **Outbound calls** live in `infrastructure/services` with axios-retry and timeouts;
  usecases depend on their interface, not on axios.
- **Events**: emitter + listener files per event, constants for names — no string literals
  at emit/listen sites. **Cron**: jobs under application/services/cron, logic delegated to
  usecases (a cron job is a controller with a clock).
- **Sockets (Socket.IO)**: the io server lives in `application/modules/socket/` — event
  NAMES as shared constants (never string literals at emit/listen sites; the same constants
  file shape the frontend mirrors), one listener file per inbound event that validates the
  payload with zod (a socket listener is a controller: validate → usecase.run → emit), and
  emits go through a typed emitter wrapper so payload shapes are checked. Rooms/namespaces
  decided in backend-architecture, never ad hoc. No business logic in socket handlers.
- **Config**: all env access through `config/` (parsed once, typed); `process.env` anywhere
  else is a finding. Secrets never logged.
- **Logging**: winston logger from utils; morgan-json for requests; no `console.log`.

## Shared code & naming

The frontend-development general rules apply where they translate: no comments (naming
explains), 200-line split rule, same-concept-same-word (domain term → DTO field → FE type),
search-before-create, YAGNI, and both GATES (a shared module here = anything two usecases/
services import — map consumers before changing; undecided business logic = STOP and grill).

## TypeScript & tooling

- commonjs + `tsconfig-paths` (dev) + `tsc-alias` (build); `baseUrl: "."` with `"*": ["src/*"]`
  paths — imports are bare from src (`domain/driver/entity`), never deep `../` chains.
- `strict: true`. DTO/requestDto types come from `z.infer` — never hand-duplicated.
- eslint airbnb-base + prettier; husky pre-commit runs lint + tsc.
- Scripts canon: `dev` (ts-node-dev), `build` (tsc + tsc-alias), `lint`, `tsc`, `test`
  (NODE_ENV=intTest, runInBand), `migrate:*` for migrations.

## Definition of done

- STEP-0 tests pass (unit + the endpoint's e2e); nothing weakened.
- lint + tsc green; no `console.log`; no `process.env` outside config; no framework import
  in domain; every new endpoint has requestDto validation + an e2e test.
- DTO changes flagged loudly in the report (frontend contract impact).
- NEVER run git commit — report changed files + suggested message; the human commits.
