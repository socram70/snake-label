// Figures out which snake-label type a PDF is. Returns null for anything that
// isn't a known stamp/parcel label, so unrelated downloads are left alone.
const PT_PER_MM = 72 / 25.4;

function near(actualPt, expectedMm, toleranceMm = 3) {
    return Math.abs(actualPt / PT_PER_MM - expectedMm) <= toleranceMm;
}

export async function detectLabelType(pdf) {
    const { info } = await pdf.getMetadata();
    const page = await pdf.getPage(1);
    const { width, height } = page.getViewport({ scale: 1 });
    const text = (await page.getTextContent()).items.map(i => i.str).join(' ');
    // Some generators space out every letter ("S e n d u n g s n u m m e r")
    const squashed = text.replace(/\s+/g, '');

    const isA4 = near(width, 210) && near(height, 297);

    const isInternetmarke = info?.Creator === 'Deutsche Post AG' || info?.Title === 'INTERNETMARKEN';
    if (isInternetmarke) {
        if (isA4) return { type: 'dp-briefmarke-ebay', description: 'eBay Briefmarke (A4)' };
        if (near(width, 62) && near(height, 100)) return { type: 'dp-briefmarke-adresse', description: 'Deutsche Post Briefmarke mit Adresse' };
        if (near(width, 61) && near(height, 37)) return { type: 'dp-briefmarke', description: 'Deutsche Post Briefmarke' };
        return null;
    }

    const isDhl = squashed.includes('DHLOnlineFrankierung')
        || (squashed.includes('Leitcode') && squashed.includes('Identcode'));
    if (isDhl && isA4) {
        if (/international/i.test(squashed)) return null; // needs a different crop, don't guess
        return { type: 'dhl-privat', description: 'DHL Paketmarke National (A4)' };
    }

    return null;
}
