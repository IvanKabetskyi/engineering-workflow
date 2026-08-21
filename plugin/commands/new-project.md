---
description: Start a brand-new project the right way — full business docs, domain model, scaffolded repo(s), then the feature workflow
---

Orchestrate a NEW PROJECT through the engineering workflow. Thin conductor: skills do the
work; you enforce order via artifact gates and the state file
(`docs/workflow/project.state.md`, same format as /new-feature's).

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

## Phases and gates

1. **Business docs (full)** — run the product-docs skill completely: vision, users/roles,
   numbered business rules, flows, glossary, integrations, open questions. This is the
   longest phase and it is ALL the human's decisions (grilling one at a time; council the
   contested rules). GATE for everything after: `docs/business/` exists and the human
   confirmed it matches their head.
2. **Domain model** — run domain-modeling over the glossary + rules. Artifact: the domain
   model with entities, states, transitions mapped to BR-numbers.
3. **Scaffold** — GATE: domain done. Run the create-frontend-project and/or
   create-backend-project CLI (ask the option questions: UI lib, data layer, port, db,
   sockets, extras). Artifact: scaffolded repo(s) with lint + tsc + tests GREEN before any
   feature work. The human runs npm install and confirms green. Then wire the graph:
   the scaffold's `.mcp.json` already registers the graphify MCP — run
   `graphify extract . --code-only` (graphify skill) so `graphify-out/graph.json` exists
   from day one; every later phase queries it.
4. **Domain materialization** — GATE: scaffold green. BEFORE any feature: create the REAL
   domain from the Phase-2 domain model. Every entity in the model gets its
   `src/domain/<entity>/` three-file set (types.ts vocabulary, entity.ts class with
   behavior, service.ts with the domain-owned Repository contract) — written tests-first
   (entity behavior tests from the model's invariants/BR-numbers). **Reconcile the
   scaffold's example slice (`note`) against the model**: if the model has NO such entity,
   delete the whole slice (domain/note + its requestDto/usecases/controllers/repository/
   tests); if the model DOES have that entity (a booking app with meeting Notes, say),
   REWRITE the example into the model's REAL entity — its actual fields, behavior methods,
   invariants, and BR-derived tests — the placeholder title/body shape is not your domain.
   Either way, the model's entity list is the only truth: ALL its entities exist when this
   phase ends (a project with `note` reconciled but `room` missing has still skipped it).
   Application entities (AppUser, sessions — needed to run the app but absent from the
   domain model) do NOT go to `src/domain/`: they live in `application/entities/`, with
   their repositories in `infrastructure/repositories/` like everything else.
5. **First feature** — hand off to /new-feature (which starts at its phase 2, since
   business docs and domain already exist). Every subsequent feature enters through
   /new-feature.

## Rules

- Do not skip to scaffolding because "we know what we're building" — phase 1 is the point.
- Overrides only by explicit human instruction, logged in the state file (reason/owner/date).
- NEVER run git commit; the human owns every commit.
