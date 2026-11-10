#!/bin/sh
# Installs autoprint as a systemd user service so it starts at login and restarts on crash.
# Settings are read from config.json (created on first install, see config.example.json).
# Usage: ./install-linux.sh      (uninstall: ./install-linux.sh --uninstall)
set -e

SERVICE=snake-label-autoprint
UNIT="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/$SERVICE.service"

if ! command -v systemctl >/dev/null 2>&1; then
    echo "systemd not found. Start autoprint.js with your init system or desktop autostart instead." >&2
    exit 1
fi

systemctl --user disable --now "$SERVICE" 2>/dev/null || true

if [ "$1" = "--uninstall" ]; then
    rm -f "$UNIT"
    systemctl --user daemon-reload
    echo "Uninstalled."
    exit 0
fi

. "$(dirname "$0")/install-common.sh"

mkdir -p "$(dirname "$UNIT")"
cat > "$UNIT" <<EOF
[Unit]
Description=snake-label autoprint (prints new label PDFs)
After=network-online.target

[Service]
ExecStart="$NODE" "$DIR/autoprint.js"
WorkingDirectory=$DIR
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "$SERVICE"
echo "Installed. Log: journalctl --user -u $SERVICE -f"
echo "To keep it running without an open session: sudo loginctl enable-linger $USER"
