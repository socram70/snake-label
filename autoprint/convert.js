// Renders a label PDF and crops it with the snake-label definitions from
// ../src/js/labels.js — the same code the web UI uses (see src/js/crop.js).
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import getLabel from '../src/js/labels.js';

export async function loadPdf(data) {
    return getDocument({ data: new Uint8Array(data), verbosity: 0 }).promise;
}

// Returns a canvas of `label.width` x 696 px (tape runs horizontally),
// exactly like `outputCanvas` in crop.js.
export async function convertLabel(pdf, labelType) {
    const label = getLabel(labelType);
    if (!label) throw new Error(`Unknown label type: ${labelType}`);

    const page = await pdf.getPage(label.file.page);
    const viewport = page.getViewport({
        scale: label.scale || 4,
        rotation: label.file.rotation,
    });
    const pageCanvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
    const pageCtx = pageCanvas.getContext('2d');
    pageCtx.fillStyle = 'white';
    pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    await page.render({ canvas: pageCanvas, canvasContext: pageCtx, viewport }).promise;

    const outputCanvas = createCanvas(label.width, 696); // 59mm print width for QL-Printers
    const ctx = outputCanvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;

    label.crop(outputCanvas, ctx, pageCanvas);
    return outputCanvas;
}

// Rotates the label so the tape width (696 px) is horizontal, like rotatePng() in print.js.
export function rotateForPrinter(canvas) {
    const rotated = createCanvas(canvas.height, canvas.width);
    const ctx = rotated.getContext('2d');
    ctx.translate(rotated.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(canvas, 0, 0);
    return rotated;
}
