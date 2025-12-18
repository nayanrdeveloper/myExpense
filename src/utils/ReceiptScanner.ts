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

interface TextBlock {
    text: string;
    frame: { x: number; y: number; width: number; height: number };
}

interface TextRow {
    y: number;
    height: number;
    text: string;
    elements: TextBlock[];
}

export const scanReceipt = async (imageUri: string): Promise<ScanResult> => {
    try {
        const result = await TextRecognition.recognize(imageUri);

        // 1. Convert ML Kit structure to flat sortable blocks
        const allElements: TextBlock[] = [];
        for (const block of result.blocks) {
            for (const line of block.lines) {
                // We use lines as the atomic unit for clustering usually, 
                // but sometimes lines are merged incorrectly across columns.
                // Let's use the line but be aware of wide spacing.
                if (line.frame) {
                    const f = line.frame as any; // Cast to avoid strict type checks on varied Frame versions
                    allElements.push({
                        text: line.text,
                        frame: {
                            x: f.x ?? f.left ?? 0,
                            y: f.y ?? f.top ?? 0,
                            width: f.width ?? 0,
                            height: f.height ?? 0
                        }
                    });
                }
            }
        }

        // 2. Spatial Clustering: Group text into Physical Rows
        const rows = clusterTextIntoRows(allElements);

        // 3. Analyze Rows
        const merchant = analyzeMerchant(rows);
        const { items, tax, total } = analyzeReceiptBody(rows);
        const date = analyzeDate(result.text); // Dates are usually distinct enough to find via Regex globally
        const category = predictCategory(result.text, merchant, items);

        return {
            amount: total,
            tax,
            date,
            merchant,
            items,
            category,
            text: result.text
        };

    } catch (e) {
        console.error("Spatial Scan Error", e);
        throw e;
    }
};

/**
 * Groups text elements that are roughly on the same Y-axis.
 * Handles slight skew and font size variations.
 */
const clusterTextIntoRows = (elements: TextBlock[]): TextRow[] => {
    // Sort by Y first
    const sorted = [...elements].sort((a, b) => a.frame.y - b.frame.y);
    const rows: TextRow[] = [];
    const Y_TOLERANCE = 15; // pixels

    for (const el of sorted) {
        // Find a matching row
        const match = rows.find(r =>
            Math.abs(r.y - el.frame.y) < Y_TOLERANCE ||
            Math.abs((r.y + r.height / 2) - (el.frame.y + el.frame.height / 2)) < Y_TOLERANCE
        );

        if (match) {
            match.elements.push(el);
            // Sort elements in row by X
            match.elements.sort((a, b) => a.frame.x - b.frame.x);
            // Re-calculate combined row text
            match.text = match.elements.map(e => e.text).join(' ');
            // Expand Row Height/Y coverage
            // (Simulate simple merge logic)
        } else {
            rows.push({
                y: el.frame.y,
                height: el.frame.height,
                text: el.text,
                elements: [el]
            });
        }
    }
    return rows;
};

const analyzeMerchant = (rows: TextRow[]): string | undefined => {
    // Merchant is usually in the top 5 rows, largest text, centered (heuristic)
    // For now, take the first row that doesn't look like a phone number or date
    for (let i = 0; i < Math.min(6, rows.length); i++) {
        const txt = rows[i].text.trim();
        if (txt.length < 4) continue;
        if (/^\d+$/.test(txt)) continue; // Skip pure numbers
        if (/(date|phone|gst|tax|inv)/i.test(txt)) continue; // Metadata lines
        return txt;
    }
    return undefined;
};

