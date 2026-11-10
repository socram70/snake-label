#!/usr/bin/env node
// Watches a folder for new stamp/parcel label PDFs, converts them with the
// snake-label crop definitions and prints them via brother_ql_web.
//
//   node autoprint.js                 watch the folder (default ~/Downloads)
//   node autoprint.js --print a.pdf   convert + print a single file, then move it
//   --dry-run                         write the PNG next to the PDF instead of printing/moving
import fs from 'node:fs/promises';
import { watch } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { loadPdf, convertLabel, rotateForPrinter } from './convert.js';
import { detectLabelType } from './detect.js';

const { values: args } = parseArgs({
    options: {
        config: { type: 'string', default: process.env.AUTOPRINT_CONFIG || fileURLToPath(new URL('./config.json', import.meta.url)) },
        dir: { type: 'string' },
        printer: { type: 'string' },
        'printed-dir': { type: 'string' },
        print: { type: 'string' },
        'dry-run': { type: 'boolean', default: false },
    },
});

// Precedence: command line > environment > config file > defaults
const config = await readConfig(args.config);
const watchDir = path.resolve(expandHome(args.dir || process.env.AUTOPRINT_DIR || config.watchDir || '~/Downloads'));
const printedDir = path.resolve(expandHome(args['printed-dir'] || process.env.AUTOPRINT_PRINTED_DIR || config.printedDir || path.join(watchDir, 'printed')));
const printerUrl = (args.printer || process.env.AUTOPRINT_PRINTER_URL || config.printerUrl || '').replace(/\/+$/, '');
const dryRun = args['dry-run'];

if (!printerUrl && !dryRun) {
    console.error('No printer URL configured. Set "printerUrl" in config.json, AUTOPRINT_PRINTER_URL or --printer (see README.md).');
    process.exit(1);
}

async function readConfig(file) {
    try {
        // Strip a BOM, e.g. after editing with Notepad
        return JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
    } catch (e) {
        if (e.code === 'ENOENT') return {};
        throw new Error(`Cannot read config ${file}: ${e.message}`);
    }
}

function expandHome(p) {
    return p.replace(/^~(?=$|[\\/])/, os.homedir());
}

function log(...msg) {
    console.log(new Date().toISOString(), ...msg);
}

// Desktop notification; failures (e.g. no notify-send on a headless box) are ignored.
function notify(title, message) {
    const ignore = () => {};
    switch (process.platform) {
        case 'darwin':
            execFile('osascript', ['-e', `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`], ignore);
            break;
        case 'linux':
            execFile('notify-send', [title, message], ignore);
            break;
        case 'win32':
            // Text goes through the environment so it never needs PowerShell quoting
            execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command',
                'Add-Type -AssemblyName System.Windows.Forms; $n = New-Object System.Windows.Forms.NotifyIcon; '
                + '$n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; '
                + '$n.ShowBalloonTip(5000, $env:AUTOPRINT_TITLE, $env:AUTOPRINT_MESSAGE, "Info"); Start-Sleep 6; $n.Dispose()'],
                { env: { ...process.env, AUTOPRINT_TITLE: title, AUTOPRINT_MESSAGE: message }, windowsHide: true }, ignore);
            break;
    }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Same check as testConnection() in src/js/print.js. On macOS the first network
// access of a launchd job triggers the "Local Network" permission prompt and fails,
// so this runs at startup and keeps retrying until the printer answers.
async function waitForPrinter(interval = 10_000) {
    for (let attempt = 1; ; attempt++) {
        try {
            const response = await fetch(printerUrl + '/labeldesigner/api/font/styles', {
                signal: AbortSignal.timeout(10_000),
            });
            if (response.ok) {
                log(`printer reachable at ${printerUrl}`);
                return;
            }
            log(`printer at ${printerUrl} answered HTTP ${response.status}, retrying`);
        } catch (e) {
            if (attempt === 1) {
                log(`printer not reachable at ${printerUrl} (${e.cause?.message || e.message}), retrying every ${interval / 1000}s`
                    + ' — on macOS allow "Local Network" access for node if asked');
            }
        }
        await sleep(interval);
    }
}

// Retries network errors (printer asleep, permission prompt still open) before giving up.
async function sendToPrinter(canvas, attempts = 5, delay = 10_000) {
    for (let attempt = 1; ; attempt++) {
        try {
            return await sendToPrinterOnce(canvas);
        } catch (e) {
            if (!e.network || attempt >= attempts) throw e;
            log(`retry  ${e.message} (attempt ${attempt}/${attempts})`);
            await sleep(delay);
        }
    }
}

