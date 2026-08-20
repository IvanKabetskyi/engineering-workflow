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
/plugin marketplace add ivankabetskyi/engineering-workflow

/plugin install engineering-workflow-full@ivankabetskyi       # everything (fullstack)
/plugin install engineering-workflow-frontend@ivankabetskyi   # FE pipeline + scaffolder + migration
/plugin install engineering-workflow-backend@ivankabetskyi    # BE pipeline + scaffolder
/plugin install engineering-workflow-analyst@ivankabetskyi    # product-docs, domain-modeling, architectures
```

The dev plugins deliberately exclude product-docs — business docs are the ANALYST
plugin's artifact; /new-feature's first gate tells devs to involve their analyst rather
than invent business rules.

The two scaffolding CLIs are standalone tools and also run via npx (no plugin needed):

```
npx --package=github:ivankabetskyi/engineering-workflow create-frontend-project my-app --ui=joy --data=axios
npx --package=github:ivankabetskyi/engineering-workflow create-backend-project my-service --db=mongo --sockets
```

Maintainers: `plugin/` is the master; edit there, then `node scripts/build-plugins.mjs`
regenerates `plugins/{full,frontend,backend,analyst}` and marketplace.json — commit both.

## What's inside

**Commands** (`plugin/commands/`): the four orchestrators above — thin conductors that
check gates, invoke skills, and keep the state file. **Agent**: a read-only `reviewer`
(review purity: it cannot edit, so it can never "just fix it"). **Skills**
(`plugin/skills/`, 14):

| Area | Skills |
|---|---|
| Front door | product-docs, domain-modeling |
| Design | frontend-architecture, backend-architecture |
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
grill-with-docs, to-spec, to-tickets.

## The rules that make it work

1. Artifacts gate phases; stub artifacts are prohibited (a fake record is worse than none).
2. Overrides are legal but LOGGED — visible skip beats silent skip.
3. Tests are written first, from the record, and must fail before implementation.
4. Review runs in a fresh context (or the reviewer agent) — never the session that wrote
   the code. Gate violations are Critical. The human is the final PASS.
5. The AI never runs `git commit`.

## License

MIT
