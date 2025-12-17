import TextRecognition from '@react-native-ml-kit/text-recognition';

export interface ScannedItem {
    name: string;
    amount: number;
    unit?: string;
    qty?: number;
    pricePerUnit?: number;
}

export interface ScanResult {
    amount?: number;
    tax?: number;
    date?: string;
    merchant?: string;
    items?: ScannedItem[];
    category?: string;
    text: string;
}

export const scanReceipt = async (imageUri: string): Promise<ScanResult> => {
    try {
        const result = await TextRecognition.recognize(imageUri);
        const text = result.text;
        const blocks = result.blocks;

        const amount = parseAmount(text);
        const tax = parseTax(text);
        const date = parseDate(text);
        const merchant = parseMerchant(blocks);
        const items = parseItems(text);
        const category = predictCategory(text, merchant, items);

        return {
            text,
            amount,
            tax,
            date,
            merchant,
            items,
            category
        };
    } catch (e) {
        console.error("OCR Error", e);
        throw e;
    }
};

const parseAmount = (text: string): number | undefined => {
    const lines = text.split('\n');
    let maxAmount = 0;
    const priceRegex = /[0-9]+[.,][0-9]{2}/g;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes('total') || line.includes('amount') || line.includes('payable') || line.includes('balance')) {
            const matches = line.match(priceRegex);
            if (matches) {
                const val = parseFloat(matches[matches.length - 1].replace(/,/g, ''));
                if (val > maxAmount) maxAmount = val;
            }
        }
    }

    if (maxAmount > 0) return maxAmount;

    const allMatches = text.match(priceRegex);
    if (allMatches) {
        const values = allMatches
            .map(m => parseFloat(m.replace(/,/g, '')))
            .filter(v => v < 1000000);
        if (values.length > 0) {
            return Math.max(...values);
        }
    }
    return undefined;
};

const parseTax = (text: string): number | undefined => {
    const lines = text.split('\n');
    const taxRegex = /(?:tax|gst|vat|hst)\s*:?\s*(\d+[.,]\d{2})/i;

    for (const line of lines) {
        const match = line.match(taxRegex);
        if (match) {
            return parseFloat(match[1].replace(/,/g, ''));
        }
    }
    return undefined;
};

const parseDate = (text: string): string | undefined => {
    const isoDate = /\b\d{4}-\d{2}-\d{2}\b/;
    const isoMatch = text.match(isoDate);
    if (isoMatch) return isoMatch[0];

    const dmyDate = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/;
    const dmyMatch = text.match(dmyDate);
    if (dmyMatch) {
        return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
    }
    return undefined;
};

const parseItems = (text: string): ScannedItem[] => {
    const lines = text.split('\n');
    const items: ScannedItem[] = [];
    const priceRegex = /(\d+[.,]\d{2})$/;

    let startIndex = 0;
    let endIndex = lines.length;

    const lowerLines = lines.map(l => l.toLowerCase());
    const totalIndex = lowerLines.findIndex(l => l.includes('total') || l.includes('subtotal') || l.includes('amount'));
    if (totalIndex > -1) endIndex = totalIndex;

    for (let i = startIndex; i < endIndex; i++) {
        const line = lines[i].trim();
        if (line.length < 5 || line.match(/^\d+$/) || line.match(/^\d{2}\/\d{2}\/\d{4}$/)) continue;
        if (line.toLowerCase().includes('tax') || line.toLowerCase().includes('cash') || line.toLowerCase().includes('change')) continue;

        const priceMatch = line.match(priceRegex);
        if (priceMatch) {
            const price = parseFloat(priceMatch[1].replace(/,/g, ''));
            let namePart = line.substring(0, line.length - priceMatch[0].length).trim();

            // Advanced Qty/Unit Logic
            let qty = 1;
            let unit = '';

            // Pattern: "2 x 50.00" (Price per unit line? skip)
            if (namePart.match(/x\s*\d+[.,]\d{2}/)) continue;

            // Pattern: "2 x Item" or "2 Item"
            const qtyMatch = namePart.match(/^(\d+)\s*([xX]|pcs)?\s*/);
            if (qtyMatch) {
                const q = parseInt(qtyMatch[1], 10);
                if (q < 100) { // Sanity check
                    qty = q;
                    namePart = namePart.substring(qtyMatch[0].length).trim();
                }
            }

            // Unit Detection (Offline Dictionary)
            const unitPatterns = [
                { u: 'kg', p: /\b(\d*\.?\d+)\s*kg\b/i },
                { u: 'g', p: /\b(\d+)\s*g\b/i },
                { u: 'L', p: /\b(\d*\.?\d+)\s*(l|ltr|liter)\b/i },
                { u: 'ml', p: /\b(\d+)\s*ml\b/i },
                { u: 'pcs', p: /\b(\d+)\s*(pcs|pc)\b/i },
                { u: 'box', p: /\bbox\b/i },
                { u: 'pkt', p: /\b(pkt|packet)\b/i },
            ];

            for (const up of unitPatterns) {
                const m = namePart.match(up.p);
                if (m) {
                    unit = up.u;
                    break;
                }
            }

            items.push({ name: namePart, amount: price, qty, unit });
        }
    }
    return items;
};

const parseMerchant = (blocks: any[]): string | undefined => {
    if (!blocks || blocks.length === 0) return undefined;

    for (let i = 0; i < Math.min(5, blocks.length); i++) {
        const txt = blocks[i].text.trim();
        if (txt.length > 3 && !txt.match(/\d/) && !txt.includes('Total') && !txt.includes('Date')) {
            if (['receipt', 'tax invoice', 'bill', 'welcome'].includes(txt.toLowerCase())) continue;
            return txt;
        }
    }
    return undefined;
};

const predictCategory = (text: string, merchant: string | undefined, items: ScannedItem[]): string | undefined => {
    const fullText = (text + " " + (merchant || "") + " " + items.map(i => i.name).join(" ")).toLowerCase();

    const categories: Record<string, string[]> = {
        'Groceries': ['market', 'mart', 'fresh', 'food', 'bakery', 'dairy', 'milk', 'egg', 'veg', 'fruit', 'grocery', 'supermarket'],
        'Food': ['restaurant', 'cafe', 'coffee', 'burger', 'pizza', 'kitchen', 'dining', 'bistro', 'bar', 'tea', 'snack'],
        'Travel': ['fuel', 'petrol', 'gas', 'station', 'oil', 'uber', 'lyft', 'ola', 'taxi', 'cab', 'trip', 'airline', 'flight', 'parking', 'toll'],
        'Medical': ['pharmacy', 'chemist', 'hospital', 'clinic', 'doctor', 'med', 'health', 'tablet', 'pill'],
        'Shopping': ['fashion', 'clothing', 'apparel', 'shoe', 'wear', 'retail', 'mall', 'amazon', 'flipkart', 'store'],
        'Utilities': ['electric', 'power', 'water', 'bill', 'recharge', 'wifi', 'internet', 'broadband'],
        'Entertainment': ['movie', 'cinema', 'theatre', 'netflix', 'game', 'play', 'show'],
    };

    for (const [cat, keywords] of Object.entries(categories)) {
        for (const word of keywords) {
            if (fullText.includes(word)) return cat;
        }
    }

    return undefined;
};
