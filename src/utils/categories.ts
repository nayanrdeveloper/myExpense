export const getCategoryColor = (category: string): string => {
    const map: Record<string, string> = {
        'Food': '#EF4444', 'Groceries': '#10B981', 'Travel': '#3B82F6', 'Rent': '#8B5CF6',
        'Bills': '#F59E0B', 'Entertainment': '#EC4899', 'Medical': '#EF4444',
        'Shopping': '#D946EF', 'Education': '#6366F1', 'Other': '#64748B',
        'Salary': '#10B981', 'Freelance': '#3B82F6', 'Gift': '#F59E0B' // Income colors
    };
    return map[category] || '#64748B';
}

export const getCategoryIcon = (category: string): string => {
    const map: Record<string, string> = {
        'Food': 'fast-food', 'Groceries': 'cart', 'Travel': 'car', 'Rent': 'home',
        'Bills': 'flash', 'Entertainment': 'game-controller', 'Medical': 'medkit',
        'Shopping': 'shirt', 'Education': 'school', 'Other': 'radio-button-on',
        'Salary': 'cash', 'Freelance': 'laptop', 'Gift': 'gift' // Income icons
    };
    return map[category] || 'pricetag';
};
