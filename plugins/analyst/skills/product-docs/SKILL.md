---
name: product-docs
description: >
  The very first step of any product or major feature — before domain-modeling, before any
  architecture, before design. Drives grill-with-docs and llm-council to turn what's in the
  human's head into written business documentation (docs/business/) that every later skill
  reads: vision, users, business rules, flows, glossary seed, open questions.
  Triggers on: start a product, new project docs, business logic, requirements, know everything first.
---

# Product Docs (business logic first — know everything before building anything)

The order of everything: **product-docs → domain-modeling → architecture
(frontend-architecture / backend-architecture) → the TDD pipelines.** Nothing downstream
starts without docs/business/ — architecting from a verbal description is how undecided
logic ends up designed by an unattended run.

## When to Use

- Starting a new product, service, or app
- A major feature whose business rules aren't written anywhere
- An existing project with no docs/business/ (retrofit before the next big feature)

## Process

### 0. Existing documentation intake (ALWAYS first)

Ask the human: **does documentation already exist anywhere?** Confluence pages, Word/PDF
specs, old READMEs, tickets, a legacy app's help pages, spreadsheets, emails from the
business — anything. Two paths:

- **Documentation exists** → get it (attached files, connected folders, pasted links),
  READ all of it, and EXTRACT the business logic into the docs/business/ structure below:
  every stated rule becomes a numbered BR-n with its source cited; contradictions between
  sources become open questions; gaps become grilling topics. Then UPDATE the
  documentation — docs/business/ is the reconciled, current truth, and the human is told
  which old statements were superseded. The grilling (step 1) then covers ONLY the gaps
  and contradictions, not ground the documents already decide.
- **No documentation at all** → ask the human for their PROMPT: what they want to build/
  change, in their own words, however rough. That prompt is the seed. From it, use
  grilling (one question at a time, recommendation first) and llm-council (for the
  contested/structural calls) to iterate toward correct business logic — the goal is to
  get the HUMAN to a good result, not to fill a template: challenge vague terms, surface
  edge cases they haven't considered, and council the decisions that will be expensive to
  reverse. The full grilling of step 1 applies.

### 1. Grill the business logic out of the human (/grill-with-docs)

One question at a time, recommendation first, walking these areas until each is either
DECIDED or an explicit open question with an owner:

- **Vision**: what is this, for whom, what problem, what does success look like
- **Users & roles**: who acts in the system, what each may see and do
- **Business rules**: the invariants — what must always/never be true, per entity and per
  flow; edge cases (empty, concurrent, permission-denied, partial failure) asked explicitly
- **Flows**: each user journey step by step — inputs, decisions, outcomes, failure paths
- **Data**: what the business considers an entity, its lifecycle states and transitions
  (the seed domain-modeling formalizes)
- **Integrations**: external systems, what's read/written, what happens when they're down
- **Non-functional reality**: volumes, latency expectations, audit/compliance needs —
  only what the business actually requires (YAGNI applies to requirements too)

If reference material exists (old app, spreadsheets, competitor, regulation), READ it
during the grilling — grill-with-docs means questions grounded in documents, not vibes.

### 2. Council the contested rules (/llm-council)

Any rule where the human hesitated, reversed, or said "I think" — plus the calls with
architecture consequences (multi-tenancy, permissions model, offline behavior, money/time
handling) — go through the council before being written as DECIDED.

### 3. Write docs/business/

In the repo that owns the product (frontend or backend — the other links to it):

```
docs/business/
  overview.md        vision, users/roles, success criteria
  business-rules.md  numbered rules (BR-1, BR-2, …), each: statement, rationale,
                     edge cases, DECIDED/OPEN + how decided (grilled/councilled)
  user-flows.md      one section per flow: steps, decision points, failure paths,
                     which BR-numbers govern each step
  glossary.md        term seed for domain-modeling — every noun the business uses,
                     one meaning each (same-concept-same-word starts HERE)
  integrations.md    external systems, contracts direction, failure behavior
  open-questions.md  each: question, owner, what it blocks
```

Rules are NUMBERED because everything downstream cites them: domain-modeling maps BR-n to
invariants, architecture records cite BR-n per endpoint/screen, STEP-0 tests name the BR-n
they prove, review findings reference the BR-n violated.

### 4. Keep it alive

A business-rule change is a documented event: amend the BR (grill it), then walk the
citation trail (domain model → architecture records → tests) — the same blast-radius
discipline as code. Docs that drift from decisions are worse than no docs.

## Definition of done

- Every area either DECIDED (with how) or in open-questions.md with an owner
- Rules numbered; flows cite rules; glossary has one meaning per term
- The human has read the docs and confirmed they match their head — the docs are now the
  truth, and downstream skills read THEM, not the conversation history
