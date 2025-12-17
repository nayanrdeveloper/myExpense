
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Modal, RefreshControl, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addExpense, deleteExpense, Expense, getExpenses, getMonthTotal, getTodayExpenses, searchExpenses } from '../../src/db/expenses';
import { getMonthlyBudget } from '../../src/db/settings';
import { formatCurrency, formatDate } from '../../src/utils/format';

export default function HomeScreen() {
    const router = useRouter();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [totalToday, setTotalToday] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const LIMIT = 10;
    const offset = useRef(0);

    // Undo State
    const [deletedItem, setDeletedItem] = useState<Expense | null>(null);
    const [showUndo, setShowUndo] = useState(false);
    const undoTimeout = useRef<NodeJS.Timeout | null>(null);

    const [searchModalVisible, setSearchModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Expense[]>([]);

    const loadData = useCallback(() => {
        try {
            const todayData = getTodayExpenses();
            const total = todayData.reduce((sum, item) => sum + item.amount, 0);
            setTotalToday(total);

            // Initial Load for List
            offset.current = 0;
            const data = getExpenses(LIMIT, 0);
            setExpenses(data);
            setHasMore(data.length === LIMIT);
        } catch (e) {
            console.error(e);
        }
    }, []);

    const loadMore = () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const nextOffset = offset.current + LIMIT;
            const moreData = getExpenses(LIMIT, nextOffset);
            if (moreData.length > 0) {
                setExpenses(prev => [...prev, ...moreData]);
                offset.current = nextOffset;
                if (moreData.length < LIMIT) setHasMore(false);
            } else {
                setHasMore(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingMore(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
            return () => {
                if (undoTimeout.current) clearTimeout(undoTimeout.current);
            }
        }, [loadData])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData();
        setRefreshing(false);
    }, [loadData]);

    const handleDelete = async (id: number) => {
        const item = expenses.find(e => e.id === id);
        if (item) {
            await deleteExpense(id);
            loadData();

            // Undo Logic
            setDeletedItem(item);
            setShowUndo(true);
            if (undoTimeout.current) clearTimeout(undoTimeout.current);
            undoTimeout.current = setTimeout(() => {
                setShowUndo(false);
                setDeletedItem(null);
            }, 5000);
        }
    };

    const handleUndo = async () => {
        if (deletedItem) {
            await addExpense(deletedItem.amount, deletedItem.category, deletedItem.note || '', deletedItem.date, deletedItem.type);
            setShowUndo(false);
            setDeletedItem(null);
            loadData();
        }
    };

    const handleSearch = useCallback((text: string) => {
        setSearchQuery(text);
        if (text.length > 2) {
            const results = searchExpenses(text);
            setSearchResults(results);
        } else {
            setSearchResults([]);
        }
    }, []);

    const renderRightActions = (id: number) => {
        return (
            <TouchableOpacity
                style={styles.deleteAction}
                onPress={() => handleDelete(id)}
            >
                <Ionicons name="trash" size={24} color="#fff" />
            </TouchableOpacity>
        );
    };

    const renderExpenseItem = ({ item }: { item: Expense }) => (
        <Swipeable renderRightActions={() => renderRightActions(item.id)}>
            <TouchableOpacity
                style={styles.expenseItem}
                onPress={() => router.push({ pathname: '/add', params: { id: item.id } })}
                activeOpacity={0.7}
            >
                <View style={[styles.iconContainer, { backgroundColor: getCategoryColor(item.category) + '15' }]}>
                    <Ionicons name={getCategoryIcon(item.category)} size={22} color={getCategoryColor(item.category)} />
                </View>
                <View style={styles.expenseDetails}>
                    <Text style={styles.expenseCategory}>{item.category}</Text>
                    {item.note ? <Text style={styles.expenseNote} numberOfLines={1}>{item.note}</Text> : null}
                </View>
                <Text style={[styles.expenseAmount, item.type === 'income' && { color: '#10B981' }]}>
                    {item.type === 'expense' ? '-' : '+'} {formatCurrency(item.amount)}
                </Text>
            </TouchableOpacity>
        </Swipeable>
    );

    const renderSearchResultItem = ({ item }: { item: Expense }) => (
        <TouchableOpacity
            style={styles.searchItem}
            onPress={() => {
                setSearchModalVisible(false);
                router.push({ pathname: '/add', params: { id: item.id } });
            }}
        >
            <View style={[styles.iconContainerSmall, { backgroundColor: getCategoryColor(item.category) + '15' }]}>
                <Ionicons name={getCategoryIcon(item.category)} size={16} color={getCategoryColor(item.category)} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.searchItemTitle}>{item.category} {item.note ? `• ${item.note}` : ''}</Text>
                <Text style={styles.searchItemDate}>{item.date}</Text>
            </View>
            <Text style={[styles.searchItemAmount, item.type === 'income' && { color: '#10B981' }]}>
                {formatCurrency(item.amount)}
            </Text>
        </TouchableOpacity>
    );

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.container}>
                <StatusBar barStyle="dark-content" />
                <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                    <FlatList
                        data={expenses}
                        renderItem={({ item }) => <View key={item.id}>{renderExpenseItem({ item })}</View>}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />}
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.5}
                        ListHeaderComponent={
                            <>
                                {/* Header */}
                                <View style={styles.header}>
                                    <View>
                                        <Text style={styles.greeting}>Good Morning,</Text>
                                        <Text style={styles.username}>My Wallet</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/calendar_view')}>
                                            <Ionicons name="calendar-outline" size={24} color="#1E293B" />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.iconBtn} onPress={() => setSearchModalVisible(true)}>
                                            <Ionicons name="search" size={24} color="#1E293B" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Total Card */}
                                <LinearGradient
                                    colors={['#4F46E5', '#7C3AED']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.totalCard}
                                >
                                    <View>
                                        <Text style={styles.totalLabel}>Today's Spend</Text>
                                        <Text style={styles.totalAmount}>{formatCurrency(totalToday)}</Text>
                                    </View>
                                    <View style={styles.cardIcon}>
                                        <Ionicons name="wallet" size={48} color="rgba(255,255,255,0.2)" />
                                    </View>
                                    <Text style={styles.date}>{formatDate(new Date().toISOString())}</Text>
                                </LinearGradient>

                                {/* Safe Spend Indicator */}
                                {(() => {
                                    const budget = getMonthlyBudget();
                                    if (budget > 0) {
                                        const monthTotal = getMonthTotal();
                                        const remaining = budget - monthTotal;
                                        const now = new Date();
                                        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                                        const daysLeft = daysInMonth - now.getDate() + 1;
                                        const safeDaily = remaining > 0 ? remaining / daysLeft : 0;

                                        return (
                                            <View style={styles.safeSpendContainer}>
                                                <View style={styles.safeSpendHeader}>
                                                    <View style={styles.safeIconBg}>
                                                        <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                                                    </View>
                                                    <Text style={styles.safeSpendTitle}>Daily Safe Limit</Text>
                                                </View>
                                                <Text style={styles.safeSpendText}>
                                                    You can spend <Text style={{ fontWeight: '700', color: '#10B981' }}>{formatCurrency(safeDaily)}</Text> safely today.
                                                </Text>
                                            </View>
                                        );
                                    }
                                    return null;
                                })()}

                                {/* Daily Summary (Evening Only) */}
                                {new Date().getHours() >= 18 && totalToday > 0 && (
                                    <View style={styles.summaryCard}>
                                        <Text style={styles.summaryText}>
                                            <Text style={styles.summaryHighlight}>Daily Snapshot: </Text>
                                            You spent <Text style={styles.summaryHighlight}>{formatCurrency(totalToday)}</Text> on{' '}
                                            {(() => {
                                                // Calculate top categories
                                                const catTotals: Record<string, number> = {};
                                                expenses.filter(e => e.type === 'expense').forEach(e => {
                                                    catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
                                                });
                                                const sortedCats = Object.entries(catTotals)
                                                    .sort(([, a], [, b]) => b - a)
                                                    .map(([cat]) => cat);

                                                if (sortedCats.length === 0) return 'expenses';
                                                if (sortedCats.length === 1) return sortedCats[0];
                                                return `${sortedCats[0]} & ${sortedCats[1]}`;
                                            })()}.
                                        </Text>
                                    </View>
                                )}

                                {/* List Header */}
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>Transactions</Text>
                                </View>
                            </>
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <View style={styles.emptyIconBg}>
                                    <Ionicons name="receipt-outline" size={32} color="#94A3B8" />
                                </View>
                                <Text style={styles.emptyText}>No transactions</Text>
                                <Text style={styles.emptySubText}>Tap '+' to add one.</Text>
                            </View>
                        }
                        ListFooterComponent={
                            loadingMore ? (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <Text style={{ color: '#94A3B8' }}>Loading more...</Text>
                                </View>
                            ) : <View style={{ height: 100 }} />
                        }
                    />

                    {/* Undo Toast */}
                    {showUndo && (
                        <View style={styles.undoToast}>
                            <Text style={styles.undoText}>Transaction deleted</Text>
                            <TouchableOpacity onPress={handleUndo}>
                                <Text style={styles.undoBtn}>UNDO</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Search Modal */}
                    <Modal visible={searchModalVisible} animationType="slide" presentationStyle="pageSheet">
                        <View style={styles.modalContainer}>
                            <View style={styles.searchHeader}>
                                <Text style={styles.modalTitle}>Search Expenses</Text>
                                <TouchableOpacity onPress={() => setSearchModalVisible(false)} style={styles.closeBtn}>
                                    <Ionicons name="close" size={24} color="#64748B" />
                                </TouchableOpacity>
                            </View>

                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search notes, category, date..."
                                placeholderTextColor="#94A3B8"
                                value={searchQuery}
                                onChangeText={handleSearch}
                                autoFocus
                            />

                            {searchResults.length > 0 && (
                                <View style={styles.searchResultsHeader}>
                                    <Text style={styles.resultsLabel}>Found {searchResults.length} transactions</Text>
                                    <Text style={styles.resultsTotal}>
                                        Total: {formatCurrency(searchResults.reduce((sum, item) => sum + (item.type === 'expense' ? item.amount : 0), 0))}
                                    </Text>
                                </View>
                            )}

                            <FlatList
                                data={searchResults}
                                renderItem={renderSearchResultItem}
                                keyExtractor={item => item.id.toString()}
                                contentContainerStyle={styles.resultsList}
                                ListEmptyComponent={
                                    searchQuery.length > 2 ? (
                                        <View style={styles.emptySearch}>
                                            <Text style={styles.emptySearchText}>No matches found</Text>
                                        </View>
                                    ) : null
                                }
                            />
                        </View>
                    </Modal>

                </SafeAreaView>
            </View>
        </GestureHandlerRootView>
    );
}

