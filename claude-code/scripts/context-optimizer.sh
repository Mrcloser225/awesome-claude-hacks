#!/usr/bin/env bash
#
# context-optimizer.sh
# Reports on the largest text files in a project so you can decide what to
# exclude from Claude Code context. Generates a recommended .claudeignore.
#
# Usage:
#   context-optimizer.sh [project-dir]
#
# Output:
#   prints a ranked list of fat files
#   writes .claudeignore.suggested to the project root
#

set -euo pipefail

TARGET="${1:-$(pwd)}"
TARGET="$(cd "$TARGET" && pwd)"
SUGGEST="$TARGET/.claudeignore.suggested"

GREEN='\033[0;32m'
NC='\033[0m'
log() { echo -e "${GREEN}[ctx]${NC} $*" >&2; }

cd "$TARGET"

# Always-ignore patterns
COMMON_IGNORES=(
  "node_modules/"
  "dist/"
  "build/"
  "out/"
  ".next/"
  ".turbo/"
  ".vercel/"
  ".cache/"
  "coverage/"
  "*.log"
  "*.lock"
  "*.lockb"
  "package-lock.json"
  "pnpm-lock.yaml"
  "yarn.lock"
  "bun.lockb"
  "*.min.js"
  "*.min.css"
  "*.map"
  "vendor/"
  "__pycache__/"
  ".venv/"
  "venv/"
  ".tox/"
  ".pytest_cache/"
  ".mypy_cache/"
  ".ruff_cache/"
  "target/"
  "*.tsbuildinfo"
  ".DS_Store"
  "*.png"
  "*.jpg"
  "*.jpeg"
  "*.gif"
  "*.webp"
  "*.svg"
  "*.pdf"
  "*.zip"
  "*.tar.gz"
)

log "scanning largest tracked files..."

# Find the largest text-y files outside the common ignores
EXCLUDES=()
for p in node_modules dist build out .next .turbo .vercel .cache coverage vendor __pycache__ .venv venv target .git; do
  EXCLUDES+=(-not -path "./$p/*" -not -path "./$p")
done

mapfile -t FAT < <(find . -type f \
  "${EXCLUDES[@]}" \
  -size +50k \
  -printf '%s\t%p\n' 2>/dev/null \
  | sort -rn | head -30)

if [[ ${#FAT[@]} -eq 0 ]]; then
  log "no fat files found"
else
  echo
  echo "Top fat files in this project (size in bytes):"
  echo "------------------------------------------------"
  printf '%s\n' "${FAT[@]}" | awk -F'\t' '{ printf "%10d  %s\n", $1, $2 }'
  echo
fi

# Suggest extra ignores based on what we saw
SUGGESTED_EXTRA=()
for line in "${FAT[@]}"; do
  path="${line#*$'\t'}"
  ext="${path##*.}"
  case "$ext" in
    json)
      # huge JSON often means a fixture or generated file
      SUGGESTED_EXTRA+=("$path")
      ;;
    csv|tsv|parquet|sqlite|db)
      SUGGESTED_EXTRA+=("$path")
      ;;
    *)
      ;;
  esac
done

{
  echo "# .claudeignore (suggested by context-optimizer.sh)"
  echo "# Generated $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "# Move to .claudeignore once reviewed"
  echo
  echo "# Common ignores"
  for p in "${COMMON_IGNORES[@]}"; do
    echo "$p"
  done
  if [[ ${#SUGGESTED_EXTRA[@]} -gt 0 ]]; then
    echo
    echo "# Heavy files spotted by the scanner"
    for p in "${SUGGESTED_EXTRA[@]}"; do
      echo "$p"
    done
  fi
} > "$SUGGEST"

log "wrote $SUGGEST"
log "review and move to .claudeignore when ready"
