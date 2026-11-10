# [![`snake_label`](/img/snake_label_header.webp)](https://snake-label.de)
Converts large format shipping labels to 62mm `snake_labels` for label printers e. g. Brother QL printers. - And this without sending your labels to a server, instead your browser will do all the work!

> **Warning**
> Use this tool at your own risk. These are non-official labels which could get declined by the operator.

## What's in this repository

Shipping labels and online stamps usually come as A4 PDFs meant for plain paper. `snake_label` crops
the relevant parts (address, barcodes, codes) and rearranges them into a compact strip for 62mm
endless tape — sharp enough to scan and as short as possible.

| Part | What it does |
|------|--------------|
| **Web app** (`index.html`, `src/`) | Pick a PDF and the label type in the browser, preview, download as PNG/PDF or print directly. Runs entirely client-side. |
| **Docker / Docker Compose** | Serves the web app via nginx, optionally together with [brother_ql_web](https://github.com/socram70/brother_ql_web) for direct printing. |
| **[`autoprint/`](autoprint/)** | Background service for macOS, Linux and Windows: watches your downloads folder, recognizes stamps and parcel labels, converts and prints them automatically — no clicking. |

## Usage

### Online

Open **[snake-label.de](https://snake-label.de)** in your browser — no installation required.

### Offline (single HTML file)

Download the latest `snake-label-vX.X.X.html` from the **[Releases](../../releases)** page and open it locally in any browser.

### Docker

Run a local instance served by nginx:

```bash
docker run -d -p 8012:80 ghcr.io/socram70/snake-label:latest
```

Then open [http://localhost:8012](http://localhost:8012).

To run a specific version:

```bash
docker run -d -p 8012:80 ghcr.io/socram70/snake-label:v0.19.0
```

Available tags and the full changelog are listed on the [Releases](../../releases) and [Packages](../../pkgs/container/snake-label) pages.

### Docker Compose

To run snake-label standalone:

```bash
docker compose up -d
```

To run snake-label **together with [brother_ql_web](https://github.com/socram70/brother_ql_web)** for direct printing from the browser:

1. Copy the example config and adjust it to your printer:
   ```bash
   cp brother_ql_web_instance/application.py.example brother_ql_web_instance/application.py
   # edit brother_ql_web_instance/application.py
   ```
2. Start both services:
   ```bash
   docker compose -f docker-compose.qlweb.yml up -d
   ```

This gives you snake-label on [http://localhost:8012](http://localhost:8012) and brother_ql_web on [http://localhost:8013](http://localhost:8013). In the snake-label UI, set the printer URL to `http://localhost:8013` to enable direct printing.

### Automatic printing from the downloads folder

[`autoprint/`](autoprint/) turns the manual "open snake-label, pick file, pick type, print" into
"download the label — it comes out of the printer". It watches a folder (default `~/Downloads`),
detects the label type, converts it with the same label definitions as the web app
(`src/js/labels.js`) and sends it to brother_ql_web. Printed PDFs are moved to `printed/`.

Currently recognized automatically:

| PDF | Label type |
|-----|------------|
| Deutsche Post Internetmarke bought via eBay (A4) | `briefmarke_ebay` |
| Deutsche Post Internetmarke with address (62x100mm) | `briefmarke_adresse` |
| Deutsche Post Internetmarke without address (61x37mm) | `briefmarke` |
| DHL parcel label, national (A4, DHL Online Frankierung / eBay) | `dhl_privat` |

Everything else is left untouched. Requires Node.js 20+ and a reachable brother_ql_web instance:

```bash
cd autoprint
./install-macos.sh                                             # macOS
./install-linux.sh                                             # Linux (systemd)
powershell -ExecutionPolicy Bypass -File install-windows.ps1   # Windows
```

See [`autoprint/README.md`](autoprint/README.md) for configuration, detection details and troubleshooting.

## Features and benefits
- **smaller and handier**: sticky labels instead of giant plain paper pages
- **as short as possible**: more labels for your money!
- **sharp 2D-/barcodes**: for best scanability
- **without backend**: crops completely locally via JS (keep your address safe!)
- optimized for 300dpi
- optimised PNGs for direct printing via [brother_ql](https://github.com/pklaus/brother_ql)
- **direct print**: send labels directly to your Brother QL printer via [brother_ql_web](https://github.com/pklaus/brother_ql_web)
- **dark mode**: full dark mode support
- **pre-set printer URL**: pass `?printerUrl=http://...` as a URL parameter to pre-configure the printer
- **automatic printing**: [`autoprint/`](autoprint/) prints stamps and parcel labels as soon as they are downloaded


Currently available labels
---------------------------

### DHL

#### `dhl_privat`
- **Size:** 62x145mm
- **Note:** Zusatzleistungen and Warnings are not included in these labels (yet?).

![Sample Image](/samples/dhl/dhl_privat.png) \
[Sample PDF](/samples/dhl/dhl_privat.pdf)

#### `dhl_privat_international_eu`
- **Size:** 62x195mm

![Sample Image](/samples/dhl/dhl_international_eu_privat.png) \
[Sample PDF](/samples/dhl/dhl_international_eu_privat.pdf)

#### `dhl_privat_international_eu_native`
[DHL native countries, eg. NL]
- **Size:** 62x165mm
- **Note:** *Zusatzleistungen and Warnings are not included in these labels (yet?).*

![Sample Image](/samples/dhl/dhl_international_eu_native_privat.png)
<!-- [Sample PDF]() -->

#### `dhl_retoure` (Deutschland)
- **Size:** 62x145mm

International returns are most probably better on a real paper sheet/A5 Label.

![Sample Image](/samples/dhl/dhl_retoure.png)
<!-- [Sample PDF]() -->

#### `dhl_return_connect`
- **Size:** 62x160mm

<!-- ![Sample Image]() -->
<!-- [Sample PDF]() -->

### Deutsche Post

#### `briefmarke`
- **Size:** 62x40mm

![Sample Image](/samples/deutsche_post/briefmarke.png) \
[Sample PDF](/samples/deutsche_post/briefmarke.pdf)

#### `briefmarke_short`
- **Size:** 62x30mm
- **Note:** *Not suited for e. g. "Einschreiben International".*

![Sample Image](/samples/deutsche_post/briefmarke_short.png) \
[Sample PDF](/samples/deutsche_post/briefmarke_short.pdf)

#### `briefmarke_adresse`
- **Size:** 62x82mm

![Sample Image](/samples/deutsche_post/briefmarke_adresse.png) \
[Sample PDF](/samples/deutsche_post/briefmarke_adresse.pdf)

#### `briefmarke_bogen`
- **Size:** 62x40mm
- **Note:** *Druckt (derzeit) nur die erste Marke eines 3-spaltigen DIN A4-Bogens!*

![Sample Image](/samples/deutsche_post/briefmarke_bogen.png) \
[Sample PDF](/samples/deutsche_post/briefmarke_bogen.pdf)

#### `briefmarke_bogen_short`
- **Size:** 62x25mm
- **Note:** *Druckt (derzeit) nur die erste Marke eines **3-spaltigen** DIN A4-Bogens!*

![Sample Image](/samples/deutsche_post/briefmarke_bogen_short.png) \
[Sample PDF](/samples/deutsche_post/briefmarke_bogen_short.pdf)

#### `briefmarke_ebay`
- **Note:** *eBay Briefmarke (mit eBay-Logo)*

<!-- ![Sample Image]() -->
<!-- [Sample PDF]() -->

### Hermes

#### `hermes_privat [v1.1.2]`
- **Size:** 62x145mm

<!-- ![Sample Image]() -->
<!-- [Sample PDF]() -->

#### `hermes_vinted_qr`
- **Size:** 62x100mm

![Sample Image](/samples/hermes/hermes_vinted_qr.png)
<!-- [Sample PDF]() -->

#### `hermes_vinted_eu`
- **Size:** 62x165mm

<!-- ![Sample Image]() -->
<!-- [Sample PDF]() -->

### Seller Returns

#### `adidas_retoure [dhl]`
- **Size:** 62x120mm

<!-- ![Sample Image]() -->
<!-- [Sample PDF]() -->


#### `amazon_retoure [dhl]`
- **Size:** 62x94mm
- **Note:** *Converts displayed GIF Image `ShipperLabel.gif`. No PDF support!*

<!-- ![Sample Image]() -->
<!-- [Sample PDF]() -->

#### `bestsecret_retoure [dhl]`
- **Size:** 62x150mm

<!-- ![Sample Image]() -->
<!-- [Sample PDF]() -->

#### `hm_retoure [dhl]`
- **Size:** 62x145mm

<!-- ![Sample Image]() -->
<!-- [Sample PDF]() -->

#### `ikea_retoure [dhl]`
- **Size:** 62x135mm

<!-- ![Sample Image]() -->
<!-- [Sample PDF]() -->

#### `mediamarkt_saturn_retoure [dhl]`
- **Size:** 62x145mm

<!-- ![Sample Image]() -->
<!-- [Sample PDF]() -->

#### `nike_retoure [dhl]`
- **Size:** 62x160mm

<!-- ![Sample Image]() -->
<!-- [Sample PDF]() -->

### DPD

#### `dpd_packlink`
- **Size:** 62x180mm

<!-- ![Sample Image]() -->
<!-- [Sample PDF]() -->

#### `dpd_return`
- **Size:** 62x180mm

<!-- ![Sample Image]() -->
<!-- [Sample PDF]() -->

### GLS

#### `gls_return`
- **Size:** 62x145mm

<!-- ![Sample Image]() -->
<!-- [Sample PDF]() -->

### DHL Netherlands / DHL Nederland [mdp v5.7]

#### `dhl_nl_4_4`
- **Size:** 62x110mm
- **Note:** *4-line sender / 4-line receiver*

#### `dhl_nl_4_5`
- **Size:** 62x110mm
- **Note:** *4-line sender / **5-line receiver***

#### `dhl_nl_5_4`
- **Size:** 62x110mm
- **Note:** ***5-line sender** / 4-line receiver*

#### `dhl_nl_5_5`
- **Size:** 62x110mm
- **Note:** ***5-line sender** / **5-line receiver***

![Sample Image](/samples/dhl_netherlands/dhl_nl.png) \
[Sample PDF](/samples/dhl_netherlands/dhl_nl.pdf)

---
## Dependencies & Licenses
`snake_label` is licensed under [GPL-3.0](LICENSE).

Made possible by [@catSIXe](https://github.com/cheetahdotcat). :octocat:

### Dependencies
- [PDF-LIB](https://github.com/Hopding/pdf-lib) (c) Andrew Dillon | MIT License
- [PDF.js](https://github.com/mozilla/pdf.js) (c) Mozilla Foundation | Apache-2.0 License
- [FileSaver.js](https://github.com/eligrey/FileSaver.js) (c) Eli Grey | MIT License
- [Vite](https://github.com/vitejs/vite) (c) Evan You | MIT License
- [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) (c) Tailwind Labs, Inc. | MIT License

### Theming
- [Fira Mono](https://github.com/bBoxType/FiraSans) (c) Mozilla Foundation, Telefonica S.A., Carrois Corporate GbR and bBox Type GmbH | OFL
- [Heroicons](https://github.com/tailwindlabs/heroicons) (c) Refactoring UI Inc. | MIT License

### Logo
 - Share Tech Mono (c) Carrois Apostrophe | OFL
 - [Twitter Emoji (Twemoji)](https://github.com/twitter/twemoji) (c) Twitter, Inc | CC-BY 4.0 [modified]
