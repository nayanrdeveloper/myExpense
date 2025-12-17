import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('myExpense.db');

export const getDBConnection = () => {
    return db;
};

export const initDatabase = () => {
    try {
        db.execSync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        type TEXT DEFAULT 'expense', 
        is_default BOOLEAN DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        note TEXT,
        date TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        is_excluded INTEGER DEFAULT 0,
        location TEXT
      );

      CREATE TABLE IF NOT EXISTS expense_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          expense_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          amount REAL NOT NULL,
          unit TEXT,
          FOREIGN KEY (expense_id) REFERENCES expenses (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        due_date TEXT NOT NULL,
        frequency TEXT DEFAULT 'once', 
        is_paid BOOLEAN DEFAULT 0,
        reminder_id TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        note TEXT,
        type TEXT DEFAULT 'expense'
      );
    `);

        // Migration: Add type column if missing (for existing installs)
        try {
            db.execSync("ALTER TABLE categories ADD COLUMN type TEXT DEFAULT 'expense'");
        } catch (e) {
            // Column likely exists, ignore
        }

        // Migration: Add frequency column to bills if missing
        try {
            db.execSync("ALTER TABLE bills ADD COLUMN frequency TEXT DEFAULT 'once'");
        } catch (e) {
            // Column likely exists, ignore
        }

        // Migration: Add is_excluded column to expenses if missing
        try {
            db.execSync("ALTER TABLE expenses ADD COLUMN is_excluded INTEGER DEFAULT 0");
        } catch (e) {
            // Column likely exists
        }

        // Migration: Add location column to expenses if missing
        try {
            db.execSync("ALTER TABLE expenses ADD COLUMN location TEXT");
        } catch (e) {
            // Column likely exists
        }

        // Migration: Add unit column to expense_items if missing
        try {
            db.execSync("ALTER TABLE expense_items ADD COLUMN unit TEXT");
        } catch (e) {
            // Column likely exists (or table created with it if fresh install, though table create string needs update too for fresh installs)
        }

        // Seed default categories if empty
        const result = db.getFirstSync("SELECT COUNT(*) as count FROM categories");
        // @ts-ignore
        if (result && result.count === 0) {
            const defaultCategories = [
                // Expenses
                { name: 'Food', icon: 'fast-food', color: '#FF6347', type: 'expense' },
                { name: 'Groceries', icon: 'cart', color: '#32CD32', type: 'expense' },
                { name: 'Travel', icon: 'car', color: '#1E90FF', type: 'expense' },
                { name: 'Rent', icon: 'home', color: '#8A2BE2', type: 'expense' },
                { name: 'Bills', icon: 'flash', color: '#FFD700', type: 'expense' },
                { name: 'Entertainment', icon: 'game-controller', color: '#FF69B4', type: 'expense' },
                { name: 'Medical', icon: 'medkit', color: '#FF4500', type: 'expense' },
                { name: 'Shopping', icon: 'shirt', color: '#FF1493', type: 'expense' },
                { name: 'Education', icon: 'school', color: '#4169E1', type: 'expense' },

                // Income
                { name: 'Salary', icon: 'cash', color: '#10B981', type: 'income' },
                { name: 'Freelance', icon: 'laptop', color: '#3B82F6', type: 'income' },
                { name: 'Gift', icon: 'gift', color: '#F59E0B', type: 'income' },
                { name: 'Other', icon: 'radio-button-on', color: '#808080', type: 'expense' }, // Generic
            ];

            const statement = db.prepareSync(
                'INSERT INTO categories (name, icon, color, type, is_default) VALUES ($name, $icon, $color, $type, 1)'
            );

            try {
                defaultCategories.forEach(cat => {
                    statement.executeSync({
                        $name: cat.name,
                        $icon: cat.icon,
                        $color: cat.color,
                        $type: cat.type
                    });
                });
            } finally {
                statement.finalizeSync();
            }
        }

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization failed:', error);
    }
};
