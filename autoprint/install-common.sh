# Shared steps for install-macos.sh and install-linux.sh (sourced, not executed).
# Sets DIR and NODE, installs dependencies and creates config.json if missing.

DIR="$(cd "$(dirname "$0")" && pwd)"

NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
    echo "Node.js not found. Install Node.js 20 or newer first: https://nodejs.org" >&2
    exit 1
fi
if [ "$("$NODE" -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
    echo "Node.js $("$NODE" --version) is too old, version 20 or newer is required." >&2
    exit 1
fi

echo "Installing dependencies..."
(cd "$DIR" && npm install --omit=dev --no-fund --no-audit)

if [ ! -f "$DIR/config.json" ]; then
    printf "brother_ql_web URL [http://localhost:8013]: "
    read -r PRINTER_URL
    PRINTER_URL="${PRINTER_URL:-http://localhost:8013}"
    printf "Folder to watch [~/Downloads]: "
    read -r WATCH_DIR
    WATCH_DIR="${WATCH_DIR:-~/Downloads}"
    PRINTER_URL="$PRINTER_URL" WATCH_DIR="$WATCH_DIR" "$NODE" -e '
        const config = { printerUrl: process.env.PRINTER_URL, watchDir: process.env.WATCH_DIR, printedDir: process.env.WATCH_DIR.replace(/\/+$/, "") + "/printed" };
        require("fs").writeFileSync(process.argv[1], JSON.stringify(config, null, 4) + "\n");
    ' "$DIR/config.json"
    echo "Wrote $DIR/config.json"
fi
