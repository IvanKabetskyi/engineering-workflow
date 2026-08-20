---
description: Start a brand-new project the right way — full business docs, domain model, scaffolded repo(s), then the feature workflow
---

Orchestrate a NEW PROJECT through the engineering workflow. Thin conductor: skills do the
work; you enforce order via artifact gates and the state file
(`docs/workflow/project.state.md`, same format as /new-feature's).

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
   feature work. The human runs npm install and confirms green.
4. **First feature** — hand off to /new-feature (which starts at its phase 2, since
   business docs and domain already exist). Every subsequent feature enters through
   /new-feature.

## Rules

- Do not skip to scaffolding because "we know what we're building" — phase 1 is the point.
- Overrides only by explicit human instruction, logged in the state file (reason/owner/date).
- NEVER run git commit; the human owns every commit.
