import { getDBConnection } from './index';

export const setSetting = (key: string, value: string) => {
    const db = getDBConnection();
    try {
        db.runSync(
            `INSERT INTO settings (key, value) VALUES (?, ?) 
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
            key, value
        );
    } catch (e) {
        console.error('Error setting setting:', e);
    }
};

export const getSetting = (key: string): string | null => {
    const db = getDBConnection();
    try {
        const result = db.getFirstSync<{ value: string }>(
            `SELECT value FROM settings WHERE key = ?`,
            key
        );
        return result?.value || null;
    } catch (e) {
        console.error('Error getting setting:', e);
        return null;
    }
};

export const getMonthlyBudget = (): number => {
    const val = getSetting('monthly_budget');
    return val ? Number(val) : 0;
};

export const setMonthlyBudget = (amount: number) => {
    setSetting('monthly_budget', amount.toString());
};

export const getDailyLimit = (): number => {
    const val = getSetting('daily_limit');
    return val ? Number(val) : 0;
};

export const setDailyLimit = (amount: number) => {
    setSetting('daily_limit', amount.toString());
};

export const getTrackingPaused = (): boolean => {
    const val = getSetting('tracking_paused');
    return val === 'true';
};

export const setTrackingPaused = (paused: boolean) => {
    setSetting('tracking_paused', paused.toString());
};
