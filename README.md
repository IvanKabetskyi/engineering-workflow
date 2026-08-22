# engineering-workflow

A gated AI engineering workflow for Claude Code: one install, four commands, and the
process can't be silently skipped.

```
/new-project   product-docs → domain-modeling → scaffold → first feature
/new-feature   business docs → domain → architecture record → RED tests → implement → review
/migrate       deployed-app capture → decision record → graph inventories → chunked TDD pack
/new-fix       rule → failing test → scoped fix prompt → review   (the F-loop)
```

Every phase produces a named **artifact** (business docs with numbered rules, a grilled
design record, a list of failing tests, a review report with a verdict); the next phase
refuses to start unless the artifact exists or an **override is logged** (what was skipped,
why, who approved, when) in the feature's state file. The AI never commits — the human is
the final PASS on every review and every commit.

**Session model — part by part, never one long run.** The workflow is designed for many
short sessions: the analyst produces docs + tickets in one session; each ticket then runs
in its OWN fresh session via `/new-feature` (or `/new-fix`), which reads the state file,
resumes from the recorded phase, does one phase or one ticket, updates the state, and
stops. Artifacts on disk + the state file are the memory between sessions — no session
ever needs to hold the whole workflow.

## Install (per team, through Claude — this is the only install path)

One marketplace, four role plugins. Each person adds the marketplace once and installs
their part; updates flow through the plugin system:

```
/plugin marketplace add millwright-tools/engineering-workflow

/plugin install engineering-workflow-full@ivankabetskyi       # everything (fullstack)
/plugin install engineering-workflow-frontend@ivankabetskyi   # FE pipeline + scaffolder + migration
/plugin install engineering-workflow-backend@ivankabetskyi    # BE pipeline + scaffolder
/plugin install engineering-workflow-analyst@ivankabetskyi    # product-docs, domain-modeling, architectures
```

The dev plugins deliberately exclude product-docs — business docs are the ANALYST
plugin's artifact; /new-feature's first gate tells devs to involve their analyst rather
than invent business rules.

The two scaffolding CLIs are standalone tools published on npm (no plugin, no git link):

```
npx engineering-workflow frontend my-app --ui=joy --data=axios
npx engineering-workflow backend my-service --db=mongo --sockets
```

Maintainers: `plugin/` is the master; edit there, then `node scripts/build-plugins.mjs`
regenerates `plugins/{full,frontend,backend,analyst}` and marketplace.json — commit both.


## What's inside

**Commands** (`plugin/commands/`): the four orchestrators above — thin conductors that
check gates, invoke skills, and keep the state file. **Agent**: a read-only `reviewer`
(review purity: it cannot edit, so it can never "just fix it"). **Skills**
(`plugin/skills/`, 16):

| Area | Skills |
|---|---|
| Front door | product-docs, domain-modeling |
| Design | frontend-architecture, backend-architecture |
| Tickets | ticketing (format, readiness check, size rule, chain handoff; to-tickets publishes) |
| TDD | frontend-unit-test, backend-unit-test |
| Canon | frontend-development, backend-development |
| Review | frontend-code-review, backend-code-review |
| Scaffolding | create-frontend-project, create-backend-project (CLIs in `cli/`) |
| Migration | migration-planner |
| Code graph | graphify (local extract + MCP; team sharing as suggestions, no CI/DB shipped) |

Stack canon: React 19 + Vite + TS + RTK + TanStack Query + Formik/zod (v3) + Vitest/RTL on
the frontend (MUI Joy default / Material / antd); clean-architecture Express/TS + zod +
Jest/supertest on the backend; Socket.IO with mirrored typed constants; graphify code-graph
for inventories and review blast-radius.

**Prerequisites** (personal/account skills, not bundled): grilling, llm-council,
grill-with-docs, to-spec; to-tickets is optional (tracker publishing only — ticket
creation is the bundled ticketing skill). For UI design intake, the Figma connection:
`claude plugin install figma@claude-plugins-official` (or the Figma Dev Mode local MCP).
Team usage documentation lives in Confluence.

## The rules that make it work

1. Artifacts gate phases; stub artifacts are prohibited (a fake record is worse than none).
2. Overrides are legal but LOGGED — visible skip beats silent skip.
3. Tests are written first, from the record, must fail before implementation — and must be
   able to fail (the review's mutation probe checks).
4. Review runs in a fresh context (or the reviewer agent) — never the session that wrote
   the code. Gate violations are Critical. The human is the final PASS.
5. The AI never runs `git commit`.
6. Decisions are made at ticketing, with the human present — a ticket lists the record
   sections every criterion traces to and ships with `Open: none`. Corrections amend the
   record and regenerate the ticket; they never live in the ticket.
7. Consequences are proportionate: all Critical/Major findings of one review → one fix
   prompt → one re-review; Minors → a followups file → one sweep ticket per feature. A
   Minor is never a ticket.

## Running the implement phase unattended

`/new-feature` phases 4/5 are the same loop the `chain-runner` skill automates in tmux.
Its phase prompts invoke this plugin's canon skills (`*-unit-test`, `*-development`,
`*-code-review`), park questions BEFORE any test file is written, shelve a deferred
ticket's files with `git stash`, gate every ticket on a green tree, and halt a ticket after
two red gates. The project must be a git repository with a baseline commit.

## What the MeetSpace stress test changed (0.3.0)

Three days, four chain runs, 12 green of 37: verification was 1.8% of the time; review +
fix were 53%; 7h35m traced to three questions nobody was awake to answer; the queue grew one
ticket per two shipped because Minors became tickets. 0.3.0 answers each: ticket readiness
check and size rule at ticketing; Major narrowed to BR / contract / structural-canon /
cannot-fail-test; mutation probe mandatory in review; findings batched; followups file;
recorded exemptions; numbered record sections and per-ticket extracts; Redis test isolation
and a pinned mongo binary in the scaffold; malformed ids answer 404.

## License

MIT
