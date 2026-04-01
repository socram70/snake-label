const CONFIG_KEY = 'brotherQlWebUrl';

export function loadConfig() {
    return localStorage.getItem(CONFIG_KEY) || 'http://localhost:8013';
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

export async function testConnection() {
    const url = loadConfig();
    if (!url) {
        return { success: false, error: 'Please configure the printer URL.' };
    }

    const baseUrl = url.replace(/\/+$/, '');
    try {
        const response = await fetch(baseUrl + '/labeldesigner/api/font/styles', { method: 'GET' });
        if (response.ok) {
            return { success: true };
        }
        return { success: false, error: `Server antwortet mit HTTP ${response.status}.` };
    } catch (e) {
        if (e instanceof TypeError) {
            return {
                success: false,
                error: 'Connection failed. Is the URL correct and CORS enabled?',
            };
        }
        throw e;
    }
}

export async function printLabel(canvas) {
    const url = loadConfig();
    if (!url) {
        return { success: false, error: 'Please configure the printer URL.' };
    }

    const blob = await rotatePng(canvas);
    const formData = new FormData();
    formData.append('image', blob, 'label.png');
    formData.append('print_type', 'image');
    formData.append('image_mode', 'grayscale');
    formData.append('label_size', '62');
    formData.append('margin_top', '0');
    formData.append('margin_bottom', '0');
    formData.append('margin_left', '0');
    formData.append('margin_right', '0');

    const baseUrl = url.replace(/\/+$/, '');
    let response;
    try {
        response = await fetch(baseUrl + '/labeldesigner/api/print', {
            method: 'POST',
            body: formData,
        });
    } catch (e) {
        if (e instanceof TypeError) {
            return {
                success: false,
                error: 'Connection failed. Is the URL correct and CORS enabled in brother_ql_web?',
            };
        }
        throw e;
    }

    let json;
    try {
        json = await response.json();
    } catch {
        return { success: false, error: `Unexpected response from printer (HTTP ${response.status}).` };
    }

    return json;
}
