import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Expense, getExpensesForMonth } from '../src/db/expenses';
import { formatCurrency } from '../src/utils/format';
import { getCategoryColor, getCategoryIcon } from '@/src/utils/categories';

export default function CalendarViewScreen() {
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [viewDate, setViewDate] = useState(new Date()); // For month navigation
    const [monthExpenses, setMonthExpenses] = useState<Expense[]>([]);
    const [selectedDayExpenses, setSelectedDayExpenses] = useState<Expense[]>([]);

    const loadData = useCallback(() => {
        const expenses = getExpensesForMonth(viewDate.getFullYear(), viewDate.getMonth());
        setMonthExpenses(expenses);
    }, [viewDate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Update selected expenses when date or data changes
    useEffect(() => {
        const dateStr = selectedDate.toISOString().split('T')[0];
        const dayExpenses = monthExpenses.filter(e => e.date === dateStr);
        setSelectedDayExpenses(dayExpenses);
    }, [selectedDate, monthExpenses]);

    const changeMonth = (increment: number) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + increment, 1);
        setViewDate(newDate);
    };

    const renderCalendarGrid = () => {
        const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
        const firstDayOfWeek = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

        const days = [];
        // Empty slots for start
        for (let i = 0; i < firstDayOfWeek; i++) {
            days.push(null);
        }
        // Real days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }

        return (
            <View style={styles.calendarGrid}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <Text key={d} style={styles.weekDayText}>{d}</Text>
                ))}
                {days.map((day, index) => {
                    if (day === null) return <View key={`empty-${index}`} style={styles.dayCell} />;

                    const dateStr = new Date(viewDate.getFullYear(), viewDate.getMonth(), day).toISOString().split('T')[0];
                    const hasExpense = monthExpenses.some(e => e.date === dateStr);
                    const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === viewDate.getMonth() && selectedDate.getFullYear() === viewDate.getFullYear();
                    const isToday = new Date().getDate() === day && new Date().getMonth() === viewDate.getMonth() && new Date().getFullYear() === viewDate.getFullYear();

                    return (
                        <TouchableOpacity
                            key={day}
                            style={[
                                styles.dayCell,
                                isSelected && styles.selectedDay,
                                isToday && !isSelected && styles.todayCell
                            ]}
                            onPress={() => setSelectedDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), day))}
                        >
                            <Text style={[
                                styles.dayText,
                                isSelected && styles.selectedDayText,
                                isToday && !isSelected && styles.todayText
                            ]}>{day}</Text>
                            {hasExpense && (
                                <View style={[styles.dot, isSelected && { backgroundColor: '#fff' }]} />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        );
    };

    const renderExpenseItem = ({ item }: { item: Expense }) => (
        <View style={styles.expenseItem}>
            <View style={[styles.iconContainer, { backgroundColor: getCategoryColor(item.category) + '15' }]}>
                <Ionicons name={getCategoryIcon(item.category) as any} size={20} color={getCategoryColor(item.category)} />
            </View>
            <View style={styles.expenseDetails}>
                <Text style={styles.expenseCategory}>{item.category}</Text>
                {item.note ? <Text style={styles.expenseNote} numberOfLines={1}>{item.note}</Text> : null}
            </View>
            <Text style={[styles.expenseAmount, item.type === 'income' && { color: '#10B981' }]}>
                {item.type === 'expense' ? '-' : '+'} {formatCurrency(item.amount)}
            </Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={{ flex: 1 }}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#1E293B" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Calendar View</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Month Navigator */}
                <View style={styles.monthNav}>
                    <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navBtn}>
                        <Ionicons name="chevron-back" size={24} color="#4F46E5" />
                    </TouchableOpacity>
                    <Text style={styles.monthTitle}>
                        {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </Text>
                    <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navBtn}>
                        <Ionicons name="chevron-forward" size={24} color="#4F46E5" />
                    </TouchableOpacity>
                </View>

                {/* Calendar */}
                <View style={styles.calendarContainer}>
                    {renderCalendarGrid()}
                </View>

                {/* Selected Day Details */}
                <View style={styles.detailsContainer}>
                    <Text style={styles.detailsTitle}>
                        {selectedDate.toLocaleDateString('default', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </Text>
                    {selectedDayExpenses.length > 0 ? (
                        <FlatList
                            data={selectedDayExpenses}
                            renderItem={renderExpenseItem}
                            keyExtractor={item => item.id.toString()}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                        />
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No expenses for this day</Text>
                        </View>
                    )}
                </View>

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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#fff',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1E293B',
    },
    backBtn: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
    },
    monthNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    monthTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#334155',
    },
    navBtn: {
        padding: 8,
    },
    calendarContainer: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingBottom: 24,
        marginBottom: 8,
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    weekDayText: {
        width: '14.28%',
        textAlign: 'center',
        fontSize: 12,
        fontWeight: '600',
        color: '#94A3B8',
        marginBottom: 8,
    },
    dayCell: {
        width: '14.28%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
        borderRadius: 20,
    },
    selectedDay: {
        backgroundColor: '#4F46E5',
    },
    todayCell: {
        borderWidth: 1,
        borderColor: '#4F46E5',
    },
    dayText: {
        fontSize: 14,
        color: '#334155',
    },
    selectedDayText: {
        color: '#fff',
        fontWeight: '600',
    },
    todayText: {
        color: '#4F46E5',
        fontWeight: '600',
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#EF4444',
        marginTop: 2,
    },
    detailsContainer: {
        flex: 1,
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
    },
    detailsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 16,
    },
    listContent: {
        paddingBottom: 20,
    },
    expenseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    expenseDetails: {
        flex: 1,
    },
    expenseCategory: {
        fontSize: 15,
        fontWeight: '500',
        color: '#334155',
    },
    expenseNote: {
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 2,
    },
    expenseAmount: {
        fontSize: 15,
        fontWeight: '600',
        color: '#EF4444',
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 40,
    },
    emptyText: {
        color: '#94A3B8',
        fontSize: 14,
    },
});
