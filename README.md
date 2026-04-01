# snake-label

Converts large-format shipping labels to 62mm `snake_labels` for label printers.

## Usage

### Online

Open [snake-label.de](https://snake-label.de) in your browser — no installation required.

### Offline (single HTML file)

Download the latest `snake-label-vX.X.X.html` from the [Releases](../../releases) page and open it locally in any browser.

### Docker

Run a local instance served by nginx:

```bash
docker run -d -p 8080:80 ghcr.io/typingbeaver/snake-label:latest
```

Then open [http://localhost:8080](http://localhost:8080).

To run a specific version:

```bash
docker run -d -p 8080:80 ghcr.io/typingbeaver/snake-label:v0.18.0
```

Available tags are listed on the [Packages](../../pkgs/container/snake-label) page.

## Changelog

See the [Releases](../../releases) page for a full list of changes per version.

## License

GPL-3.0-or-later
