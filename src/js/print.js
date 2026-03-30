const CONFIG_KEY = 'brotherQlWebUrl';

export function loadConfig() {
    return localStorage.getItem(CONFIG_KEY) || '';
}

export function saveConfig(url) {
    localStorage.setItem(CONFIG_KEY, url);
}

function rotatePng(canvas) {
    const rotated = document.createElement('canvas');
    rotated.width = canvas.height;
    rotated.height = canvas.width;
    const ctx = rotated.getContext('2d');
    ctx.translate(rotated.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(canvas, 0, 0);
    return new Promise((resolve) => rotated.toBlob(resolve, 'image/png'));
}

export async function printLabel(canvas) {
    const url = loadConfig();
    if (!url) {
        return { success: false, error: 'Bitte Drucker-URL konfigurieren.' };
    }

    const blob = await rotatePng(canvas);
    const formData = new FormData();
    formData.append('image', blob, 'label.png');
    formData.append('label_size', '62');

    let response;
    try {
        response = await fetch(url + '/api/print/image', {
            method: 'POST',
            body: formData,
        });
    } catch (e) {
        if (e instanceof TypeError) {
            return {
                success: false,
                error: 'Verbindung fehlgeschlagen. Ist die URL korrekt und CORS in brother_ql_web aktiviert?',
            };
        }
        throw e;
    }

    let json;
    try {
        json = await response.json();
    } catch {
        return { success: false, error: `Unerwartete Antwort vom Drucker (HTTP ${response.status}).` };
    }

    return json;
}
