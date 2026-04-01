import getLabel from './labels'

import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.mjs';
import { saveAs } from 'file-saver';
import { loadConfig, saveConfig, printLabel, testConnection } from './print';

const debug = false;
debug && (downloadPageIMG.hidden = false);
console.log('Application loaded. debug =', debug);

const viewImg = document.getElementById('view');
let label,
    labelArrayBuffer,
    outputCanvas;
var labelData = {
    image: new Image(),
};

convertLabel.addEventListener('click', readFile, false);
downloadLabel.addEventListener('click', saveLabel, false);
downloadLabelIMG.addEventListener('click', savePNG, false);
downloadPageIMG.addEventListener('click', savePagePNG, false);

// Printer state
let printerConnected = false;
let labelReady = false;

function updatePrintButtonState() {
    document.getElementById('printLabelBtn').disabled = !(printerConnected && labelReady);
}

async function checkPrinterConnection() {
    const result = await testConnection();
    const configSection = document.getElementById('printer-config');
    const status = document.getElementById('print-status');

    printerConnected = result.success;
    configSection.hidden = result.success;

    if (!result.success) {
        status.textContent = result.error || 'Kein Drucker erreichbar. Bitte URL konfigurieren.';
        status.className = 'mt-2 text-center text-sm text-red-700';
    }
    updatePrintButtonState();
    return result;
}

// Printer config
const printerUrlInput = document.getElementById('printer-url');
printerUrlInput.value = loadConfig();

document.getElementById('save-printer-url').addEventListener('click', async () => {
    saveConfig(printerUrlInput.value.trim());
    await checkPrinterConnection();
});

document.getElementById('test-printer-url').addEventListener('click', async () => {
    saveConfig(printerUrlInput.value.trim());
    const btn = document.getElementById('test-printer-url');
    const status = document.getElementById('print-status');
    btn.disabled = true;
    status.textContent = 'Verbindung wird geprüft\u2026';
    status.className = 'mt-2 text-center text-sm text-gray-700';

    const result = await checkPrinterConnection();

    if (result.success) {
        status.textContent = 'Verbindung erfolgreich.';
        status.className = 'mt-2 text-center text-sm text-green-700 font-medium';
    }
    btn.disabled = false;
});

// Print button
document.getElementById('printLabelBtn').addEventListener('click', async () => {
    const btn = document.getElementById('printLabelBtn');
    const status = document.getElementById('print-status');
    btn.disabled = true;
    status.textContent = 'Druckauftrag wird gesendet\u2026';
    status.className = 'mt-2 text-center text-sm text-gray-700';

    const result = await printLabel(outputCanvas);

    if (result.success) {
        status.textContent = 'Druckauftrag erfolgreich gesendet.';
        status.className = 'mt-2 text-center text-sm text-green-700 font-medium';
    } else {
        status.textContent = result.error || 'Unbekannter Fehler.';
        status.className = 'mt-2 text-center text-sm text-red-700';
    }
    btn.disabled = false;
});

// Background connection check on page load
checkPrinterConnection();

function savePNG() {
    saveAs(
        new Blob([labelArrayBuffer], { type: 'image/png' }),
        document.getElementById('file-input').files[0].name.replace(/(.pdf|.gif)/g,'') + '-Label.png'
    );
}

function savePagePNG() {
    labelData.canvas.toBlob((blob) => {
        saveAs(
            blob,
            document.getElementById('file-input').files[0].name.replace(/(.pdf|.gif)/g,'') + '.png'
        );
    });
}

async function saveLabel() {
    const pdfBytes = await generatePDF();
    saveAs(
        new Blob([pdfBytes], { type: 'application/pdf' }),
        document.getElementById('file-input').files[0].name.replace(/(.pdf|.gif)/g,'') + '-Label.pdf'
    );
}

async function generatePDF() {
    const pdfDoc = await PDFDocument.create();

    // size in 72dpi
    // page borders: ends 3mm, top/bottom 1.5mm
    const width = pxTo72Dpi(label.width) + mmTo72Dpi(6),
        height = mmTo72Dpi(62);
    const page = pdfDoc.addPage([width, height]);

    const labelImage = await pdfDoc.embedPng(labelArrayBuffer);
    page.drawImage(labelImage, {
        x: mmTo72Dpi(3),
        y: mmTo72Dpi(1.5),
        width: width - mmTo72Dpi(6),
        height: height - mmTo72Dpi(3),
    });

    return pdfDoc.save();

    // helper functions
    function mmTo72Dpi(length) { return length * 0.03937007874 * 72; }; // mm -> 72dpi
    function pxTo72Dpi(pixels) { return pixels * 72 / 300. };           // 300dpi px -> 72dpi
}

function readFile() {
    label = getLabel(document.getElementById('label-type').value);

    const reader = new FileReader();
    console.log('Reading file.');
    switch(label.file.type) {
        case 'pdf':
            reader.readAsArrayBuffer(document.getElementById('file-input').files[0]);
            break;
        case 'gif':
            reader.readAsDataURL(document.getElementById('file-input').files[0]);
            break;
    }

    reader.onload = async (e) => {
        switch(label.file.type) {
            case 'pdf':
             // read PDF
            labelData.pdf = await getDocument(reader.result).promise;
            console.log('PDF loaded.', labelData.pdf);

            // get page
            labelData.page = await labelData.pdf.getPage(label.file.page);

            // render page on canvas
            labelData.canvas = document.createElement('canvas');
            const viewport = labelData.page.getViewport({
                    scale: label.scale || 4,
                    rotation: label.file.rotation
                });
            labelData.canvas.width = viewport.width;
            labelData.canvas.height = viewport.height;
            await labelData.page.render({
                canvasContext: labelData.canvas.getContext('2d'),
                viewport: viewport
            }).promise;

            // convert canvas to image
            const p = new Promise(r => labelData.image.onload = r);
            labelData.image.src = labelData.canvas.toDataURL();
            await p;
            break;

            case 'gif':
                labelData.image.src = reader.result;
            break;
        }

        await new Promise(r => setTimeout(r, 1e2)); // small delay helps

        // generate output canvas
        outputCanvas = document.createElement('canvas');
        const ctx = outputCanvas.getContext('2d');
        outputCanvas.width = label.width;
        outputCanvas.height = 696; // 59mm print width for QL-Printers

        if (debug) {
            ctx.fillStyle = 'lightgreen'; // background
            ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
            ctx.fillStyle = 'pink'; // 1mm 'safety zone' top/bottom
            ctx.fillRect(0, 0, outputCanvas.width, 12);
            ctx.fillRect(0, outputCanvas.height - 12, outputCanvas.width, outputCanvas.height);
        } else {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
        }
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;

        // crop label
        label.crop(outputCanvas, ctx, labelData.image);
        console.log('Label cropped.');

        // show label
        view.classList.add('invisible');
        labelImg.src = outputCanvas.toDataURL();
        outputCanvas.toBlob((blob) => {
            const reader = new FileReader();
            reader.addEventListener('loadend', () => {
                labelArrayBuffer = reader.result;
                view.classList.remove('invisible');
                labelReady = true;
                updatePrintButtonState();
            });
            reader.readAsArrayBuffer(blob);
        }, 'image/png');
        console.log('Finished.');
    };
}