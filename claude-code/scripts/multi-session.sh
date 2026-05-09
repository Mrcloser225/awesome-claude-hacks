#!/usr/bin/env bash
#
# multi-session.sh
# Orchestrates multiple Claude Code sessions in parallel, one per task.
# Useful for refactors that split cleanly across packages or files.
#
# Usage:
#   multi-session.sh tasks.txt
#
# tasks.txt format (one task per line):
#   <session-name>:<working-dir>:<prompt-file>
#
# Example tasks.txt:
#   refactor-auth:./packages/auth:./prompts/refactor-auth.md
#   refactor-db:./packages/db:./prompts/refactor-db.md
#   add-tests:./apps/web:./prompts/add-tests.md
#
# Each session runs in its own tmux pane. Logs go to .multi-session/<name>.log

set -euo pipefail

TASKS_FILE="${1:-tasks.txt}"
LOG_DIR=".multi-session"
SESSION="claude-multi-$(date +%s)"

if [[ ! -f "$TASKS_FILE" ]]; then
  echo "usage: $0 tasks.txt" >&2
  exit 1
fi

if ! command -v tmux >/dev/null 2>&1; then
  echo "error: tmux is required" >&2
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "error: 'claude' CLI is required and must be on PATH" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"

GREEN='\033[0;32m'
NC='\033[0m'
log() { echo -e "${GREEN}[multi]${NC} $*"; }

# Build a list of valid tasks
declare -a NAMES DIRS PROMPTS
while IFS=':' read -r name dir prompt || [[ -n "${name:-}" ]]; do
  [[ -z "${name// }" ]] && continue
  [[ "${name}" == \#* ]] && continue
  if [[ ! -d "$dir" ]]; then
    echo "skip: working dir not found for '$name': $dir" >&2
    continue
  fi
  if [[ ! -f "$prompt" ]]; then
    echo "skip: prompt file not found for '$name': $prompt" >&2
    continue
  fi
  NAMES+=("$name")
  DIRS+=("$dir")
  PROMPTS+=("$prompt")
done < "$TASKS_FILE"

if [[ ${#NAMES[@]} -eq 0 ]]; then
  echo "no valid tasks found in $TASKS_FILE" >&2
  exit 1
fi

log "starting tmux session '$SESSION' with ${#NAMES[@]} tasks"

tmux new-session -d -s "$SESSION" -n "${NAMES[0]}" -c "${DIRS[0]}"

for i in "${!NAMES[@]}"; do
  name="${NAMES[$i]}"
  dir="${DIRS[$i]}"
  prompt="${PROMPTS[$i]}"
  abs_prompt="$(cd "$(dirname "$prompt")" && pwd)/$(basename "$prompt")"
  log_file="$(pwd)/$LOG_DIR/${name}.log"

  if [[ "$i" -gt 0 ]]; then
    tmux new-window -t "$SESSION" -n "$name" -c "$dir"
  fi

  cmd="claude --print < '$abs_prompt' 2>&1 | tee '$log_file'"

  tmux send-keys -t "$SESSION:$name" "$cmd" C-m
  log "queued '$name' in '$dir' (log: $log_file)"
done

cat <<EOF

Multi-session started.

To attach:           tmux attach -t $SESSION
To list windows:     tmux list-windows -t $SESSION
To follow a log:     tail -f $LOG_DIR/<task-name>.log
To kill all:         tmux kill-session -t $SESSION

EOF
