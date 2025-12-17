import { getDBConnection } from './index';

export interface CategoryBreakdown {
    category: string;
    total: number;
    color: string;
    icon: string; // Added icon for UI
}

export interface ReportData {
    totalSpent: number;
    totalIncome: number;
    balance: number;
    breakdown: CategoryBreakdown[];
    periodTitle: string;
}

import { getCategoryColor, getCategoryIcon } from '../utils/categories';

export const getReportData = (period: 'daily' | 'weekly' | 'monthly'): ReportData => {
    const db = getDBConnection();
    const now = new Date();
    let startDate = '';
    let endDate = '';
    let periodTitle = '';

    if (period === 'daily') {
        startDate = now.toISOString().split('T')[0];
        endDate = startDate;
        periodTitle = 'Today\'s';
    } else if (period === 'weekly') {
        const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
        const lastDay = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        startDate = firstDay.toISOString().split('T')[0];
        endDate = lastDay.toISOString().split('T')[0];
        periodTitle = 'This Week\'s';
    } else {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        startDate = firstDay.toISOString().split('T')[0];
        endDate = lastDay.toISOString().split('T')[0];
        periodTitle = 'This Month\'s';
    }

    try {
        // Get Expense Total
        const expenseResult = db.getFirstSync<{ total: number }>(
            `SELECT SUM(amount) as total FROM expenses WHERE date >= ? AND date <= ? AND type = 'expense' AND (is_excluded IS NULL OR is_excluded = 0)`,
            startDate, endDate
        );
        const totalSpent = expenseResult?.total || 0;

        // Get Income Total
        const incomeResult = db.getFirstSync<{ total: number }>(
            `SELECT SUM(amount) as total FROM expenses WHERE date >= ? AND date <= ? AND type = 'income' AND (is_excluded IS NULL OR is_excluded = 0)`,
            startDate, endDate
        );
        const totalIncome = incomeResult?.total || 0;

        // Get Breakdown (Expenses Only)
        const breakdownResult = db.getAllSync<{ category: string, total: number }>(
            `SELECT category, SUM(amount) as total FROM expenses 
             WHERE date >= ? AND date <= ? AND type = 'expense' AND (is_excluded IS NULL OR is_excluded = 0)
             GROUP BY category ORDER BY total DESC`,
            startDate, endDate
        );

        const breakdown = breakdownResult.map(item => ({
            category: item.category,
            total: item.total,
            color: getCategoryColor(item.category),
            icon: getCategoryIcon(item.category)
        }));

        return {
            totalSpent,
            totalIncome,
            balance: totalIncome - totalSpent,
            breakdown,
            periodTitle
        };

    } catch (e) {
        console.error("Error getting report data", e);
        return { totalSpent: 0, totalIncome: 0, balance: 0, breakdown: [], periodTitle: '' };
    }
};

export interface InsightData {
    monthDiff: number;
    monthPercent: number;
    topCategoryChange: { name: string; diff: number } | null;
}

