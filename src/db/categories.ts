import { getDBConnection } from './index';

export interface Category {
    id: number;
    name: string;
    icon: string;
    color: string;
    type: 'expense' | 'income';
    is_default: number;
}

export const getCategories = (type: 'expense' | 'income') => {
    const db = getDBConnection();
    try {
        return db.getAllSync<Category>(
            `SELECT * FROM categories WHERE type = ? OR type IS NULL ORDER BY name ASC`,
            type
        );
    } catch (e) {
        console.error("Error getting categories", e);
        return [];
    }
};

export const addCategory = (name: string, icon: string, color: string, type: 'expense' | 'income') => {
    const db = getDBConnection();
    try {
        const result = db.runSync(
            `INSERT INTO categories (name, icon, color, type, is_default) VALUES (?, ?, ?, ?, 0)`,
            name, icon, color, type
        );
        return result.lastInsertRowId;
    } catch (e) {
        console.error("Error adding category", e);
        throw e;
    }
};

export const deleteCategory = (id: number) => {
    const db = getDBConnection();
    try {
        db.runSync(`DELETE FROM categories WHERE id = ? AND is_default = 0`, id);
    } catch (e) {
        console.error("Error deleting category", e);
    }
};
