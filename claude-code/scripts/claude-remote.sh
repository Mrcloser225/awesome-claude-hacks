#!/usr/bin/env bash
#
# claude-remote.sh
# HTTP server that accepts prompt requests and runs them through Claude Code.
# Lets you trigger Claude from anywhere: mobile, CI, cron, Slack webhooks.
#
# Usage:
#   export CLAUDE_REMOTE_TOKEN="your-secret-token"
#   claude-remote.sh [working-dir]
#
#   working-dir defaults to $PWD.
#
# Environment:
#   CLAUDE_REMOTE_TOKEN   Required. Shared secret. Clients send it as
#                         "Authorization: Bearer <token>".
#   CLAUDE_REMOTE_PORT    TCP port to listen on. Default: 7337.
#   CLAUDE_REMOTE_TIMEOUT Max seconds Claude may run per request. Default: 120.
#   CLAUDE_REMOTE_LOG     Log file path. Default: ~/.claude-remote.log.
#
# API:
#   GET  /health           Returns {"status":"ok"} with the server uptime.
#   POST /run              Run a prompt. Body: JSON {"prompt":"...", "dir":"..."}
#                          "dir" is optional; defaults to the server's working-dir.
#                          Response: {"output":"...", "error":null, "exit_code":0}
#
# Quick test (run in a second terminal):
#   curl -s -X POST http://localhost:7337/run \
#     -H "Authorization: Bearer $CLAUDE_REMOTE_TOKEN" \
#     -H "Content-Type: application/json" \
#     -d '{"prompt":"What files are in the current directory?"}' | jq
#
# iOS Shortcuts:
#   Use the "Get Contents of URL" action with method POST, JSON body, and the
#   Authorization header. Save the server URL as a text shortcut for quick access.
#
# Security notes:
#   - Always set CLAUDE_REMOTE_TOKEN. Requests without a valid token get 401.
#   - Bind to 127.0.0.1 when running locally; use a reverse proxy for internet exposure.
#   - The "dir" field is validated to be an absolute path that already exists.
#   - Claude runs with the same OS permissions as the server process.

set -euo pipefail

WORKING_DIR="${1:-$(pwd)}"
WORKING_DIR="$(cd "$WORKING_DIR" && pwd)"

: "${CLAUDE_REMOTE_TOKEN:?CLAUDE_REMOTE_TOKEN must be set}"
: "${CLAUDE_REMOTE_PORT:=7337}"
: "${CLAUDE_REMOTE_TIMEOUT:=120}"
: "${CLAUDE_REMOTE_LOG:=${HOME}/.claude-remote.log}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 is required" >&2
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "error: 'claude' CLI is required and must be on PATH" >&2
  exit 1
fi

GREEN='\033[0;32m'
NC='\033[0m'
echo -e "${GREEN}[claude-remote]${NC} listening on port ${CLAUDE_REMOTE_PORT}"
echo -e "${GREEN}[claude-remote]${NC} working dir: ${WORKING_DIR}"
echo -e "${GREEN}[claude-remote]${NC} log: ${CLAUDE_REMOTE_LOG}"
echo ""
echo "Test with:"
echo "  curl -s -X POST http://localhost:${CLAUDE_REMOTE_PORT}/run \\"
echo "    -H \"Authorization: Bearer \$CLAUDE_REMOTE_TOKEN\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"prompt\":\"list files in current dir\"}' | jq"
echo ""

exec python3 - \
  "$WORKING_DIR" \
  "$CLAUDE_REMOTE_TOKEN" \
  "$CLAUDE_REMOTE_PORT" \
  "$CLAUDE_REMOTE_TIMEOUT" \
  "$CLAUDE_REMOTE_LOG" \
<<'PYTHON'
import sys
import http.server
import subprocess
import json
import os
import time
import traceback
from datetime import datetime, timezone

working_dir, token, port_str, timeout_str, log_path = sys.argv[1:6]
port    = int(port_str)
timeout = int(timeout_str)
start_ts = time.time()

def log(msg):
    line = f"[{datetime.now(timezone.utc).isoformat()}] {msg}"
    print(line, flush=True)
    try:
        with open(log_path, "a") as f:
            f.write(line + "\n")
    except OSError:
        pass

class Handler(http.server.BaseHTTPRequestHandler):

    def _auth(self):
        auth = self.headers.get("Authorization", "")
        return auth == f"Bearer {token}"

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {
                "status": "ok",
                "uptime_seconds": round(time.time() - start_ts),
                "working_dir": working_dir,
            })
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if not self._auth():
            self._json(401, {"error": "unauthorized"})
            return

        if self.path != "/run":
            self._json(404, {"error": "not found"})
            return

        length = int(self.headers.get("Content-Length", 0))
        if length > 1_000_000:
            self._json(413, {"error": "request too large"})
            return

        try:
            body = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, ValueError):
            self._json(400, {"error": "invalid JSON"})
            return

        prompt = body.get("prompt", "").strip()
        if not prompt:
            self._json(400, {"error": "prompt is required"})
            return

        run_dir = body.get("dir", "").strip() or working_dir
        # Validate: must be absolute and must exist
        if not os.path.isabs(run_dir) or not os.path.isdir(run_dir):
            self._json(400, {"error": f"dir must be an absolute path to an existing directory: {run_dir}"})
            return

        log(f"POST /run dir={run_dir} prompt_len={len(prompt)}")

        try:
            result = subprocess.run(
                ["claude", "--print", prompt],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=run_dir,
            )
            response = {
                "output": result.stdout,
                "error": result.stderr if result.returncode != 0 else None,
                "exit_code": result.returncode,
            }
            log(f"done exit_code={result.returncode}")
            self._json(200, response)

        except subprocess.TimeoutExpired:
            log(f"timeout after {timeout}s")
            self._json(504, {"error": f"claude timed out after {timeout}s"})

        except Exception:
            tb = traceback.format_exc()
            log(f"internal error: {tb}")
            self._json(500, {"error": "internal server error"})

    def log_message(self, fmt, *args):
        pass  # handled by log() above

server = http.server.HTTPServer(("0.0.0.0", port), Handler)
log(f"started on port {port}, working_dir={working_dir}")
try:
    server.serve_forever()
except KeyboardInterrupt:
    log("shutting down")
PYTHON
