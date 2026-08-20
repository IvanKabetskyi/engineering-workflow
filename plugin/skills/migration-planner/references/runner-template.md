# tmux chain runner template

One tmux session per chain; prompts run sequentially inside it via `claude -p`. Detach and
let it run overnight; reattach (`tmux attach -t <chain>`) to watch. On Windows, run under
WSL or Git Bash with tmux available.

Invariants (never remove):
- git commit/push disallowed — the AI never commits;
- skip-if-report-exists — re-running a chain never re-executes finished prompts;
- stop-on-missing-report — a prompt that ends without its report halts the chain (that is
  the STOPPED/DISCREPANCIES signal for the next human session);
- one report per prompt into `_fix_reports/`.

`run/chain.sh`:

```bash
#!/usr/bin/env bash
set -u
SESSION="${1:-migration-chain}"
SKILL=".claude/skills/<migration-name>"
SRC="<path-to-source-repo>"
WIDGETS="<path-to-widget-package-source>"
REPORTS="_fix_reports"

# ordered prompt → report pairs
PROMPTS=(
  "$SKILL/prompts/03-<name>.md:$REPORTS/03-report.md"
  "$SKILL/prompts/04-<name>.md:$REPORTS/04-report.md"
)

run_chain() {
  for pair in "${PROMPTS[@]}"; do
    prompt="${pair%%:*}"; report="${pair##*:}"
    if [ -f "$report" ]; then
      echo "SKIP (report exists): $prompt"
      continue
    fi
    echo "RUN: $prompt"
    claude -p \
      --add-dir "$SRC" --add-dir "$WIDGETS" \
      --allowedTools "Read" "Edit" "Write" "Glob" "Grep" "Bash" \
      --disallowedTools "Bash(git commit:*)" "Bash(git push:*)" \
      < "$prompt"
    if [ ! -f "$report" ]; then
      echo "STOP: $prompt produced no report ($report missing)."
      exit 1
    fi
  done
  echo "CHAIN COMPLETE"
}

if [ -n "${TMUX:-}" ] || [ "${2:-}" = "--inline" ]; then
  run_chain
else
  tmux new-session -d -s "$SESSION" "bash $0 $SESSION --inline 2>&1 | tee $REPORTS/chain-$SESSION.log"
  echo "started tmux session '$SESSION' — attach: tmux attach -t $SESSION"
fi
```

Notes:
- Each chunk/fix prompt writes its own report as its last task (the template's DoD demands
  it) — that's what the skip/stop logic keys on.
- For parallel-safe work, use one tmux WINDOW per independent chain
  (`tmux new-window -t $SESSION -n F30 "..."`), never two chains touching the same files.
- The chain log (`_fix_reports/chain-*.log`) is the audit trail for what ran when.
