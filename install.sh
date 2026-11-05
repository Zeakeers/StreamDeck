#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

chmod +x bin/player.js bin/streamdeck.js

DEFAULT_URL="${STREAMDECK_SERVER:-http://localhost:3000}"
SERVER_URL="$1"

if [ -z "$SERVER_URL" ]; then
  if [ -t 0 ]; then
    read -rp "Enter StreamDeck Server URL [$DEFAULT_URL]: " input_url
    SERVER_URL="${input_url:-$DEFAULT_URL}"
  else
    SERVER_URL="$DEFAULT_URL"
  fi
fi

echo "Target Server URL: $SERVER_URL"

echo "Installing dependencies..."
npm install

echo "Linking global commands..."
npm link

# Pre-sync audio files right during installation so user has zero lag
echo ""
echo "Pre-syncing media assets from server ($SERVER_URL)..."
node bin/player.js "$SERVER_URL" --sync-only || true

# Install systemd user service unit (inactive by default)
if command -v systemctl >/dev/null 2>&1; then
  SERVICE_DIR="$HOME/.config/systemd/user"
  mkdir -p "$SERVICE_DIR"
  cat <<EOF > "$SERVICE_DIR/streamdeck-player.service"
[Unit]
Description=StreamDeck Local Audio Player Daemon
After=network.target sound.target

[Service]
Type=simple
WorkingDirectory=$DIR
Environment="STREAMDECK_SERVER=$SERVER_URL"
ExecStart=$(command -v node) $DIR/bin/player.js "$SERVER_URL"
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

  systemctl --user daemon-reload
fi

echo ""
echo "=================================================="
echo " Installation Complete"
echo " Global commands: 'streamdeck' and 'streamdeck-player'"
echo "=================================================="
echo "How to start local audio player:"
echo ""
echo "1. Run in foreground (terminal):"
echo "   streamdeck-player"
echo "   (or with custom URL: streamdeck-player http://ip:port)"
echo ""
if command -v systemctl >/dev/null 2>&1; then
echo "2. Run as background service (manual start):"
echo "   systemctl --user start streamdeck-player"
echo ""
echo "3. Enable auto-start on boot (optional):"
echo "   systemctl --user enable --now streamdeck-player"
echo ""
echo "Check service status / logs:"
echo "   systemctl --user status streamdeck-player"
echo "   journalctl --user -u streamdeck-player -f"
fi
echo "=================================================="