export const getComparisonInsights = (): InsightData => {
    const db = getDBConnection();
    const now = new Date();

    // Current Month range
    const cmStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const cmEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    // Last Month range
    const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    try {
        // 1. Total Spend Comparison
        const cmTotal = db.getFirstSync<{ t: number }>(`SELECT SUM(amount) as t FROM expenses WHERE type='expense' AND date >= ? AND date <= ? AND (is_excluded IS NULL OR is_excluded = 0)`, cmStart, cmEnd)?.t || 0;
        const lmTotal = db.getFirstSync<{ t: number }>(`SELECT SUM(amount) as t FROM expenses WHERE type='expense' AND date >= ? AND date <= ? AND (is_excluded IS NULL OR is_excluded = 0)`, lmStart, lmEnd)?.t || 0;

        const monthDiff = cmTotal - lmTotal;
        const monthPercent = lmTotal > 0 ? (monthDiff / lmTotal) * 100 : 0;

        // 2. Category Level Comparison
        // Get all category totals for CM and LM
        const cmCats = db.getAllSync<{ category: string, total: number }>(
            `SELECT category, SUM(amount) as total FROM expenses WHERE type='expense' AND date >= ? AND date <= ? AND (is_excluded IS NULL OR is_excluded = 0) GROUP BY category`,
            cmStart, cmEnd
        );
        const lmCats = db.getAllSync<{ category: string, total: number }>(
            `SELECT category, SUM(amount) as total FROM expenses WHERE type='expense' AND date >= ? AND date <= ? AND (is_excluded IS NULL OR is_excluded = 0) GROUP BY category`,
            lmStart, lmEnd
        );

        let maxIncrease = 0;
        let topCat: { name: string; diff: number } | null = null;

        // Find biggest increase
        cmCats.forEach(c => {
            const lmVal = lmCats.find(l => l.category === c.category)?.total || 0;
            const diff = c.total - lmVal;
            if (diff > maxIncrease) { // Only care about increases for now as per user request
                maxIncrease = diff;
                topCat = { name: c.category, diff };
            }
        });

        return {
            monthDiff,
            monthPercent,
            topCategoryChange: topCat
        };

    } catch (e) {
        console.error("Error calculating insights", e);
        return { monthDiff: 0, monthPercent: 0, topCategoryChange: null };
    }
};

export interface SpendingPatterns {
    weekendTotal: number;
    weekdayTotal: number;
    weekendPercent: number;
    smallSpendsTotal: number;
    smallSpendsCount: number; // Latte factor
}

export const getSpendingPatterns = (): SpendingPatterns => {
    const db = getDBConnection();
    const now = new Date();
    // Analyze Current Month
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    try {
        const expenses = db.getAllSync<{ date: string, amount: number, category: string }>(
            `SELECT date, amount, category FROM expenses WHERE type='expense' AND date >= ? AND date <= ? AND (is_excluded IS NULL OR is_excluded = 0)`,
            start, end
        );

        let weekendTotal = 0;
        let weekdayTotal = 0;
        let smallSpendsTotal = 0;
        let smallSpendsCount = 0;

        expenses.forEach(e => {
            const date = new Date(e.date);
            const day = date.getDay(); // 0 is Sunday, 6 is Saturday

            // Weekend Check
            if (day === 0 || day === 6) {
                weekendTotal += e.amount;
            } else {
                weekdayTotal += e.amount;
            }

            // Small Spends (e.g. < 100)
            if (e.amount < 100) {
                smallSpendsTotal += e.amount;
                smallSpendsCount++;
            }
        });

        const total = weekendTotal + weekdayTotal;
        const weekendPercent = total > 0 ? (weekendTotal / total) * 100 : 0;

        return {
            weekendTotal,
            weekdayTotal,
            weekendPercent,
            smallSpendsTotal,
            smallSpendsCount
        };

    } catch (e) {
        console.error("Error calculating patterns", e);
        return { weekendTotal: 0, weekdayTotal: 0, weekendPercent: 0, smallSpendsTotal: 0, smallSpendsCount: 0 };
    }
};

export const getZeroSpendStreak = (): number => {
    const db = getDBConnection();
    const now = new Date();
    let streak = 0;

    // Iterate backwards from yesterday (don't count today until it's over, or do we? Common pattern is count today if currently 0)
    // Let's count from TODAY backwards.

    for (let i = 0; i < 30; i++) { // Check up to last 30 days
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        try {
            const result = db.getFirstSync<{ count: number }>(
                `SELECT COUNT(*) as count FROM expenses WHERE date = ? AND type = 'expense' AND (is_excluded IS NULL OR is_excluded = 0)`,
                dateStr
            );

            if (result && result.count === 0) {
                streak++;
            } else {
                // Streak broken
                break;
            }
        } catch (e) {
            break;
        }
    }
    return streak;
};