// Same request as printLabel() in src/js/print.js
async function sendToPrinterOnce(canvas) {
    const formData = new FormData();
    formData.append('image', new Blob([canvas.toBuffer('image/png')], { type: 'image/png' }), 'label.png');
    formData.append('print_type', 'image');
    formData.append('image_mode', 'grayscale');
    formData.append('label_size', '62');
    formData.append('margin_top', '0');
    formData.append('margin_bottom', '0');
    formData.append('margin_left', '0');
    formData.append('margin_right', '0');

    let response;
    try {
        response = await fetch(printerUrl + '/labeldesigner/api/print', {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(60_000),
        });
    } catch (e) {
        throw Object.assign(
            new Error(`Printer not reachable at ${printerUrl}: ${e.cause?.message || e.message}`),
            { network: true },
        );
    }
    let json;
    try {
        json = await response.json();
    } catch {
        throw new Error(`Unexpected response from printer (HTTP ${response.status}).`);
    }
    if (!json.success) throw new Error(json.message || 'Printer reported failure.');
}

async function moveToPrinted(file) {
    await fs.mkdir(printedDir, { recursive: true });
    const { name, ext } = path.parse(file);
    let target = path.join(printedDir, name + ext);
    for (let i = 1; await exists(target); i++) {
        target = path.join(printedDir, `${name} (${i})${ext}`);
    }
    await fs.rename(file, target);
    return target;
}

async function exists(file) {
    return fs.access(file).then(() => true, () => false);
}

// Browsers may still be writing when the final name appears; wait until the size settles.
async function waitUntilStable(file, { interval = 500, checks = 3, timeout = 30_000 } = {}) {
    const start = Date.now();
    let lastSize = -1, stable = 0;
    while (Date.now() - start < timeout) {
        const { size } = await fs.stat(file);
        stable = size > 0 && size === lastSize ? stable + 1 : 0;
        if (stable >= checks) return;
        lastSize = size;
        await new Promise(r => setTimeout(r, interval));
    }
    throw new Error('File did not finish writing in time.');
}

async function processFile(file) {
    const name = path.basename(file);
    if (!(await exists(file))) return; // already printed and moved by an earlier event
    await waitUntilStable(file);

    const pdf = await loadPdf(await fs.readFile(file));
    try {
        const detected = await detectLabelType(pdf);
        if (!detected) {
            log(`skip   ${name}: not a known stamp/parcel label`);
            return;
        }
        log(`label  ${name}: ${detected.description} -> ${detected.type}`);

        const canvas = rotateForPrinter(await convertLabel(pdf, detected.type));

        if (dryRun) {
            const png = file.replace(/\.pdf$/i, '') + '-Label.png';
            await fs.writeFile(png, canvas.toBuffer('image/png'));
            log(`dry    ${name}: wrote ${png}`);
            return;
        }

        await sendToPrinter(canvas);
        const target = await moveToPrinted(file);
        log(`print  ${name}: printed, moved to ${target}`);
        notify('Snake Label', `Gedruckt: ${detected.description}`);
    } finally {
        await pdf.destroy();
    }
}

function watchFolder() {
    // Remembers each PDF by file identity, not just by name: a file deleted and
    // downloaded again under the same name is a different file and gets printed.
    const known = new Map();     // filename -> identity of the version already seen
    const pending = new Map();   // debounce timers per file

    // Serialize print jobs so labels don't interleave on the printer
    let queue = Promise.resolve();
    const enqueue = (file) => {
        queue = queue.then(() => processFile(file)).catch((e) => {
            log(`error  ${path.basename(file)}: ${e.message}`);
            notify('Snake Label – Fehler', `${path.basename(file)}: ${e.message}`);
        });
    };

    return fs.readdir(watchDir).then(async (entries) => {
        for (const name of entries.filter(isPdf)) {
            const id = await identity(path.join(watchDir, name));
            if (id) known.set(name, id);
        }
        log(`watching ${watchDir} (${known.size} existing PDFs ignored), printer ${printerUrl}${dryRun ? ' [dry-run]' : ''}`);
        if (!dryRun) waitForPrinter();

        watch(watchDir, (eventType, filename) => {
            if (!filename || !isPdf(filename)) return;
            clearTimeout(pending.get(filename));
            pending.set(filename, setTimeout(async () => {
                pending.delete(filename);
                const file = path.join(watchDir, filename);
                const id = await identity(file);
                if (!id || known.get(filename) === id) return;
                known.set(filename, id);
                enqueue(file);
            }, 1000));
        });
    });
}

// Inode + creation time; null if the file is gone
async function identity(file) {
    try {
        const { ino, birthtimeMs } = await fs.stat(file);
        return `${ino}:${birthtimeMs}`;
    } catch {
        return null;
    }
}

function isPdf(filename) {
    return /\.pdf$/i.test(filename) && !filename.startsWith('.');
}

if (args.print) {
    processFile(path.resolve(args.print)).catch((e) => {
        log(`error  ${args.print}: ${e.message}`);
        process.exitCode = 1;
    });
} else {
    watchFolder().catch((e) => {
        log(`error  cannot watch ${watchDir}: ${e.message}`);
        process.exit(1);
    });
}
