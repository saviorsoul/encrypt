#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DISCORD_WEBHOOK_URL:-}" ]]; then
  echo "DISCORD_WEBHOOK_URL not set; skipping Discord notification."
  exit 0
fi

title="${1:?title required}"
description="${2:-}"
color="${3:-5793266}"
footer="${4:-GitHub Actions}"

payload="$(jq -n \
  --arg title "$title" \
  --arg description "$description" \
  --argjson color "$color" \
  --arg footer "$footer" \
  '{
    embeds: [{
      title: $title,
      description: $description,
      color: $color,
      footer: { text: $footer },
      timestamp: (now | strftime("%Y-%m-%dT%H:%M:%SZ"))
    }]
  }')"

curl -fsS -X POST "$DISCORD_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$payload"
