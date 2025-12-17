import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addBill, Bill, deleteBill, getBills, markBillAsPaid } from '../../src/db/bills';
import { formatCurrency } from '../../src/utils/format';

export default function BillsScreen() {
    const [bills, setBills] = useState<Bill[]>([]);
    const [modalVisible, setModalVisible] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [frequency, setFrequency] = useState<'once' | 'monthly' | 'yearly'>('monthly'); // Default to monthly for subs

    const loadBills = useCallback(() => {
        const data = getBills();
        setBills(data);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadBills();
        }, [loadBills])
    );

    const handleAddBill = async () => {
        if (!name || !amount || !dueDate) {
            Alert.alert('Error', 'Please fill all fields');
            return;
        }
        await addBill(name, Number(amount), dueDate, frequency);
        setModalVisible(false);
        resetForm();
        loadBills();
    };

    const resetForm = () => {
        setName('');
        setAmount('');
        setDueDate('');
        setFrequency('monthly');
    };

    const handlePay = async (bill: Bill) => {
        // Confirm before paying
        Alert.alert(
            'Mark as Paid?',
            `This will add an expense of ${formatCurrency(bill.amount)} and ${bill.frequency !== 'once' ? 'update the due date' : 'mark it as complete'}.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        await markBillAsPaid(bill);
                        loadBills();
                        Alert.alert('Success', 'Payment recorded!');
                    }
                }
            ]
        );
    };

    const handleDelete = (id: number) => {
        Alert.alert('Delete Subscription', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    await deleteBill(id);
                    loadBills();
                }
            }
        ]);
    };

    const getDaysLeft = (dateStr: string) => {
        const today = new Date();
        const due = new Date(dateStr);
        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const renderItem = ({ item }: { item: Bill }) => {
        const daysLeft = getDaysLeft(item.due_date);
        const isPaid = item.is_paid === 1;

        let statusColor = '#64748B';
        let statusText = `${daysLeft} days left`;

        if (isPaid) {
            statusColor = '#10B981'; // Emerald 500
            statusText = 'Paid';
        } else if (daysLeft < 0) {
            statusColor = '#EF4444'; // Red 500
            statusText = `Overdue by ${Math.abs(daysLeft)} days`;
        } else if (daysLeft === 0) {
            statusColor = '#F59E0B'; // Amber 500
            statusText = 'Due Today';
        } else if (daysLeft <= 3) {
            statusColor = '#F59E0B';
        }

        return (
            <TouchableOpacity
                style={styles.card}
                onLongPress={() => handleDelete(item.id)}
                activeOpacity={0.9}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.iconBox}>
                        <Ionicons name={item.frequency === 'monthly' ? "calendar" : item.frequency === 'yearly' ? "calendar-number" : "receipt"} size={20} color="#4F46E5" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.billName}>{item.name}</Text>
                        <Text style={[styles.billStatus, { color: statusColor }]}>
                            {statusText} • {(item.frequency || 'once').charAt(0).toUpperCase() + (item.frequency || 'once').slice(1)}
                        </Text>
                    </View>
                    <Text style={styles.billAmount}>{formatCurrency(item.amount)}</Text>
                </View>

                {!isPaid && (
                    <View style={styles.cardFooter}>
                        <Text style={styles.dueDate}>Due: {item.due_date}</Text>
                        <TouchableOpacity
                            style={styles.payBtn}
                            onPress={() => handlePay(item)}
                        >
                            <Text style={styles.payBtnText}>Pay Now</Text>
                            <Ionicons name="arrow-forward" size={14} color="#fff" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Subscriptions</Text>
                    <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
                        <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={bills}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="infinite" size={48} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No active subscriptions</Text>
                        </View>
                    }
                />

                <Modal visible={modalVisible} animationType="slide" transparent>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>New Subscription</Text>

                            <TextInput
                                style={styles.input}
                                placeholder="Name (e.g. Netflix)"
                                placeholderTextColor="#94A3B8"
                                value={name}
                                onChangeText={setName}
                            />

                            <TextInput
                                style={styles.input}
                                placeholder="Amount"
                                placeholderTextColor="#94A3B8"
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={setAmount}
                            />

                            <TextInput
                                style={styles.input}
                                placeholder="Next Due Date (YYYY-MM-DD)"
                                placeholderTextColor="#94A3B8"
                                value={dueDate}
                                onChangeText={setDueDate}
                            />

                            <View style={styles.freqContainer}>
                                <Text style={styles.freqLabel}>Frequency:</Text>
                                <View style={styles.freqOptions}>
                                    {(['once', 'monthly', 'yearly'] as const).map(f => (
                                        <TouchableOpacity
                                            key={f}
                                            style={[styles.freqChip, frequency === f && styles.freqChipActive]}
                                            onPress={() => setFrequency(f)}
                                        >
                                            <Text style={[styles.freqText, frequency === f && styles.freqTextActive]}>
                                                {f.charAt(0).toUpperCase() + f.slice(1)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.saveBtn} onPress={handleAddBill}>
                                    <Text style={styles.saveBtnText}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F172A',
    },
    addBtn: {
        backgroundColor: '#4F46E5',
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    list: {
        padding: 24,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    billName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
    billStatus: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    billAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 12,
    },
    dueDate: {
        fontSize: 12,
        color: '#64748B',
    },
    payBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E293B',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    payBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 64,
    },
    emptyText: {
        color: '#94A3B8',
        marginTop: 12,
        fontSize: 16,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 24,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 24,
        textAlign: 'center',
    },
    input: {
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        fontSize: 16,
        color: '#0F172A',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    freqContainer: {
        marginBottom: 24,
    },
    freqLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 8,
    },
    freqOptions: {
        flexDirection: 'row',
        gap: 8,
    },
    freqChip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    freqChipActive: {
        backgroundColor: '#EEF2FF',
        borderColor: '#818CF8',
    },
    freqText: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '500',
    },
    freqTextActive: {
        color: '#4F46E5',
        fontWeight: '600',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    cancelBtn: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
    },
    cancelBtnText: {
        color: '#64748B',
        fontWeight: '600',
    },
    saveBtn: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#4F46E5',
        alignItems: 'center',
    },
    saveBtnText: {
        color: '#fff',
        fontWeight: '600',
    }
});
