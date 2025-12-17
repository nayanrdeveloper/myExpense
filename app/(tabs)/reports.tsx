import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CategoryBreakdown, getComparisonInsights, getReportData, getSpendingPatterns, getZeroSpendStreak } from '../../src/db/reports';
import { getMonthlyBudget } from '../../src/db/settings';
import { formatCurrency } from '../../src/utils/format';

type Period = 'daily' | 'weekly' | 'monthly';

export default function ReportsScreen() {
    const [period, setPeriod] = useState<Period>('monthly');
    const [data, setData] = useState<{
        totalSpent: number,
        totalIncome: number,
        balance: number,
        breakdown: CategoryBreakdown[],
        periodTitle: string
    }>({
        totalSpent: 0,
        totalIncome: 0,
        balance: 0,
        breakdown: [],
        periodTitle: ''
    });
    const [refreshing, setRefreshing] = useState(false);
    const [budget, setBudget] = useState(0);
    const [insights, setInsights] = useState<{ monthDiff: number; monthPercent: number; topCategoryChange: { name: string; diff: number } | null } | null>(null);
    const [patterns, setPatterns] = useState<{ weekendTotal: number; weekdayTotal: number; weekendPercent: number; smallSpendsTotal: number; smallSpendsCount: number } | null>(null);
    const [streak, setStreak] = useState(0);

    const loadData = useCallback(() => {
        const report = getReportData(period);
        setData(report);
        const savedBudget = getMonthlyBudget();
        setBudget(savedBudget);
        setStreak(getZeroSpendStreak());

        // Only load insights/patterns if in Monthly view
        if (period === 'monthly') {
            setInsights(getComparisonInsights());
            setPatterns(getSpendingPatterns());
        } else {
            setInsights(null);
            setPatterns(null);
        }
    }, [period]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData();
        setRefreshing(false);
    }, [loadData]);

    const pieData = data.breakdown.map(item => ({
        value: item.total,
        color: item.color,
        text: '',
    }));

    // Budget Logic
    const isMonthly = period === 'monthly';
    const budgetProgress = budget > 0 ? (data.totalSpent / budget) * 100 : 0;
    const isOverBudget = budget > 0 && data.totalSpent > budget;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>

                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Analytics</Text>
                </View>

                {/* Filter Tabs */}
                <View style={styles.tabsContainer}>
                    <View style={styles.tabsBackground}>
                        {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
                            <TouchableOpacity
                                key={p}
                                style={[styles.tab, period === p && styles.activeTab]}
                                onPress={() => setPeriod(p)}
                            >
                                <Text style={[styles.tabText, period === p && styles.activeTabText]}>
                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Streak Card */}
                    {streak > 0 && (
                        <View style={styles.streakCard}>
                            <View style={styles.streakContent}>
                                <View style={styles.fireIconBg}>
                                    <Ionicons name="flame" size={24} color="#DC2626" />
                                </View>
                                <View>
                                    <Text style={styles.streakTitle}>{streak} Day Streak!</Text>
                                    <Text style={styles.streakSub}>You haven't spent anything for {streak} days.</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Insights Card */}
                    {isMonthly && insights && (
                        <View style={styles.insightCard}>
                            <View style={styles.insightHeader}>
                                <Ionicons name="bulb" size={20} color="#F59E0B" />
                                <Text style={styles.insightTitle}>Monthly Insights</Text>
                            </View>

                            {/* Total Trend */}
                            <Text style={styles.insightText}>
                                Spending is <Text style={{ fontWeight: '700', color: insights.monthDiff > 0 ? '#EF4444' : '#10B981' }}>
                                    {Math.abs(Math.round(insights.monthPercent))}% {insights.monthDiff > 0 ? 'higher' : 'lower'}
                                </Text> than last month.
                            </Text>

                            {/* Category Specific */}
                            {insights.topCategoryChange && insights.topCategoryChange.diff > 0 && (
                                <View style={styles.catInsight}>
                                    <View style={styles.catInsightIcon}>
                                        <Ionicons name="arrow-up" size={12} color="#EF4444" />
                                    </View>
                                    <Text style={styles.catInsightText}>
                                        <Text style={{ fontWeight: '600' }}>{insights.topCategoryChange.name}</Text> expense increased by <Text style={{ fontWeight: '700', color: '#EF4444' }}>{formatCurrency(insights.topCategoryChange.diff)}</Text>.
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Spend Patterns (New) */}
                    {isMonthly && patterns && (
                        <View style={styles.patternsContainer}>
                            <Text style={styles.sectionTitle}>Spending Patterns</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 24 }}>
                                {/* Weekend Card */}
                                <View style={[styles.patternCard, { backgroundColor: '#F0F9FF' }]}>
                                    <View style={styles.patternIconBg}>
                                        <Ionicons name="calendar" size={20} color="#0EA5E9" />
                                    </View>
                                    <Text style={styles.patternTitle}>Weekend Spend</Text>
                                    <Text style={styles.patternValue}>{formatCurrency(patterns.weekendTotal)}</Text>
                                    <Text style={styles.patternSub}>
                                        {patterns.weekendPercent > 40 ? 'High weekend activity' : 'Balanced with weekdays'}
                                    </Text>
                                </View>

                                {/* Small Spends Card */}
                                <View style={[styles.patternCard, { backgroundColor: '#FDF2F8' }]}>
                                    <View style={styles.patternIconBg}>
                                        <Ionicons name="cafe" size={20} color="#DB2777" />
                                    </View>
                                    <Text style={styles.patternTitle}>Micro Spends ({patterns.smallSpendsCount})</Text>
                                    <Text style={styles.patternValue}>{formatCurrency(patterns.smallSpendsTotal)}</Text>
                                    <Text style={styles.patternSub}>Small items under 100</Text>
                                </View>
                            </ScrollView>
                        </View>
                    )}

                    {/* Budget Card (Only visible for Monthly view if budget set) */}
                    {isMonthly && budget > 0 && (
                        <View style={styles.budgetCard}>
                            <View style={styles.budgetHeader}>
                                <Text style={styles.budgetTitle}>Monthly Budget</Text>
                                <Text style={[styles.budgetPercent, isOverBudget && { color: '#EF4444' }]}>
                                    {Math.round(budgetProgress)}% used
                                </Text>
                            </View>
                            <View style={styles.progressBarBg}>
                                <View style={[
                                    styles.progressBarFill,
                                    { width: `${Math.min(budgetProgress, 100)}%`, backgroundColor: isOverBudget ? '#EF4444' : '#4F46E5' }
                                ]} />
                            </View>
                            <View style={styles.budgetFooter}>
                                <Text style={styles.budgetInfo}>
                                    <Text style={{ fontWeight: '700', color: isOverBudget ? '#EF4444' : '#0F172A' }}>{formatCurrency(data.totalSpent)}</Text>
                                    <Text style={{ color: '#64748B' }}> / {formatCurrency(budget)}</Text>
                                </Text>
                                {isOverBudget ? (
                                    <View style={styles.warningTag}>
                                        <Ionicons name="alert-circle" size={14} color="#fff" />
                                        <Text style={styles.warningText}>Exceeded</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.remainingText}>{formatCurrency(Math.max(0, budget - data.totalSpent))} remaining</Text>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Summary Section */}
                    <View style={styles.summaryContainer}>
                        <Text style={styles.periodTitle}>{data.periodTitle} Overview</Text>

                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <View style={[styles.statIconBox, { backgroundColor: '#DCFCE7' }]}>
                                    <Ionicons name="arrow-down" size={16} color="#10B981" />
                                </View>
                                <Text style={styles.statLabel}>Income</Text>
                                <Text style={styles.statValueGreen}>{formatCurrency(data.totalIncome)}</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <View style={[styles.statIconBox, { backgroundColor: '#FEE2E2' }]}>
                                    <Ionicons name="arrow-up" size={16} color="#EF4444" />
                                </View>
                                <Text style={styles.statLabel}>Expense</Text>
                                <Text style={styles.statValueRed}>{formatCurrency(data.totalSpent)}</Text>
                            </View>
                        </View>

                        <View style={styles.balanceContainer}>
                            <Text style={styles.balanceLabel}>Balance</Text>
                            <Text style={styles.balanceValue}>{formatCurrency(data.balance)}</Text>
                        </View>
                    </View>

                    {/* Chart Section */}
                    {data.totalSpent > 0 ? (
                        <View style={styles.chartContainer}>
                            <PieChart
                                data={pieData}
                                donut
                                radius={110}
                                innerRadius={75}
                                backgroundColor="#fff"
                                centerLabelComponent={() => (
                                    <View style={{ alignItems: 'center' }}>
                                        <Text style={{ fontSize: 13, color: '#94A3B8', fontWeight: '500' }}>Total</Text>
                                        <View style={{ height: 4 }} />
                                        <Text style={{ fontSize: 20, fontWeight: '800', color: '#1E293B' }}>{formatCurrency(data.totalSpent).split('.')[0]}</Text>
                                    </View>
                                )}
                            />
                        </View>
                    ) : (
                        <View style={styles.emptyChart}>
                            <Ionicons name="pie-chart-outline" size={48} color="#CBD5E1" />
                            <Text style={{ color: '#94A3B8', marginTop: 12 }}>No data for this period</Text>
                        </View>
                    )}

                    {/* Breakdown List */}
                    <View style={styles.breakdownHeader}>
                        <Text style={styles.sectionTitle}>Top Categories</Text>
                    </View>

                    <View style={styles.listContainer}>
                        {data.breakdown.length === 0 ? (
                            <Text style={{ textAlign: 'center', color: '#94A3B8', padding: 24 }}>No expenses found.</Text>
                        ) : (
                            data.breakdown.map((item, index) => (
                                <View key={item.category}>
                                    <View style={styles.itemRow}>
                                        <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
                                            <Ionicons name={item.icon as any} size={20} color={item.color} />
                                        </View>
                                        <View style={styles.itemDetails}>
                                            <View style={styles.detailsHeader}>
                                                <Text style={styles.categoryName}>{item.category}</Text>
                                                <Text style={styles.itemAmount}>{formatCurrency(item.total)}</Text>
                                            </View>
                                            <View style={styles.progressBarBg}>
                                                <View style={[
                                                    styles.progressBarFill,
                                                    {
                                                        width: `${(item.total / data.totalSpent) * 100}%`,
                                                        backgroundColor: item.color
                                                    }
                                                ]} />
                                            </View>
                                            <Text style={styles.itemPercent}>{Math.round((item.total / data.totalSpent) * 100)}% of total</Text>
                                        </View>
                                    </View>
                                    {index < data.breakdown.length - 1 && <View style={styles.separator} />}
                                </View>
                            ))
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    tabsContainer: {
        paddingVertical: 16,
        paddingHorizontal: 24,
    },
    tabsBackground: {
        flexDirection: 'row',
        backgroundColor: '#E2E8F0',
        borderRadius: 16,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
    },
    activeTab: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    tabText: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#4F46E5',
        fontWeight: '600',
    },
    content: {
        padding: 24,
        paddingBottom: 40,
    },
    insightCard: {
        backgroundColor: '#FFF7ED', // Light Orange bg
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
        borderLeftWidth: 4,
        borderLeftColor: '#F59E0B',
    },
    insightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    insightTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#B45309',
    },
    insightText: {
        fontSize: 15,
        color: '#451A03',
        marginBottom: 12,
        lineHeight: 22,
    },
    catInsight: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        marginTop: 4,
    },
    catInsightIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    catInsightText: {
        flex: 1,
        fontSize: 13,
        color: '#1E293B',
    },
    patternsContainer: {
        marginBottom: 24,
    },
    patternCard: {
        width: 160,
        padding: 16,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        marginRight: 4,
    },
    patternIconBg: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    patternTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 4,
    },
    patternValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 4,
    },
    patternSub: {
        fontSize: 12,
        color: '#94A3B8',
        lineHeight: 16,
    },
    streakCard: {
        backgroundColor: '#FEF2F2',
        borderRadius: 20,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#FECaca',
    },
    streakContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    fireIconBg: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    streakTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#991B1B',
    },
    streakSub: {
        fontSize: 14,
        color: '#7F1D1D',
        marginTop: 2,
    },
    budgetCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 24,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    budgetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    budgetTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    budgetPercent: {
        fontSize: 14,
        fontWeight: '700',
        color: '#4F46E5',
    },
    budgetFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        alignItems: 'center',
    },
    budgetInfo: {
        fontSize: 14,
    },
    remainingText: {
        fontSize: 13,
        color: '#10B981',
        fontWeight: '600',
    },
    warningTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EF4444',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    warningText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    summaryContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    periodTitle: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 20,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statIconBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statLabel: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 4,
    },
    statValueGreen: {
        fontSize: 18,
        fontWeight: '700',
        color: '#10B981',
    },
    statValueRed: {
        fontSize: 18,
        fontWeight: '700',
        color: '#EF4444',
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: '#E2E8F0',
    },
    balanceContainer: {
        alignItems: 'center',
    },
    balanceLabel: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: '#64748B',
        marginBottom: 4,
    },
    balanceValue: {
        fontSize: 32,
        fontWeight: '800',
        color: '#0F172A',
    },
    chartContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    emptyChart: {
        height: 200,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        backgroundColor: '#fff',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
    },
    breakdownHeader: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    listContainer: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 8, // Inner padding for consistent spacing
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    itemDetails: {
        flex: 1,
    },
    detailsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    categoryName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
    itemAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
    },
    progressBarBg: {
        height: 6,
        backgroundColor: '#F1F5F9',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 6,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    itemPercent: {
        fontSize: 12,
        color: '#94A3B8',
        textAlign: 'right',
    },
    separator: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginHorizontal: 16,
    }
});
