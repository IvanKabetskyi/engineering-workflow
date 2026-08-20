# Runnable check battery (Pass 1) + detector loops

Run from the repo root. Every hit is a finding candidate — verify before reporting (a hit
inside a test fixture or a justified disable is not a finding). Severity per line.

## Canon violations

```bash
# FastField is banned (rule 23/28 reversal)                                  → Major
grep -rn "FastField" src/

# comment blocks (naming explains; eslint-disable needs justification)       → Minor
grep -rnE "^\s*//[^/]" src/ --include="*.ts" --include="*.tsx" | grep -v "eslint-disable"

# import depth: three or more ../                                            → Major
grep -rn "\.\./\.\./\.\./" src/

# raw string field names in Formik                                           → Major
grep -rnE '<Field[^>]+name="' src/
grep -rnE "useField\(['\"]" src/

# snapshots are banned                                                       → Major
grep -rn "toMatchSnapshot\|toMatchInlineSnapshot" src/

# wrong mock seam in tests                                                   → Major
grep -rn "jest.mock('@apollo\|vi.mock('@apollo\|MockedProvider" src/
grep -rn "jest.mock('axios'\|vi.mock('axios'\|axios-mock-adapter" src/

# component shape                                                            → Minor
grep -rnE "^export default function [A-Z]" src/
grep -rn "interface OwnProps" src/

# console.log (warn/error allowed)                                           → Major
grep -rn "console\.log" src/

# hardcoded hex outside the theme                                            → Major (design)
grep -rnE "#[0-9a-fA-F]{3,8}\b" src/ --include="*.tsx" | grep -v "core/theme"

# leftover focus/skip in tests                                               → Critical
grep -rn "\.only(\|\.skip(\|fdescribe\|fit(" src/ --include="*.test.*"

# sequential setValue loops (batch writes rule)                              → Major
grep -rnB2 -A2 "forEach.*setValue\|map.*setValue" src/

# context used as store                                                      → Major
grep -rn "createContext" src/ | grep -viv "theme\|intl\|router"
```

## Structure / gate detectors

```bash
# NEW files in shared roots this diff (gate: needs consumer map + approval)  → Critical if ungated
git diff --name-only --diff-filter=A <base>.. | grep -E "^src/(components/(ui|form|common)|requests|hooks|core)/"

# blast radius per touched shared file (no-graph fallback for Pass 0)
for f in $(git diff --name-only <base>.. | grep -E "^src/(components/(ui|form|common)|requests|hooks|core)/"); do
  name=$(basename $(dirname "$f")); echo "== $name consumers:"; grep -rln "$name" src/ | grep -v "$(dirname "$f")"
done

# files over 200 lines (changed files only in pipeline mode)                 → Minor
git diff --name-only <base>.. | grep -E "\.(ts|tsx)$" | xargs wc -l 2>/dev/null | awk '$1>200'

# owner-folder breach: requests/hooks/mappers/data/utils under a folder with no index.tsx → Major
find src -type d \( -name requests -o -name hooks -o -name mappers -o -name data -o -name utils \) \
  | while read d; do parent=$(dirname "$d"); \
    [ -f "$parent/index.tsx" ] || [[ "$parent" =~ (^src|pages/[^/]+)$ ]] || echo "MISPLACED: $d"; done

# dead exports in changed files (quick form)                                  → Minor
# for each export in the diff, grep src for an import of it; zero hits = dead
```

## Graph queries (Pass 0, when the graphify MCP is registered)

- `graph_stats` — compare node/edge counts with the last review report.
- `god_nodes` — intersect with the diff; any touched god node ⇒ full blast-radius read.
- `get_neighbors(<changed shared module>)` — the definitive consumer list.
- `get_community(<changed area>)` — look for parallel implementations of the same concept
  (two components/mappers/hooks with near-identical neighbor sets ⇒ duplicate candidate).
- `shortest_path(pageA_internal, pageB_internal)` — a short path between two pages'
  internals that doesn't pass through a shared root ⇒ cross-page import breach.

## Test-integrity pass (Pass 3)

- The work report lists STEP-0 tests; `git log`/report order shows them before the impl
  (or the report states they were red first) — absent = Major.
- Diff the test files: an assertion made LOOSER in the same change that makes it pass
  (toEqual→toMatchObject, exact→toBeGreaterThan, removed expectation) = **Critical**.
- `coverage` totals vs `docs/coverage-baseline.json` (or last report) — drop = Major.
- New fixtures: typed from the request module's types, not `any`/untyped literals.

## Design-parity pass (Pass 5) — when a visual spec exists

Per changed page/component, against references/visual-spec.md + design-map.json:
labels EXACT (not "close enough"), control type (checkbox vs switch, radio vs segmented),
column order, value formatting (dates, counts, chips), error surfacing timing, empty and
loading states, modal width source (content, not the shared Modal). Screenshot comparison
happens in the human's browser (Claude-in-Chrome) when reachable; otherwise flag for the
deferred-smoke list rather than guessing.

## Old-skill detectors kept for full-audit mode

- Dead pages: on disk under `src/pages/` but absent from the Router.
- Dead components/hooks: zero importers (allowlist genuine app-wide singletons).
- Misplacement: `src/components/X` imported by exactly one page ⇒ MOVE to that page;
  zero pages ⇒ DEAD (the promotion ladder, inverted).
- Stale e2e targets: every `cy.contains('X')`/`getByText('X')` in e2e whose X exists in no
  component and no fixture.
- Interaction coverage: pages with onClick handlers whose specs contain zero `.click()`.
- Three-way sync: nav links ↔ Router routes ↔ e2e nav tests — all three change together.
