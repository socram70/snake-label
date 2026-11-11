# snake-label autoprint

Watches `~/Downloads` for new stamp/parcel label PDFs, converts them with the
crop definitions from [`../src/js/labels.js`](../src/js/labels.js) (same code as the web UI)
and prints them on a Brother QL via the [brother_ql_web](https://github.com/socram70/brother_ql_web) API
— the same request the "Print" button in snake-label sends.

After a successful print the PDF is moved to `~/Downloads/printed/`.
PDFs that already exist when the watcher starts are ignored; unknown PDFs are left untouched.

## Recognized labels

| PDF                                                     | snake-label type        |
|---------------------------------------------------------|-------------------------|
| Deutsche Post Internetmarke, A4 (eBay Briefmarke)       | `dp-briefmarke-ebay`    |
| Deutsche Post Internetmarke, 62x100mm (mit Adresse)     | `dp-briefmarke-adresse` |
| Deutsche Post Internetmarke, 61x37mm (ohne Adresse)     | `dp-briefmarke`         |
| DHL Paketmarke national, A4 (eBay / DHL Online Frankierung) | `dhl-privat`        |

Detection lives in [`detect.js`](detect.js) and only uses the first page:

- **Internetmarken** carry `Creator: Deutsche Post AG` / `Title: INTERNETMARKEN` in the PDF
  metadata; the page size (±3mm) then decides between the A4 eBay sheet and the two native formats.
- **DHL parcel labels** have no reliable metadata, so the page text is checked for
  `DHL Online Frankierung` or both `Leitcode` and `Identcode` on an A4 page. Letter-spaced text
  (`S e n d u n g s n u m m e r`) is normalized first. Labels mentioning `International` are skipped,
  as they need a different crop.

Anything not matching is never printed. To check what would happen with a file:
`node autoprint.js --dry-run --print some.pdf` (writes a PNG, prints nothing).

A file is identified by inode and creation time, not just by name, so deleting a label and
downloading it again prints it again, while touching an existing file does not.

The conversion runs locally with the label definitions from this repository, so no
snake-label instance is needed — only a reachable brother_ql_web.

## Configuration

```bash
cd autoprint
npm install
cp config.example.json config.json   # then set printerUrl to your brother_ql_web instance
```

| config.json  | Environment             | Command line    | Default               |
|--------------|-------------------------|-----------------|-----------------------|
| `printerUrl` | `AUTOPRINT_PRINTER_URL` | `--printer`     | – (required)          |
| `watchDir`   | `AUTOPRINT_DIR`         | `--dir`         | `~/Downloads`         |
| `printedDir` | `AUTOPRINT_PRINTED_DIR` | `--printed-dir` | `<watchDir>/printed`  |

Command line wins over environment, environment over `config.json`.
A different config file can be given with `--config` or `AUTOPRINT_CONFIG`.

## Usage

```bash
node autoprint.js                         # watch the folder
node autoprint.js --dry-run               # write <name>-Label.png instead of printing
node autoprint.js --print label.pdf       # print a single file
```

## Autostart

Requires [Node.js](https://nodejs.org) 20 or newer. Each installer runs `npm install`,
asks for the printer URL and folder if there is no `config.json` yet, and starts the watcher.

| System  | Install                                                    | Runs as                          | Log                                              |
|---------|------------------------------------------------------------|----------------------------------|--------------------------------------------------|
| macOS   | `./install-macos.sh`                                       | LaunchAgent                      | `~/Library/Logs/snake-label-autoprint.log`        |
| Linux   | `./install-linux.sh`                                       | systemd user service             | `journalctl --user -u snake-label-autoprint -f`  |
| Windows | `powershell -ExecutionPolicy Bypass -File install-windows.ps1` | hidden task at logon         | `%LOCALAPPDATA%\snake-label-autoprint\autoprint.log` |

Uninstall with `--uninstall` (Windows: `-Uninstall`). Re-run the installer after
changing `config.json`, or simply restart the service.

Notes:

- **macOS** asks to allow `node` access to the Downloads folder (`EPERM` in the log →
  System Settings → Privacy & Security → Files and Folders) and to the **local network**
  (`EHOSTUNREACH` → Privacy & Security → Local Network). The watcher checks the printer at
  startup so the prompt appears right away, and keeps retrying until it is reachable
  (`printer reachable at …` in the log).
- **Linux**: the service runs while you are logged in. To keep it running without a session,
  enable lingering: `sudo loginctl enable-linger $USER`. Notifications use `notify-send` if present.
  Use the real download folder of your desktop if it is localized (e.g. `~/Downloads` vs. `~/Download`).
- **Windows**: if creating a scheduled task is not permitted, the installer falls back to a
  shortcut in the Startup folder (no automatic restart after a crash).
