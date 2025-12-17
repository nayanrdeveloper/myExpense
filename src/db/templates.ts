import { getDBConnection } from './index';

export interface Template {
    id: number;
    name: string;
    amount: number;
    category: string;
    note?: string;
    type: 'expense' | 'income';
}

export const addTemplate = async (name: string, amount: number, category: string, note: string, type: 'expense' | 'income') => {
    const db = getDBConnection();
    try {
        const result = await db.runAsync(
            `INSERT INTO templates (name, amount, category, note, type) VALUES (?, ?, ?, ?, ?)`,
            name, amount, category, note, type
        );
        return result.lastInsertRowId;
    } catch (e) {
        console.error("Error adding template", e);
        throw e;
    }
};

export const getTemplates = (type: 'expense' | 'income') => {
    const db = getDBConnection();
    try {
        return db.getAllSync<Template>(`SELECT * FROM templates WHERE type = ? ORDER BY id DESC`, type);
    } catch (e) {
        console.error("Error getting templates", e);
        return [];
    }
};

export const deleteTemplate = async (id: number) => {
    const db = getDBConnection();
    try {
        await db.runAsync(`DELETE FROM templates WHERE id = ?`, id);
    } catch (e) {
        console.error("Error deleting template", e);
    }
};
