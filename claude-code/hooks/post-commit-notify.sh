#!/usr/bin/env bash
#
# post-commit-notify.sh
# Sends a notification to a webhook on every commit.
# Works with Slack, Discord, Teams, generic webhooks.
#
# Install:
#   cp post-commit-notify.sh /path/to/repo/.git/hooks/post-commit
#   chmod +x /path/to/repo/.git/hooks/post-commit
#
# Configure via env or .git/notify.env:
#   NOTIFY_WEBHOOK_URL  required, the destination
#   NOTIFY_FORMAT       slack | discord | teams | generic (default: slack)
#   NOTIFY_QUIET        1 to disable notifications without uninstalling
#   NOTIFY_BRANCHES     comma-separated allowlist (default: all)

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"

if [[ -f "$REPO_ROOT/.git/notify.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.git/notify.env"
  set +a
fi

if [[ "${NOTIFY_QUIET:-0}" == "1" ]]; then
  exit 0
fi

if [[ -z "${NOTIFY_WEBHOOK_URL:-}" ]]; then
  echo "post-commit-notify: NOTIFY_WEBHOOK_URL not set, skipping"
  exit 0
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [[ -n "${NOTIFY_BRANCHES:-}" ]]; then
  if [[ ! ",$NOTIFY_BRANCHES," == *",$BRANCH,"* ]]; then
    exit 0
  fi
fi

SHA=$(git rev-parse --short HEAD)
AUTHOR=$(git log -1 --pretty=format:'%an')
MESSAGE=$(git log -1 --pretty=format:'%s')
REPO_NAME=$(basename "$REPO_ROOT")
FORMAT="${NOTIFY_FORMAT:-slack}"

build_slack_payload() {
  cat <<EOF
{
  "text": "New commit on \`$REPO_NAME\`",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*$REPO_NAME* :: \`$BRANCH\` :: \`$SHA\`\n>$MESSAGE\n_by $AUTHOR_"
      }
    }
  ]
}
EOF
}

build_discord_payload() {
  cat <<EOF
{
  "embeds": [
    {
      "title": "Commit on $REPO_NAME",
      "description": "**$BRANCH** \`$SHA\`\n$MESSAGE",
      "footer": { "text": "by $AUTHOR" },
      "color": 5814783
    }
  ]
}
EOF
}

build_teams_payload() {
  cat <<EOF
{
  "@type": "MessageCard",
  "@context": "http://schema.org/extensions",
  "summary": "Commit on $REPO_NAME",
  "title": "Commit on $REPO_NAME",
  "sections": [
    {
      "facts": [
        { "name": "Branch",  "value": "$BRANCH" },
        { "name": "SHA",     "value": "$SHA" },
        { "name": "Author",  "value": "$AUTHOR" },
        { "name": "Message", "value": "$MESSAGE" }
      ]
    }
  ]
}
EOF
}

build_generic_payload() {
  cat <<EOF
{
  "repo": "$REPO_NAME",
  "branch": "$BRANCH",
  "sha": "$SHA",
  "author": "$AUTHOR",
  "message": $(printf '%s' "$MESSAGE" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo "\"$MESSAGE\"")
}
EOF
}

case "$FORMAT" in
  slack)   PAYLOAD=$(build_slack_payload) ;;
  discord) PAYLOAD=$(build_discord_payload) ;;
  teams)   PAYLOAD=$(build_teams_payload) ;;
  generic) PAYLOAD=$(build_generic_payload) ;;
  *) echo "post-commit-notify: unknown NOTIFY_FORMAT: $FORMAT" >&2; exit 0 ;;
esac

curl -s -X POST -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "$NOTIFY_WEBHOOK_URL" >/dev/null \
  || echo "post-commit-notify: webhook delivery failed (non-fatal)"

exit 0
