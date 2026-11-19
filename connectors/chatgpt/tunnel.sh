#!/usr/bin/env bash
# Expose the carousel server to ChatGPT / Claude.ai web over HTTPS.
#
#   ./tunnel.sh                       # random trycloudflare URL (no account)
#   ./tunnel.sh carousel.example.com  # named tunnel via `cloudflared tunnel run`
#   PORT=8765 TOKEN=... ./tunnel.sh
#
# Requires cloudflared (brew install cloudflared | apt install cloudflared).
set -euo pipefail

PORT="${PORT:-8765}"
TOKEN="${OMNI_AUTH_TOKEN:-}"
HOSTNAME_ARG="${1:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found. Install it: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" >&2
  exit 1
fi

if [[ -z "$TOKEN" ]]; then
  TOKEN="$(node -e 'console.log(require("crypto").randomBytes(24).toString("base64url"))')"
  echo "No OMNI_AUTH_TOKEN set — generated one for this session:"
  echo "  $TOKEN"
fi

echo "Building the workspace..."
(cd "$REPO_ROOT" && npm run build --silent)

echo "Starting the MCP HTTP server on 127.0.0.1:${PORT} (bearer auth required)..."
OMNI_AUTH_TOKEN="$TOKEN" OMNI_SIGNING_SECRET="$TOKEN" \
  node "$REPO_ROOT/mcp-server/typescript/dist/index.js" \
    --http --host 127.0.0.1 --port "$PORT" --token "$TOKEN" \
  >/tmp/omni-carousel-mcp.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

sleep 1.5

if [[ -n "$HOSTNAME_ARG" ]]; then
  echo "Tunnelling ${HOSTNAME_ARG} -> http://127.0.0.1:${PORT}"
  cloudflared tunnel --hostname "$HOSTNAME_ARG" --url "http://127.0.0.1:${PORT}"
else
  echo "Opening a temporary public tunnel..."
  cloudflared tunnel --url "http://127.0.0.1:${PORT}"
fi

echo
echo "When the URL appears above, register it in the host:"
echo "  MCP endpoint : https://<tunnel-host>/mcp"
echo "  Auth header  : Authorization: Bearer ${TOKEN}"
echo
echo "Server log: /tmp/omni-carousel-mcp.log"
