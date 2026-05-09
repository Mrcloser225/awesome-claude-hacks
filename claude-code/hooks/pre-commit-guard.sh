#!/usr/bin/env bash
#
# pre-commit-guard.sh
# Catches lint, typecheck, and test failures before they hit your branch.
#
# Install:
#   cp pre-commit-guard.sh /path/to/repo/.git/hooks/pre-commit
#   chmod +x /path/to/repo/.git/hooks/pre-commit
#
# Behavior:
#   - Detects project type (Node, Python, Go, Rust)
#   - Runs lint, typecheck, and tests for changed files only
#   - Skips quietly if no relevant files changed
#   - Exits non-zero on failure to block the commit
#
# Configurable via env vars:
#   GUARD_SKIP=1            skip the hook entirely
#   GUARD_NO_TEST=1         skip the test step
#   GUARD_NO_TYPECHECK=1    skip typechecking
#   GUARD_VERBOSE=1         verbose output

set -euo pipefail

if [[ "${GUARD_SKIP:-0}" == "1" ]]; then
  echo "pre-commit-guard: skipped via GUARD_SKIP"
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[guard]${NC} $*"; }
warn() { echo -e "${YELLOW}[guard]${NC} $*"; }
fail() { echo -e "${RED}[guard]${NC} $*" >&2; exit 1; }

CHANGED=$(git diff --cached --name-only --diff-filter=ACMR)
if [[ -z "$CHANGED" ]]; then
  log "no staged changes, nothing to check"
  exit 0
fi

run_node_checks() {
  local has_ts has_js
  has_ts=$(echo "$CHANGED" | grep -E '\.(ts|tsx)$' || true)
  has_js=$(echo "$CHANGED" | grep -E '\.(js|jsx|mjs|cjs)$' || true)

  if [[ -z "$has_ts" && -z "$has_js" ]]; then
    return 0
  fi

  local pkg_mgr="npm"
  if [[ -f "pnpm-lock.yaml" ]]; then pkg_mgr="pnpm"; fi
  if [[ -f "yarn.lock" ]]; then pkg_mgr="yarn"; fi
  if [[ -f "bun.lockb" ]]; then pkg_mgr="bun"; fi

  log "node project detected, package manager: $pkg_mgr"

  if grep -q '"lint"' package.json 2>/dev/null; then
    log "running lint..."
    $pkg_mgr run lint || fail "lint failed"
  fi

  if [[ "${GUARD_NO_TYPECHECK:-0}" != "1" ]] && [[ -n "$has_ts" ]]; then
    if grep -q '"typecheck"' package.json 2>/dev/null; then
      log "running typecheck..."
      $pkg_mgr run typecheck || fail "typecheck failed"
    elif command -v tsc >/dev/null 2>&1 && [[ -f "tsconfig.json" ]]; then
      log "running tsc --noEmit..."
      tsc --noEmit || fail "tsc failed"
    fi
  fi

  if [[ "${GUARD_NO_TEST:-0}" != "1" ]]; then
    if grep -q '"test"' package.json 2>/dev/null; then
      log "running tests..."
      $pkg_mgr test || fail "tests failed"
    fi
  fi
}

run_python_checks() {
  local has_py
  has_py=$(echo "$CHANGED" | grep -E '\.py$' || true)
  if [[ -z "$has_py" ]]; then return 0; fi

  log "python project detected"

  if command -v ruff >/dev/null 2>&1; then
    log "running ruff..."
    ruff check $has_py || fail "ruff failed"
  elif command -v flake8 >/dev/null 2>&1; then
    log "running flake8..."
    flake8 $has_py || fail "flake8 failed"
  fi

  if [[ "${GUARD_NO_TYPECHECK:-0}" != "1" ]] && command -v mypy >/dev/null 2>&1; then
    if [[ -f "mypy.ini" || -f "pyproject.toml" ]]; then
      log "running mypy..."
      mypy $has_py || fail "mypy failed"
    fi
  fi

  if [[ "${GUARD_NO_TEST:-0}" != "1" ]] && command -v pytest >/dev/null 2>&1; then
    if [[ -d "tests" || -d "test" ]]; then
      log "running pytest..."
      pytest -x --tb=short || fail "pytest failed"
    fi
  fi
}

run_go_checks() {
  local has_go
  has_go=$(echo "$CHANGED" | grep -E '\.go$' || true)
  if [[ -z "$has_go" ]]; then return 0; fi

  log "go project detected"

  log "running go vet..."
  go vet ./... || fail "go vet failed"

  log "running gofmt check..."
  local unformatted
  unformatted=$(gofmt -l $has_go)
  if [[ -n "$unformatted" ]]; then
    fail "gofmt issues:\n$unformatted"
  fi

  if [[ "${GUARD_NO_TEST:-0}" != "1" ]]; then
    log "running go test..."
    go test ./... || fail "go test failed"
  fi
}

run_rust_checks() {
  local has_rs
  has_rs=$(echo "$CHANGED" | grep -E '\.rs$' || true)
  if [[ -z "$has_rs" ]]; then return 0; fi

  log "rust project detected"

  log "running cargo check..."
  cargo check --quiet || fail "cargo check failed"

  if command -v cargo-clippy >/dev/null 2>&1 || cargo clippy --version >/dev/null 2>&1; then
    log "running clippy..."
    cargo clippy --quiet -- -D warnings || fail "clippy failed"
  fi

  if [[ "${GUARD_NO_TEST:-0}" != "1" ]]; then
    log "running cargo test..."
    cargo test --quiet || fail "cargo test failed"
  fi
}

if [[ -f "package.json" ]]; then run_node_checks; fi
if [[ -f "pyproject.toml" || -f "setup.py" || -f "requirements.txt" ]]; then run_python_checks; fi
if [[ -f "go.mod" ]]; then run_go_checks; fi
if [[ -f "Cargo.toml" ]]; then run_rust_checks; fi

log "all checks passed, commit allowed"
exit 0
