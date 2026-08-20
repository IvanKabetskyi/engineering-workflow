---
name: create-backend-project
description: >
  Scaffold a new company backend service: clean-architecture Express/TypeScript
  (driver-rest-service canon) with zod request validation, usecase classes, repository
  seam, StatusError flow, winston logging, jest+ts-jest+supertest tests — with flags for
  mongo, redis, cron, events, Socket.IO, and helm deploy. Runs via the bundled node CLI
  or by Claude applying the same templates.
  Triggers on: new backend, new service, scaffold api, create rest service.
---

# Create Backend Project

One command produces a service that passes `lint`, `tsc`, and `test` (unit + e2e) before
the first line of feature code — wired to the backend canon (backend-development) and the
testing canon (backend-unit-test) from minute one.

## How to run

```
node cli/create-backend-project.mjs                       # interactive
node cli/create-backend-project.mjs my-service \
  --port=3001 --db=mongo --redis --cron --events --sockets \
  --deploy=helm --extras=husky,ci                          # non-interactive
```

Options: `--db=mongo|none` (none = in-memory repository, same interface — swap to mongo
later without touching usecases), `--redis`, `--cron` (node-cron, jobs delegate to
usecases), `--events` (eventemitter3 module with constants), `--sockets` (Socket.IO module:
`as const` event constants — the same file shape the frontend mirrors — zod-validated
inbound payloads, room join/leave), `--deploy=helm|none` (Dockerfile + minimal chart),
`--extras=husky,ci`.

## What you get

The driver-rest-service structure with a working example slice (`note` entity) proving
every layer: domain entity class with behavior → zod requestDto → usecase class with
injected repository → thin controller → router → repository (in-memory or mongoose with
document↔entity conversion) → response DTO via mapper. Plus StatusError + zod-aware error
middleware (400 with path/message list), winston + morgan logging, typed config over
dotenv, tsconfig-paths/tsc-alias bare imports, airbnb-base + prettier (4-space, 120),
and FOUR passing test suites: liveness e2e, notes e2e (create/read/validation-400/404),
usecase unit at the repository seam, entity unit.

Delete the `note` slice once the first real entity exists — it's a teaching example, not
a keeper.

## After scaffolding

```
cd <name> && npm install && cp .env.example .env
npm run lint && npm run tsc && npm test   # green BEFORE feature work
git init && git add -A                    # human commits
```

Then: product-docs (if no docs/business/ yet) → domain-modeling → backend-architecture →
the pipeline (backend-unit-test → backend-development → backend-code-review).

## Maintenance

- The CLI's `files` map is the only template source; bump versions deliberately and
  re-verify (`--db=none` variant runs fully in any sandbox — no DB needed).
- Verified end-to-end 2026-08-20: `--db=none --sockets --events --cron --extras=husky,ci`
  (npm install + tsc + eslint + jest all green, 6 tests).
- mongo flavor requires a reachable MONGO_URI for e2e; the intTest env must point at a
  test database, never dev.
