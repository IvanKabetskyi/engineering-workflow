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
    entities/                 APPLICATION-level entities (AppUser, sessions, preferences) —
                              things the app needs to RUN that the business expert would
                              never mention; NOT in domain/ (load-board-backend canon)
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

- **domain/** imports nothing from outer layers and no frameworks. The three-file shape
  per entity (`domain/<entity>/`):
  - `types.ts` — the entity's type VOCABULARY: status unions (`'R' | 'A' | 'L' | 'T'`)
    with their display-name unions, value types (Tag, Coordinates, Location), the entity
    data type. Every downstream layer imports these — never redeclares them.
  - `entity.ts` — a class: private data, `static create()`, getters, behavior methods
    (`updateGroup(...)`) — not a bag of public fields. Invariants live here.
  - `service.ts` — the domain service DECLARES ITS OWN `Repository` contract as a
    structural type (`type Repository = { updateTagName: (...) => Promise<void>; ... }`)
    and receives it via constructor — dependency inversion with the domain owning the
    interface; infrastructure's repository satisfies it, the domain never imports
    infrastructure. **The repository is injected into the SERVICE, and ALL entity
    operations flow through the service** — usecases depend on the domain service, never
    on the repository directly. It also holds the `generate()` factory (new id +
    `Entity.create`) and multi-entity/collection-level operations.
- **domain/ holds BUSINESS logic ONLY — application entities live in
  `application/entities/`** (load-board-backend canon). The user/account (AppUser) is the
  canonical example: authentication identity is how the app operates, not what the business
  is about, so it does not get a `src/domain/` slice. The litmus test is the domain model:
  if the entity isn't in it (the business expert would never say the word), it belongs in
  `application/entities/`, not domain/. Its repository STILL lives in
  `infrastructure/repositories/` (e.g. `app-user-repository`) — the infrastructure boundary
  rule doesn't move with the entity; nothing outside infrastructure touches the DB either
  way. The reverse is equally a finding: a business entity from the domain model placed in
  application/entities has escaped the domain layer. (When the business IS about its users —
  drivers in a driver service — that entity is domain, under its business name.) Unlike
  domain entities, application entities have NO prescribed shape: the three-file
  types/entity/service pattern is the DOMAIN's canon, not theirs. The user type is defined
  by what THIS app needs — what the auth provider returns, what the app stores per user —
  so it can be a plain type, a class, whatever fits; each project decides in
  backend-architecture. What IS fixed: the repository boundary (infrastructure only) and
  validation at every input surface.
- **Dates are SEPARATE** (dispatch-assist + driver-rest-service canon): ALL date logic
  lives in `services/date/` — `index.ts` (functions wrapping the date library) +
  `formats.ts` (named format constants). The date library (luxon PREFERRED; date-fns
  accepted) is imported ONLY there; a `DateTime.fromISO`/`format(...)` call anywhere else
  is a finding. The library choice is asked at project creation and recorded.
- **Controllers are thin**: validate the request (zod requestDto), call ONE usecase, send
  the result with an explicit `httpStatus` constant, `next(error)` on catch. No business
  logic, no DB, no mapping in controllers.
- **One usecase per operation**, named for it (`UpdateDriverGroup`), dependencies injected
  via constructor, a single `run(dto)` entry. Usecases orchestrate through the DOMAIN
  SERVICE (which holds the injected repository) + mappers. They never see express
  (`req`/`res`), mongoose documents, or the repository directly.
- **Repositories are the only DB boundary**: they own the model + schema, convert with
  `fromDocumentToEntity`/`fromEntityToDocument`, and throw `StatusError` on not-found/
  failed writes. Nothing outside infrastructure imports a model or schema.
- **Validation is THROWING zod** (`.parse`, never silent safeParse-and-continue), defined
  once per input in requestDto as reusable `validateXxx(data: unknown)` functions:
  - HTTP: controllers call the validator before the usecase — the usecase receives a typed
    DTO, never `req.anything`; the error middleware turns ZodError into 400 path+message.
  - Non-HTTP inputs (events, cron payloads, change streams, socket payloads): **the
    USECASE (or listener) calls the same validator** — every input surface is validated by
    whoever first receives it, with the throw caught by that surface's error path.
  - Business-rule validation beyond shape (existence, state transitions, permissions)
    lives in usecases and entities and throws `StatusError` with the right httpStatus.
- **Response DTOs are explicit** (`application/dto`) and view-shaped — the frontend
  performs no business computation on them. These DTOs are THE contract
  frontend-architecture reads; changing one is a cross-repo event, not a refactor.
- **Errors**: throw `StatusError(message, httpStatus)`; the error middleware is the only
  res.status caller outside controllers. No swallowed errors — `.catch` either rethrows,
  maps to StatusError, or logs with context AND handles.
- **Outbound calls** live in `infrastructure/services` with axios-retry and timeouts;
  usecases depend on their interface, not on axios.
- **Events**: emitter + listener files per event, constants for names — no string literals
  at emit/listen sites.
- **Cron — the Redis lock is MANDATORY, not a recommendation.** Every replica runs
  node-cron, so an unguarded job executes N times per tick in a multi-node deployment.
  The canon (driver-rest-service `DriverEmployeeService` shape): a job CLASS with injected
  services, `start()`/`stop()`, and a distributed lock around `run()` —
  `isJobProcessing()` reads a named Redis key, `setJobProcessing()` writes it with
  `setEx` and a TTL slightly UNDER the cadence (e.g. 595s for a `*/10` job) so the lock
  self-expires before the next tick. Job name/value/TTL are named constants. Logic is
  delegated to usecases (a cron job is a controller with a clock). A cron service without
  redis available must use an external single-runner (k8s CronJob / EventBridge) instead —
  decided in backend-architecture, never left implicit.
- **Sockets (Socket.IO)**: the io server lives in `application/modules/socket/` — event
  NAMES as shared constants (never string literals at emit/listen sites; the same constants
  file shape the frontend mirrors), one listener file per inbound event that validates the
  payload with the throwing zod validator (a socket listener is a controller: validate →
  usecase.run → emit; the listener's try/catch logs invalid payloads), and emits go through
  a typed emitter wrapper. Rooms/namespaces decided in backend-architecture, never ad hoc.
  No business logic in socket handlers. **Multi-node rule (MANDATORY on AWS/k8s with >1
  replica): the io server runs with the Redis adapter** (`@socket.io/redis-adapter` on
  pub/sub clients from the redis connection) — without it, emits and rooms only reach
  sockets on the emitting node and cross-node users silently miss events. Wire the adapter
  from day one on any service that will scale; plain single-node io is for local dev only.
- **Auth — two sanctioned approaches**, chosen at project creation and recorded in
  backend-architecture (which routes require auth = the record's route table):
  - **Cognito JWT bearer** (the company default, BFF/driver approach): `middlewares/auth.ts`
    with `aws-jwt-verify`'s `CognitoJwtVerifier` (LAZY-created — pool validation must not
    run at import time), Bearer extraction, verified payload attached as `req.user`,
    everything else → StatusError 401. Config: `auth.region/userPool/clientId`.
  - **passport.js**: strategies chosen per project (jwt / local / google …), registered in
    `middlewares/auth.ts`, `passport.initialize()` in app, routes protected with
    `passport.authenticate(<strategy>, { session: false })`. Strategy verify callbacks
    delegate to usecases (a local strategy accepting anything is a Critical finding);
    env-dependent strategies register only when configured.
  An unguarded route the record marks as protected = Critical (review Pass 4).
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