const analyzeReceiptBody = (rows: TextRow[]): { items: ScannedItem[], tax?: number, total?: number } => {
    const items: ScannedItem[] = [];
    let grandTotal: number | undefined;
    let totalTax: number | undefined;

    const priceRegex = /(\d{1,3}(?:,\d{3})*\.\d{2})|(\d+\.\d{2})|(\d+)/;

    // Iterate rows to find items
    // Heuristic: Item rows usually have [Name] ... [Price]

    for (const row of rows) {
        const text = row.text;
        const lower = text.toLowerCase();

        // Check for Total
        if (lower.includes('total') || lower.includes('payable') || lower.includes('net amount')) {
            const matches = text.match(/[\d,]+\.\d{2}/g);
            if (matches) {
                const vals = matches.map(m => parseFloat(m.replace(/,/g, '')));
                const maxVal = Math.max(...vals);
                if (!grandTotal || maxVal > grandTotal) {
                    grandTotal = maxVal;
                }
            }
            continue; // Don't process total line as item
        }

        // Check for Tax
        if (lower.includes('tax') || lower.includes('gst') || lower.includes('vat')) {
            const matches = text.match(/[\d,]+\.\d{2}/);
            if (matches) {
                totalTax = parseFloat(matches[0].replace(/,/g, ''));
            }
            continue;
        }

        // Potential Item Row
        // Must end with a number (Price)
        // Must have text before it

        // Split by wide spaces if possible, or use the elements
        const elements = row.elements;
        if (elements.length >= 2) {
            // Check right-most element for price
            const lastEl = elements[elements.length - 1];
            const cleanPrice = lastEl.text.replace(/[^0-9.]/g, '');

            if (cleanPrice && cleanPrice.includes('.')) {
                const price = parseFloat(cleanPrice);
                if (!isNaN(price) && price > 0 && price < 100000) {
                    // Valid potential price

                    // Everything to the left is the Name + Quantity
                    const nameParts = elements.slice(0, elements.length - 1);
                    let nameText = nameParts.map(e => e.text).join(' ');

                    // Extract Quantity / Unit if present in Name
                    // Pattern: "2 x Burger" or "Sugar 1kg"

                    let qty = 1;
                    let unit = '';

                    // Qty Pattern: "2 x", "2pcs"
                    const qtyMatch = nameText.match(/^(\d+)\s*([xX]|pcs|pc)\b/i);
                    if (qtyMatch) {
                        qty = parseInt(qtyMatch[1]);
                        nameText = nameText.replace(qtyMatch[0], '').trim();
                    }

                    // Unit Pattern
                    const unitMatch = nameText.match(/\b(\d*\.?\d+)\s*(kg|g|gm|l|ml|ltr|box|pkt)\b/i);
                    if (unitMatch) {
                        // If number is present in unit match (e.g. 500g), that's the size, not necessarily qty
                        // But for expense tracking "500g Sugar" is a good name.
                        // Let's extract the unit for metadata but keep name intact mostly
                        unit = unitMatch[2];
                    }

                    if (nameText.length > 2 && !nameText.match(/subtotal|discount/i)) {
                        items.push({
                            name: nameText,
                            amount: price,
                            qty,
                            unit
                        });
                    }
                }
            }
        }
    }

    return { items, total: grandTotal, tax: totalTax };
};

const analyzeDate = (text: string): string | undefined => {
    // Regex for various date formats
    const matches = text.match(/(\d{1,2}[-./]\d{1,2}[-./]\d{2,4})/);
    if (matches) return matches[0];
    return undefined;
};

const predictCategory = (text: string, merchant: string | undefined, items: ScannedItem[]): string | undefined => {
    const fullText = (text + " " + (merchant || "") + " " + items.map(i => i.name).join(" ")).toLowerCase();

    const categories: Record<string, string[]> = {
        'Groceries': ['market', 'mart', 'fresh', 'food', 'bakery', 'dairy', 'milk', 'egg', 'veg', 'fruit', 'grocery', 'supermarket', 'kirana'],
        'Food': ['restaurant', 'cafe', 'coffee', 'burger', 'pizza', 'kitchen', 'dining', 'bistro', 'bar', 'tea', 'snack', 'hotel'],
        'Travel': ['fuel', 'petrol', 'gas', 'station', 'oil', 'uber', 'lyft', 'ola', 'taxi', 'cab', 'trip', 'airline', 'flight', 'parking', 'toll'],
        'Medical': ['pharmacy', 'chemist', 'hospital', 'clinic', 'doctor', 'med', 'health', 'tablet', 'pill'],
        'Shopping': ['fashion', 'clothing', 'apparel', 'shoe', 'wear', 'retail', 'mall', 'amazon', 'flipkart', 'store', 'myntra'],
        'Utilities': ['electric', 'power', 'water', 'bill', 'recharge', 'wifi', 'internet', 'broadband', 'airtel', 'jio', 'vodafone'],
    };

    for (const [cat, keywords] of Object.entries(categories)) {
        for (const word of keywords) {
            if (fullText.includes(word)) return cat;
        }
    }
    return undefined;
};

