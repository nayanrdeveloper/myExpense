import { addExpense } from './expenses';
import { getDBConnection } from './index';

export interface Bill {
    id: number;
    name: string;
    amount: number;
    due_date: string;
    frequency: 'once' | 'monthly' | 'yearly';
    is_paid: number; // 0 or 1
    reminder_id?: string;
}

export const addBill = async (name: string, amount: number, dueDate: string, frequency: 'once' | 'monthly' | 'yearly' = 'once', reminderId?: string) => {
    const db = getDBConnection();
    try {
        const result = await db.runAsync(
            `INSERT INTO bills (name, amount, due_date, frequency, reminder_id) VALUES (?, ?, ?, ?, ?)`,
            name, amount, dueDate, frequency, reminderId ?? null
        );
        return result.lastInsertRowId;
    } catch (e) {
        console.error("Error adding bill", e);
        throw e;
    }
};

export const getBills = () => {
    const db = getDBConnection();
    try {
        return db.getAllSync<Bill>(`SELECT * FROM bills ORDER BY due_date ASC`);
    } catch (e) {
        console.error("Error getting bills", e);
        return [];
    }
};

export const markBillAsPaid = async (bill: Bill) => {
    const db = getDBConnection();
    try {
        // 1. Add to Expenses
        addExpense(bill.amount, 'Bills', `Paid: ${bill.name}`, new Date().toISOString().split('T')[0], 'expense');

        // 2. Handle Recurrence
        if (bill.frequency === 'once') {
            await db.runAsync(`UPDATE bills SET is_paid = 1 WHERE id = ?`, bill.id);
        } else {
            // Calculate next due date
            const currentDue = new Date(bill.due_date);
            let nextDue = new Date(currentDue);

            if (bill.frequency === 'monthly') {
                nextDue.setMonth(nextDue.getMonth() + 1);
            } else if (bill.frequency === 'yearly') {
                nextDue.setFullYear(nextDue.getFullYear() + 1);
            }

            const nextDueStr = nextDue.toISOString().split('T')[0];

            await db.runAsync(
                `UPDATE bills SET due_date = ?, is_paid = 0 WHERE id = ?`,
                nextDueStr, bill.id
            );
        }
    } catch (e) {
        console.error("Error updating bill status", e);
    }
};

export const deleteBill = async (id: number) => {
    const db = getDBConnection();
    try {
        await db.runAsync(`DELETE FROM bills WHERE id = ?`, id);
    } catch (e) {
        console.error("Error deleting bill", e);
    }
};
