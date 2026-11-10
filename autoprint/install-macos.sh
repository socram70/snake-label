#!/bin/sh
# Installs autoprint as a LaunchAgent so it starts at login and restarts on crash.
# Settings are read from config.json (created on first install, see config.example.json).
# Usage: ./install-macos.sh      (uninstall: ./install-macos.sh --uninstall)
set -e

LABEL=de.snake-label.autoprint
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/snake-label-autoprint.log"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true

if [ "$1" = "--uninstall" ]; then
    rm -f "$PLIST"
    echo "Uninstalled."
    exit 0
fi

. "$(dirname "$0")/install-common.sh"

mkdir -p "$(dirname "$PLIST")"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE</string>
        <string>$DIR/autoprint.js</string>
    </array>
    <key>WorkingDirectory</key><string>$DIR</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>$LOG</string>
    <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF

launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed. Log: $LOG"
echo "macOS may ask to allow node access to the Downloads folder and the local network."
