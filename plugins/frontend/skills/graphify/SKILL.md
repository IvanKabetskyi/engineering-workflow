---
name: graphify
description: >
  Use a graphify code graph to understand a repo: install, build the graph locally
  (AST-only, deterministic), register the MCP so sessions query the graph instead of
  reading raw files, and use it for inventories, blast radius, and duplicate detection.
  Team-sharing models are suggestions — pick per team.
  Triggers on: code graph, graphify, blast radius, whole picture of the repo, god nodes.
---

# graphify (code graph for sessions)

graphify (PyPI package `graphifyy`, Python 3.10+) builds a knowledge graph of a codebase.
In this workflow it powers: migration-planner Phase 2 (source inventory), code-review
Pass 0 (blast radius via neighbors, duplicates via communities, hotspots via god nodes),
and any "give me the whole picture" question — WITHOUT loading a multi-MB graph.json into
context.

## Install (once per machine)

- Windows: install real Python first (`winget install Python.Python.3.11`, NEW terminal —
  the Store `python` stub is not Python), then `py -m pip install graphifyy`. If
  `graphify` isn't recognized, add Python's Scripts folder to the user PATH or use
  `py -m graphify`.
- macOS/Linux: `pipx install graphifyy`.

## Build the graph (per repo, local only)

```
graphify extract . --code-only     # AST-only: deterministic, no LLM, no API key
```

Output lands in `graphify-out/` (graph.json + GRAPH_REPORT.md + graph.html).
**Add `graphify-out/` to .gitignore** — the graph is a local derived artifact; never commit
it, never put it in `dist/`. Refresh after big changes with `graphify extract . --code-only
--update` (incremental).

## Register the MCP (per repo — this is how sessions actually use it)

`.mcp.json` in the repo root (committable):

```json
{
  "mcpServers": {
    "graphify": {
      "type": "stdio",
      "command": "py",
      "args": ["-m", "graphify.serve", "graphify-out/graph.json"]
    }
  }
}
```

(`python3 -m graphify.serve ...` on macOS/Linux.) Tools exposed: `query_graph`,
`get_node`, `get_neighbors`, `shortest_path`, `get_community`, `god_nodes`, `graph_stats`
(+ GitHub PR-impact tools). If graphify isn't installed the MCP just fails to connect and
sessions keep working — the graph is an accelerator, never a blocker.

## How sessions use it

- **Inventory/understanding**: `graph_stats` + `god_nodes` + `get_community` before
  planning work in an unfamiliar area.
- **Blast radius**: `get_neighbors(<shared module>)` = the definitive consumer list for
  the Shared/Global Change Gate and review Pass 0.
- **Duplicates**: near-identical neighbor sets in a community ⇒ parallel implementations
  of the same concept.
- **Structure smells**: a short `shortest_path` between two pages' internals that skips
  the shared roots ⇒ cross-page import breach.

## Team sharing — SUGGESTIONS, pick per team (not prescribed by this skill)

- **Single developer / small team (default)**: everyone extracts locally and refreshes
  with `--update`. Zero infrastructure; graphs may drift between machines — acceptable.
- **Shared source of truth**: ONE writer (a CI job on merges to the main branch) builds
  the graph and stores it somewhere the team can read (an internal DB or file share);
  laptops pull it and apply `--update` for their branch delta. Avoids N-writers merge
  churn. Requires infra your team must choose and own — this skill deliberately ships no
  CI config or database code.
- **Committed graph** (graphify's own README model): possible, but weigh merge conflicts
  and repo bloat before adopting; not recommended for multi-writer teams.

Verify determinism before any shared model: extract twice at the same commit on two
machines and diff `graph.json` — identical or investigate first.
