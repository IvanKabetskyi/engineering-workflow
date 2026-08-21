---
name: backend-unit-test
description: >
  Write backend tests FIRST — tests are the source of truth. Step 0 of the backend
  pipeline (backend-unit-test → backend-development → backend-code-review) for every
  endpoint, usecase, entity, and fix in Node/Express/TypeScript services. Unit tests at
  the repository seam + supertest e2e per endpoint.
  Triggers on: backend test, api test, usecase test, e2e test, supertest, TDD backend.
---

# Backend Unit Test (tests first — they are the source of truth)

Position: **STEP 0 of the backend pipeline.** Tests are written BEFORE implementation —
from the backend-architecture record (endpoints, DTOs, business rules from product-docs /
domain-modeling). The work is done when the pre-written tests pass. A test that contradicts
the record is a DISCREPANCY to raise, never a rewrite target. Do not weaken a test to make
it pass.

## The stack (canon — matches driver-rest-service)

Jest + ts-jest, `testEnvironment: node`, `moduleDirectories: ['node_modules', '<rootDir>/src']`
(bare imports work in tests), supertest for e2e, `NODE_ENV=intTest`, `--runInBand` (e2e
tests share state; parallel workers corrupt it), `--forceExit` guarded by proper teardown.

**Timeouts**: `testTimeout: 30000` in jest.config (DB-backed e2e regularly exceeds jest's
5s default — "Exceeded timeout of 5000 ms" on a repository call almost always means the
DB connection never happened, not a slow test). A test that legitimately needs more gets
an explicit per-test timeout; never "fix" a timeout by removing the assertion.

**The test database — the canonical three-file setup** (scaffold default; the same suite
runs against a real engine by just setting MONGO_URI):
- `src/test/globalSetup.ts` — boots ONE mongodb-memory-server for the whole run and
  publishes its URI via `process.env.MONGO_URI`; if MONGO_URI is already set it steps
  aside entirely (that's the real-engine escape hatch); `launchTimeout: 60000` because a
  first launch (binary download + macOS Gatekeeper verification) routinely exceeds the
  10s library default; the failure message tells you the MONGOMS_DEBUG=1 and docker
  fallback moves.
- `src/test/afterEnv.ts` (setupFilesAfterEnv) — per-suite mongoose lifecycle:
  `beforeAll` connects (app.ts deliberately never connects — server.ts owns it in prod,
  THIS file owns it in tests; without it every repository call buffers until timeout);
  **`afterEach` wipes every collection** — per-TEST isolation, no cross-test data bleed;
  `afterAll` drops the database and disconnects.
- `src/test/globalTeardown.ts` — stops the memory server.

Never the dev database, in any mode. A team may point MONGO_URI at a dedicated intTest
database (driver-rest-service approach) — the setup above already supports it unchanged.

## Two layers, both mandatory per operation

### 1. Unit tests — the repository seam

The mock boundary is the **repository (and outbound-service) interface** — the backend
twin of the frontend's request-module seam:

- **Usecases**: instantiate with a mocked repository object (`{ getDriverByTmsId: jest.fn() }`),
  feed typed entity fixtures, assert the returned DTO and the repository calls. No DB, no
  express, no mongoose in usecase tests.
- **Entities & domain services**: pure unit tests — behavior methods, invariants,
  edge values (the domain layer has no dependencies, so no mocks at all).
- **Mappers**: table-driven (document→entity→dto round trips, null/absent field handling).
- **requestDto schemas**: table-driven valid/invalid cases — every validation rule the
  record specifies has a failing input proving it.
- Never mock what you own INSIDE the layer under test (don't mock a mapper to test a
  usecase); never mock mongoose internals (that's the repository's job to hide).

### 2. e2e tests — supertest per endpoint

Every endpoint gets a `src/test/e2e/**/<operation>.test.ts`: boot the app (test env),
hit the real route, assert status + response body shape + side effects. Validation
failures are e2e cases too (bad payload → 400 with path+message list from the error
middleware). DB-backed e2e uses the test database (NODE_ENV=intTest config), seeded and
cleaned per suite — never the dev database.

Socket.IO features: e2e with a real socket.io-client against the test server — emit the
inbound event, assert the outbound emit payload; event constants imported from the shared
constants file, never string literals in tests.

## Fixtures

Typed builders per entity/document/DTO (`buildDriverEntity(overrides?)`), colocated with
the tests that own them — same rule as frontend: fixtures typed from the real types, never
loose `any` literals.

## What NOT to test

- mongoose/express/socket.io internals (the framework)
- the mapper output through three layers at once in a "unit" test — that's what e2e is for
- config parsing beyond the invalid-env failure case

## Coverage

Same ratchet as frontend: no global threshold at first; new work is born-covered by TDD;
the gate is tests-pass + coverage never drops vs the recorded baseline. A meaningless test
written to move the number is a review finding.

## Definition of done (per operation)

- Unit tests (usecase + entity/mapper/requestDto as applicable) AND the endpoint e2e
  existed and FAILED before implementation — the report lists them.
- All green; no `.only`/`.skip`; mocks at the repository/outbound-service seam only;
  fixtures typed; coverage did not drop.
