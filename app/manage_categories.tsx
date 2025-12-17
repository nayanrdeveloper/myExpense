import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addCategory, Category, deleteCategory, getCategories } from '../src/db/categories';

const COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];
const ICONS = ['fast-food', 'car', 'home', 'cart', 'flash', 'game-controller', 'shirt', 'school', 'medical', 'construct', 'paw', 'airplane'];

export default function ManageCategoriesScreen() {
    const router = useRouter();
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [newName, setNewName] = useState('');
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);
    const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);

    const loadCategories = useCallback(() => {
        const data = getCategories(activeTab);
        setCategories(data);
    }, [activeTab]);

    useFocusEffect(
        useCallback(() => {
            loadCategories();
        }, [loadCategories])
    );

    const handleAdd = async () => {
        if (!newName.trim()) {
            Alert.alert('Error', 'Please enter a category name');
            return;
        }
        try {
            await addCategory(newName, selectedIcon, selectedColor, activeTab);
            setModalVisible(false);
            setNewName('');
            loadCategories();
        } catch (e) {
            Alert.alert('Error', 'Could not add category. Name might be duplicate.');
        }
    };

    const handleDelete = (id: number, isDefault: number) => {
        if (isDefault) {
            Alert.alert('Cannot Delete', 'Default categories cannot be deleted.');
            return;
        }
        Alert.alert('Delete Category', 'This will remove it from the list.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    await deleteCategory(id);
                    loadCategories();
                }
            }
        ]);
    };

    const renderItem = ({ item }: { item: Category }) => (
        <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
                <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                </View>
                <Text style={styles.itemName}>{item.name}</Text>
            </View>
            {!item.is_default && (
                <TouchableOpacity onPress={() => handleDelete(item.id, item.is_default)}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Manage Categories</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'expense' && styles.activeTab]}
                        onPress={() => setActiveTab('expense')}
                    >
                        <Text style={[styles.tabText, activeTab === 'expense' && styles.activeTabText]}>Expenses</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'income' && styles.activeTab]}
                        onPress={() => setActiveTab('income')}
                    >
                        <Text style={[styles.tabText, activeTab === 'income' && styles.activeTabText]}>Income</Text>
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={categories}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.list}
                />

                <View style={styles.fabContainer}>
                    <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
                        <Ionicons name="add" size={28} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Add Modal */}
                <Modal visible={modalVisible} animationType="slide" transparent>
                    <View style={styles.modalBg}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>New {activeTab === 'expense' ? 'Expense' : 'Income'} Category</Text>

                            <TextInput
                                style={styles.input}
                                placeholder="Category Name"
                                placeholderTextColor="#94A3B8"
                                value={newName}
                                onChangeText={setNewName}
                            />

                            <Text style={styles.label}>Select Color</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorScroll}>
                                {COLORS.map(c => (
                                    <TouchableOpacity
                                        key={c}
                                        style={[styles.colorCircle, { backgroundColor: c }, selectedColor === c && styles.selectedCircle]}
                                        onPress={() => setSelectedColor(c)}
                                    />
                                ))}
                            </ScrollView>

                            <Text style={styles.label}>Select Icon</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorScroll}>
                                {ICONS.map(i => (
                                    <TouchableOpacity
                                        key={i}
                                        style={[styles.iconCircle, selectedIcon === i && styles.selectedCircle]}
                                        onPress={() => setSelectedIcon(i)}
                                    >
                                        <Ionicons name={i as any} size={24} color={selectedIcon === i ? '#4F46E5' : '#64748B'} />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
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
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    tabContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12
    },
    tab: {
        flex: 1,
        padding: 12,
        backgroundColor: '#E2E8F0',
        borderRadius: 12,
        alignItems: 'center'
    },
    activeTab: { backgroundColor: '#4F46E5' },
    tabText: { fontWeight: '600', color: '#64748B' },
    activeTabText: { color: '#fff' },
    list: { padding: 16 },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1
    },
    itemLeft: { flexDirection: 'row', alignItems: 'center' },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    itemName: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
    fabContainer: {
        position: 'absolute',
        bottom: 32,
        right: 24,
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#4F46E5',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6
    },
    modalBg: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
    input: {
        backgroundColor: '#F1F5F9',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
        fontSize: 16
    },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 12, color: '#64748B' },
    selectorScroll: { marginBottom: 24, flexDirection: 'row' },
    colorCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
        borderWidth: 2,
        borderColor: 'transparent'
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        borderWidth: 2,
        borderColor: 'transparent'
    },
    selectedCircle: { borderColor: '#0F172A' },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 12 },
    cancelBtn: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center' },
    cancelBtnText: { fontWeight: '600', color: '#64748B' },
    saveBtn: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: '#4F46E5', alignItems: 'center' },
    saveBtnText: { fontWeight: '600', color: '#fff' }
});
