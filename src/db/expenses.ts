import { getDBConnection } from './index';

export interface ExpenseItem {
    id?: number;
    expense_id?: number;
    name: string;
    amount: number;
    unit?: string;
}

export interface Expense {
    id: number;
    amount: number;
    category: string;
    note?: string;
    date: string;
    type: 'expense' | 'income';
    created_at: number;
    is_excluded?: number; // 0 or 1
    location?: string;
    items?: ExpenseItem[];
}

export const addExpense = (amount: number, category: string, note: string, date: string, type: 'expense' | 'income' = 'expense', is_excluded: boolean = false, location: string = '', items: ExpenseItem[] = []) => {
    const db = getDBConnection();
    try {
        const result = db.runSync(
            `INSERT INTO expenses (amount, category, note, date, type, is_excluded, location) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            amount, category, note, date, type, is_excluded ? 1 : 0, location
        );
        const expenseId = result.lastInsertRowId;

        if (items.length > 0) {
            items.forEach(item => {
                db.runSync(
                    `INSERT INTO expense_items (expense_id, name, amount, unit) VALUES (?, ?, ?, ?)`,
                    expenseId, item.name, item.amount, item.unit || ''
                );
            });
        }

        return expenseId;
    } catch (error) {
        console.error('Error adding expense:', error);
        throw error;
    }
};

export const getExpenseById = (id: number): Expense | null => {
    const db = getDBConnection();
    try {
        const expense = db.getFirstSync<Expense>(
            `SELECT * FROM expenses WHERE id = ?`,
            id
        );
        if (expense) {
            const items = db.getAllSync<ExpenseItem>(
                `SELECT * FROM expense_items WHERE expense_id = ?`,
                id
            );
            expense.items = items;
        }
        return expense || null;
    } catch (e) {
        console.error("Error getting expense by id", e);
        return null;
    }
};

export const getTodayExpenses = () => {
    const db = getDBConnection();
    const today = new Date().toISOString().split('T')[0];
    try {
        return db.getAllSync<Expense>(
            `SELECT * FROM expenses WHERE date = ? ORDER BY id DESC`,
            today
        );
    } catch (e) {
        console.error("Error getting today expenses", e);
        return [];
    }
};

export const getExpenses = (limit: number = 20, offset: number = 0) => {
    const db = getDBConnection();
    try {
        const expenses = db.getAllSync<Expense>(
            `SELECT * FROM expenses ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`,
            limit, offset
        );
        return expenses;
    } catch (e) {
        console.error("Error getting expenses", e);
        return [];
    }
};

export const getMonthTotal = () => {
    const db = getDBConnection();
    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

        const result = db.getFirstSync<{ total: number }>(
            `SELECT SUM(amount) as total FROM expenses WHERE date >= ? AND date <= ? AND type = 'expense' AND (is_excluded IS NULL OR is_excluded = 0)`,
            startOfMonth, endOfMonth
        );
        return result?.total || 0;
    } catch (e) {
        console.error("Error getting month total", e);
        return 0;
    }
}

export const updateExpense = (id: number, amount: number, category: string, note: string, date: string, type: 'expense' | 'income', is_excluded: boolean = false, location: string = '', items: ExpenseItem[] = []) => {
    const db = getDBConnection();
    try {
        const result = db.runSync(
            `UPDATE expenses SET amount = ?, category = ?, note = ?, date = ?, type = ?, is_excluded = ?, location = ? WHERE id = ?`,
            amount, category, note, date, type, is_excluded ? 1 : 0, location, id
        );

        // Update items: Delete all and re-insert
        db.runSync(`DELETE FROM expense_items WHERE expense_id = ?`, id);
        if (items.length > 0) {
            items.forEach(item => {
                db.runSync(
                    `INSERT INTO expense_items (expense_id, name, amount, unit) VALUES (?, ?, ?, ?)`,
                    id, item.name, item.amount, item.unit || ''
                );
            });
        }

        return result.changes;
    } catch (error) {
        console.error('Error updating expense:', error);
        throw error;
    }
};

export const deleteExpense = (id: number) => {
    const db = getDBConnection();
    try {
        db.runSync(`DELETE FROM expenses WHERE id = ?`, id);
    } catch (error) {
        console.error('Error deleting expense:', error);
        throw error;
    }
};



export const searchExpenses = (query: string) => {
    const db = getDBConnection();
    try {
        const searchTerm = `%${query}%`;
        return db.getAllSync<Expense>(
            `SELECT * FROM expenses WHERE note LIKE ? OR category LIKE ? OR date LIKE ? ORDER BY date DESC`,
            searchTerm, searchTerm, searchTerm
        );
    } catch (e) {
        console.error("Error searching expenses", e);
        return [];
    }
};

export const getExpensesForMonth = (year: number, month: number) => {
    const db = getDBConnection();
    const start = new Date(year, month, 1).toISOString().split('T')[0];
    const end = new Date(year, month + 1, 0).toISOString().split('T')[0];

    try {
        return db.getAllSync<Expense>(
            `SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC`,
            start, end
        );
    } catch (e) {
        console.error("Error getting month expenses", e);
        return [];
    }
};


