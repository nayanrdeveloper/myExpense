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
    formattedText?: string;
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

        // Construct Formatted Text from Spatial Rows (Line by Line)
        const formattedText = rows.map(r => r.text).join('\n');

        return {
            amount: total,
            tax,
            date,
            merchant,
            items,
            category,
            text: result.text,
            formattedText
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
    let maxPriceFound = 0;

    // Keywords that indicate a line is NOT an item
    const SKIP_KEYWORDS = [
        'total', 'subtotal', 'sub total', 'amount', 'payable', 'balance', 'due', 'cash',
        'card', 'change', 'visa', 'mastercard', 'amex', 'upi', 'date', 'time', 'tax',
        'gst', 'vat', 'discount', 'round', 'rounding', 'tel', 'ph:', 'item', 'price',
        'rate', 'qty', 'quantity', 'desc', 'description'
    ];

    // Identify the "Total" section (usually the bottom 30% of rows)
    const startIndexForTotal = Math.max(0, rows.length - 8);

    // 1. First Pass: Find Grand Total and Tax
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const lower = row.text.toLowerCase();

        // Look for prices
        const priceMatches = row.text.match(/(\d{1,3}(?:,\d{3})*\.\d{2})|(\d+\.\d{2})/g);
        if (priceMatches) {
            const vals = priceMatches.map(m => parseFloat(m.replace(/,/g, '')));
            const rowMax = Math.max(...vals);

            // Logic for Total: Look for "Total" keyword OR simply the largest numbers at the bottom
            const isTotalLine = i >= startIndexForTotal || lower.includes('total') || lower.includes('payable');

            if (isTotalLine) {
                if (rowMax > maxPriceFound) {
                    maxPriceFound = rowMax;
                    grandTotal = rowMax;
                }
            }

            // Refine Total: If specifically labeled "Total", trust it more
            if ((lower.includes('grand total') || lower.includes('net payable')) && rowMax > 0) {
                grandTotal = rowMax;
            }
        }

        // Look for Tax
        if (lower.includes('tax') || lower.includes('gst') || lower.includes('vat')) {
            const matches = row.text.match(/(\d+\.\d{2})/);
            if (matches) {
                totalTax = (totalTax || 0) + parseFloat(matches[0]);
            }
        }
    }

    // 2. Second Pass: Extract Items
    // We stop processing items once we hit the "Total" section roughly, or if we see a total keyword
    let stopProcessingItems = false;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const lower = row.text.toLowerCase();

        // Stop condition: clearly reached the totals section
        if (i > rows.length * 0.6 && (lower.startsWith('total') || lower.startsWith('sub'))) {
            stopProcessingItems = true;
        }
        if (stopProcessingItems) continue;

        // Skip if contains banned keywords (metadata lines)
        if (SKIP_KEYWORDS.some(k => lower.includes(k))) continue;

        // Skip header lines (usually only 1 word or very short identifiers)
        if (row.text.length < 5) continue;
        if (row.text.match(/^\d+$/)) continue; // Pure id number

        // Detect Price at end of line
        const elements = row.elements;
        if (elements.length >= 2) {
            const lastEl = elements[elements.length - 1];
            const cleanPrice = lastEl.text.replace(/[^0-9.]/g, '');

            // Must look like a price (e.g. 50.00 or 50)
            if (cleanPrice.match(/^\d+(\.\d{2})?$/)) {
                const price = parseFloat(cleanPrice);

                // Smart Filter: Price shouldn't be the Grand Total
                if (grandTotal && price === grandTotal && rows.length > 5) continue;

                // Valid Price Range
                if (!isNaN(price) && price > 0 && price < 100000) {
                    // Name is everything to the left
                    const nameParts = elements.slice(0, elements.length - 1);
                    let nameText = nameParts.map(e => e.text).join(' ').trim();

                    // Helper: Skip if name is also just numbers
                    if (nameText.match(/^[\d\s]+$/)) continue;

                    // Extract Logic (Qty/Unit)
                    let qty = 1;
                    let unit = '';

                    const qtyMatch = nameText.match(/^(\d+)\s*([xX]|pcs|pc)\b/i);
                    if (qtyMatch) {
                        qty = parseInt(qtyMatch[1]);
                        nameText = nameText.replace(qtyMatch[0], '').trim();
                    }

                    const unitMatch = nameText.match(/\b(\d*\.?\d+)\s*(kg|g|gm|l|ml|ltr|box|pkt)\b/i);
                    if (unitMatch) {
                        unit = unitMatch[2];
                    }

                    if (nameText.length > 2) {
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

    // Safety: If no Grand Total found, sum the items
    if (!grandTotal && items.length > 0) {
        grandTotal = items.reduce((sum, item) => sum + item.amount, 0);
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