// Helpers
const getCategoryIcon = (category: string): any => {
    const map: Record<string, string> = {
        'Food': 'fast-food', 'Groceries': 'cart', 'Travel': 'car', 'Rent': 'home',
        'Bills': 'flash', 'Entertainment': 'game-controller', 'Medical': 'medkit',
        'Shopping': 'shirt', 'Education': 'school', 'Other': 'radio-button-on'
    };
    return map[category] || 'pricetag';
};

const getCategoryColor = (category: string): string => {
    const map: Record<string, string> = {
        'Food': '#EF4444', 'Groceries': '#10B981', 'Travel': '#3B82F6', 'Rent': '#8B5CF6',
        'Bills': '#F59E0B', 'Entertainment': '#EC4899', 'Medical': '#EF4444',
        'Shopping': '#D946EF', 'Education': '#6366F1', 'Other': '#64748B'
    };
    return map[category] || '#64748B';
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    content: {
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    greeting: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
    username: {
        fontSize: 24,
        color: '#0F172A',
        fontWeight: '700',
    },
    iconBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 2,
    },
    totalCard: {
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
        position: 'relative',
        overflow: 'hidden',
    },
    totalLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    totalAmount: {
        color: '#fff',
        fontSize: 36,
        fontWeight: '800',
        letterSpacing: -1,
    },
    date: {
        marginTop: 16,
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        fontWeight: '500',
    },
    cardIcon: {
        position: 'absolute',
        right: -10,
        bottom: -10,
        transform: [{ rotate: '-15deg' }]
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    seeAll: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4F46E5',
    },

    expenseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    separator: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginLeft: 60,
        marginRight: 16,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    expenseDetails: {
        flex: 1,
        marginLeft: 16,
    },
    expenseCategory: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
    expenseNote: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 2,
    },
    expenseAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 48,
    },
    emptyIconBg: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#94A3B8',
        marginTop: 12,
    },
    emptySubText: {
        fontSize: 14,
        color: '#94A3B8',
        marginTop: 4,
    },
    deleteAction: {
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        width: 72,
        height: '100%',
        borderRadius: 20,
        marginBottom: 12,
    },
    undoToast: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: '#1E293B',
        padding: 16,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    undoText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    undoBtn: {
        color: '#818CF8', // Indigo 400
        fontWeight: '700',
        fontSize: 14,
    },
    summaryCard: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
        borderLeftWidth: 4,
        borderLeftColor: '#4F46E5',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    summaryText: {
        fontSize: 16,
        color: '#475569',
        lineHeight: 24,
    },
    summaryHighlight: {
        color: '#1E293B',
        fontWeight: '700',
    },
    // Search Styles
    modalContainer: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        padding: 24,
    },
    searchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    closeBtn: {
        padding: 4,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F172A',
    },
    searchInput: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        fontSize: 16,
        color: '#0F172A',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 16,
    },
    searchResultsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    resultsLabel: {
        color: '#64748B',
        fontWeight: '500',
    },
    resultsTotal: {
        color: '#4F46E5',
        fontWeight: '700',
    },
    resultsList: {
        paddingBottom: 40,
    },
    searchItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    iconContainerSmall: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchItemTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
    },
    searchItemDate: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 2,
    },
    searchItemAmount: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    emptySearch: {
        alignItems: 'center',
        marginTop: 40,
    },
    emptySearchText: {
        color: '#94A3B8',
    },
    // Safe Spend Styles
    safeSpendContainer: {
        backgroundColor: '#F0FDF4', // Light green
        borderRadius: 20,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#DCFCE7',
    },
    safeSpendHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    safeIconBg: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#DCFCE7',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    safeSpendTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#15803D',
    },
    safeSpendText: {
        fontSize: 16,
        color: '#166534',
        lineHeight: 24,
    },
});
