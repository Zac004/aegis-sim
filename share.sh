#!/usr/bin/env bash
# ============================================================================
#  share.sh — put Aegis-Sim online with a public link in ~1 minute.
#
#  Run it:   ./share.sh
#
#  It (1) downloads Cloudflare's official tunnel tool the first time (into
#  ./.tools, nothing installed system-wide), (2) starts the Aegis server, and
#  (3) prints a public https://<random>.trycloudflare.com link you can send to
#  friends. The link is live only while this script is running — press Ctrl+C
#  to take it offline. No account, no card, no config.
# ============================================================================
set -e
cd "$(dirname "$0")"

PORT="${AEGIS_PORT:-8765}"
TOOLS=".tools"
CF="$TOOLS/cloudflared"

# ── 1. fetch cloudflared (official Cloudflare release) if we don't have it ──
if [ ! -x "$CF" ]; then
  mkdir -p "$TOOLS"
  case "$(uname -m)" in
    arm64|aarch64) ARCH="arm64" ;;
    x86_64|amd64)  ARCH="amd64" ;;
    *) echo "Unsupported CPU arch: $(uname -m)"; exit 1 ;;
  esac
  URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-${ARCH}.tgz"
  echo "→ First run: downloading Cloudflare tunnel tool (~20 MB) from"
  echo "  $URL"
  curl -fL# -o "$TOOLS/cf.tgz" "$URL"
  tar xzf "$TOOLS/cf.tgz" -C "$TOOLS"
  rm -f "$TOOLS/cf.tgz"
  chmod +x "$CF"
  echo "✓ tunnel tool ready ($("$CF" --version 2>/dev/null | head -1))"
fi

# ── 2. start the Aegis server (unless something is already on the port) ────
SERVER_PID=""
if curl -s -o /dev/null "http://127.0.0.1:${PORT}/" 2>/dev/null; then
  echo "→ app already running on port ${PORT}, reusing it"
else
  echo "→ starting Aegis-Sim on port ${PORT}"
  python3 run.py --no-browser --port "${PORT}" > "$TOOLS/server.log" 2>&1 &
  SERVER_PID=$!
  for i in $(seq 1 30); do
    curl -s -o /dev/null "http://127.0.0.1:${PORT}/" 2>/dev/null && break
    sleep 0.5
  done
fi

# ── 3. clean shutdown on Ctrl+C ────────────────────────────────────────────
cleanup() {
  echo; echo "→ taking the link offline…"
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  [ -n "$CF_PID" ]     && kill "$CF_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# ── 4. open the tunnel and surface the public URL ──────────────────────────
echo "→ opening public tunnel…"
"$CF" tunnel --url "http://localhost:${PORT}" > "$TOOLS/tunnel.log" 2>&1 &
CF_PID=$!

URL=""
for i in $(seq 1 40); do
  URL=$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$TOOLS/tunnel.log" 2>/dev/null | head -1)
  [ -n "$URL" ] && break
  sleep 0.5
done

echo
if [ -n "$URL" ]; then
  echo "==================================================================="
  echo "  ✅  AEGIS-SIM IS LIVE — send friends this link:"
  echo
  echo "        $URL"
  echo
  echo "  Keep this window open. Press Ctrl+C to take it offline."
  echo "==================================================================="
else
  echo "⚠  Couldn't read the tunnel URL. Check $TOOLS/tunnel.log for the"
  echo "   'https://….trycloudflare.com' address."
fi

# keep running until the user stops it
wait "$CF_PID"
