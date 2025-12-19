
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Category, getCategories } from '../../src/db/categories';
import { addExpense, Expense, getExpenseById, getTodayExpenses, updateExpense } from '../../src/db/expenses';
import { getDailyLimit, getSetting, getTrackingPaused, setSetting } from '../../src/db/settings';
import { addTemplate, deleteTemplate, getTemplates, Template } from '../../src/db/templates';
import { formatCurrency } from '../../src/utils/format';
import { scanReceipt } from '../../src/utils/ReceiptScanner';

const QUICK_AMOUNTS = [50, 100, 200, 500];

export default function AddExpenseScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const editId = params.id ? Number(params.id) : null;

    const [type, setType] = useState<'expense' | 'income'>('expense');
    const [amount, setAmount] = useState('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [category, setCategory] = useState('');
    const [note, setNote] = useState('');
    const [location, setLocation] = useState('');
    const [isExcluded, setIsExcluded] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    const handleScanReceipt = async () => {
        setIsScanning(true);
        try {
            // Document Scanner (Camera + Auto Crop)
            const { scannedImages } = await DocumentScanner.scanDocument({
                maxNumDocuments: 1
            });

            if (scannedImages && scannedImages.length > 0) {
                const uri = scannedImages[0];
                processScannedImage(uri);
            } else {
                setIsScanning(false);
            }
        } catch (e) {
            // Fallback for Simulator or if Scanner fails
            console.log("Scanner failed, trying picker", e);
            try {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission needed', 'Please allow access to photos.');
                    setIsScanning(false);
                    return;
                }

                const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    quality: 1,
                });

                if (!result.canceled && result.assets[0].uri) {
                    processScannedImage(result.assets[0].uri);
                } else {
                    setIsScanning(false);
                }
            } catch (err) {
                console.error(err);
                setIsScanning(false);
                Alert.alert('Error', 'Could not scan or pick image.');
            }
        }
    };

    const processScannedImage = async (uri: string) => {
        try {
            const scanData = await scanReceipt(uri);

            if (scanData.amount) setAmount(scanData.amount.toString());

            // Auto-detected Category
            if (scanData.category) {
                setCategory(scanData.category);
            }

            if (scanData.merchant) {
                const merchant = scanData.merchant;
                setNote(merchant);
            }

            // Append full text - PREFER the Spatially Formatted text
            // This ensures lines appear as distinct rows (Visual Layout)
            const textToUse = scanData.formattedText || scanData.text;

            if (textToUse) {
                setNote(prev => {
                    const separator = prev ? '\n\n--- Receipt Details ---\n' : '';
                    return `${prev}${separator}${textToUse}`;
                });
            }

            // Handle Items
            if (scanData.items && scanData.items.length > 0) {
                const mappedItems = scanData.items.map(item => ({
                    name: item.qty && item.qty > 1 ? `(${item.qty}x) ${item.name}` : item.name,
                    amount: item.amount.toString(),
                    unit: item.unit || ''
                }));
                // Combine with existing items if any?? For now overwrite or append?
                // setRequests overwrite usually for a fresh scan
                setItems(mappedItems);
            }

            // Handle Tax
            if (scanData.tax) {
                setNote(prev => `${prev} (Tax: ${scanData.tax})`);
            }

            const itemsFound = scanData.items ? scanData.items.length : 0;
            Alert.alert(
                'AI Scan Complete! 🤖',
                `Amount: ${scanData.amount || '?'}\nCategory: ${scanData.category || 'Unknown'}\nItems: ${itemsFound}`
            );
        } catch (e) {
            Alert.alert('Scan Failed', 'Could not read receipt.');
        } finally {
            setIsScanning(false);
        }
    };

    // Itemized Expenses
    const [items, setItems] = useState<{ name: string, amount: string, unit: string }[]>([]);
    const [newItemName, setNewItemName] = useState('');
    const [newItemAmount, setNewItemAmount] = useState('');
    const [newItemUnit, setNewItemUnit] = useState('');

    // Templates
    const [templates, setTemplates] = useState<Template[]>([]);
    const [saveAsTemplate, setSaveAsTemplate] = useState(false);

    const LOCATION_SUGGESTIONS = ["Home", "Office", "Market", "Travel"];

    // Load data for editing
    useEffect(() => {
        if (editId) {
            const expense = getExpenseById(editId);
            if (expense) {
                setType(expense.type);
                setAmount(expense.amount.toString());
                setCategory(expense.category);
                setNote(expense.note || '');
                setLocation(expense.location || '');
                setIsExcluded(expense.is_excluded === 1);

                if (expense.items && expense.items.length > 0) {
                    setItems(expense.items.map(i => ({ name: i.name, amount: i.amount.toString(), unit: i.unit || '' })));
                }
            }
        } else {
            // Check if global tracking is paused
            if (getTrackingPaused()) {
                setIsExcluded(true);
            }
        }
    }, [editId]);

    // ... existing loadData ...

    const handleAddItem = () => {
        if (!newItemName || !newItemAmount) {
            Alert.alert("Incomplete", "Please enter item name and amount");
            return;
        }
        const amt = Number(newItemAmount);
        if (isNaN(amt) || amt <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid amount");
            return;
        }

        const updatedItems = [...items, { name: newItemName, amount: newItemAmount, unit: newItemUnit }];
        setItems(updatedItems);
        setNewItemName('');
        setNewItemAmount('');
        setNewItemUnit('');

        // Auto-update total amount
        const total = updatedItems.reduce((sum, item) => sum + Number(item.amount), 0);
        setAmount(total.toString());
    };

    const handleDeleteItem = (index: number) => {
        const updatedItems = items.filter((_, i) => i !== index);
        setItems(updatedItems);

        // Auto-update total amount
        if (updatedItems.length > 0) {
            const total = updatedItems.reduce((sum, item) => sum + Number(item.amount), 0);
            setAmount(total.toString());
        }
    };


    const loadData = useCallback(() => {
        const cats = getCategories(type);
        setCategories(cats);

        // Load Templates
        const temps = getTemplates(type);
        setTemplates(temps);

        if (!editId) {
            // Smart Default: Load last used category (ONLY if not editing)
            const lastUsed = getSetting(`last_cat_${type}`);

            if (cats.length > 0) {
                setCategory(prev => {
                    const exists = cats.find(c => c.name === lastUsed);
                    if (exists) return lastUsed!;
                    return cats[0].name; // Fallback
                });
            }
        }
    }, [type, editId]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const handleTypeChange = (newType: 'expense' | 'income') => {
        setType(newType);
        // loadData will trigger due to dependency change
    };

    const handleTemplatePress = async (template: Template) => {
        try {
            await addExpense(
                template.amount,
                template.category,
                template.note || '',
                new Date().toISOString().split('T')[0],
                template.type
            );
            Alert.alert('Saved!', `Added ${template.name} (${formatCurrency(template.amount)})`);
            router.replace('/(tabs)');
        } catch (e) {
            Alert.alert('Error', 'Failed to quick add');
        }
    };

    const handleDeleteTemplate = async (id: number) => {
        Alert.alert('Delete Template', 'Remove this shortcut?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await deleteTemplate(id);
                    loadData();
                }
            }
        ]);
    };

    const performSave = async () => {
        try {
            if (editId) {
                await updateExpense(
                    editId,
                    Number(amount),
                    category,
                    note,
                    new Date().toISOString().split('T')[0],
                    type,
                    isExcluded,
                    location
                );
            } else {
                await addExpense(
                    Number(amount),
                    category,
                    note,
                    new Date().toISOString().split('T')[0],
                    type,
                    isExcluded,
                    location
                );

                if (saveAsTemplate) {
                    await addTemplate(
                        note || category,
                        Number(amount),
                        category,
                        note || '',
                        type
                    );
                }
            }

            setSetting(`last_cat_${type}`, category);
            setAmount('');
            setNote('');
            setLocation('');
            setIsExcluded(false);
            setSaveAsTemplate(false);
            Keyboard.dismiss();
            router.back();
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to save expense');
        }
    };

    const handleSave = async () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount.');
            return;
        }

        const newAmount = Number(amount);

        // Check Daily Limit (Only for Expenses)
        if (type === 'expense') {
            const limit = getDailyLimit();
            if (limit > 0) {
                const todayExpenses = getTodayExpenses();
                // Exclude current expense if editing
                const currentTotal = todayExpenses
                    .filter((e: Expense) => e.type === 'expense' && e.id !== (editId || -1))
                    .reduce((sum: number, e: Expense) => sum + e.amount, 0);

                if (currentTotal + newAmount > limit) {
                    Alert.alert(
                        "Daily Limit Exceeded",
                        `You are about to exceed your daily limit of ${limit}. Proceed?`,
                        [
                            { text: "Cancel", style: "cancel" },
                            { text: "Yes, I know", onPress: performSave }
                        ]
                    );
                    return;
                }
            }
        }

        performSave();
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>{editId ? 'Edit Transaction' : 'New Transaction'}</Text>
                    </View>

                    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                        {/* Type Toggle */}
                        <View style={styles.toggleContainer}>
                            <TouchableOpacity
                                style={[styles.toggleBtn, type === 'expense' && styles.toggleBtnActive]}
                                onPress={() => handleTypeChange('expense')}
                            >
                                <Text style={[styles.toggleText, type === 'expense' && styles.toggleTextActive]}>Expense</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleBtn, type === 'income' && styles.toggleBtnActiveIncome]}
                                onPress={() => handleTypeChange('income')}
                            >
                                <Text style={[styles.toggleText, type === 'income' && styles.toggleTextActive]}>Income</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Templates (Quick Add) - Only for Expenses & New Entry */}
                        {!editId && type === 'expense' && templates.length > 0 && (
                            <View style={styles.templatesContainer}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 8 }}>QUICK ADD</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {templates.map((temp) => (
                                        <TouchableOpacity
                                            key={temp.id}
                                            style={styles.templateChip}
                                            onPress={() => handleTemplatePress(temp)}
                                            onLongPress={() => handleDeleteTemplate(temp.id)}
                                        >
                                            <Ionicons name="flash" size={12} color="#fff" style={{ marginRight: 4 }} />
                                            <Text style={styles.templateChipText}>{temp.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Amount Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.currencySymbol}>₹</Text>
                            <TextInput
                                style={[styles.amountInput, type === 'income' && { color: '#10B981' }]}
                                placeholder="0"
                                placeholderTextColor="#CBD5E1"
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={setAmount}
                                autoFocus={!editId}
                            />
                            {isScanning ? (
                                <ActivityIndicator size="small" color="#4F46E5" style={{ marginLeft: 10 }} />
                            ) : (
                                <TouchableOpacity onPress={handleScanReceipt} style={styles.scanBtn}>
                                    <Ionicons name="scan" size={24} color="#4F46E5" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Quick Amounts */}
                        <View style={styles.quickAmounts}>
                            {QUICK_AMOUNTS.map((amt) => (
                                <TouchableOpacity key={amt} style={styles.quickBtn} onPress={() => setAmount(amt.toString())}>
                                    <Text style={styles.quickBtnText}>+{amt}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.divider} />

                        {/* Categories */}
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionLabel}>Category</Text>
                            <TouchableOpacity onPress={() => router.push('/manage_categories')}>
                                <Text style={styles.linkText}>Edit</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.categoryGrid}>
                            {categories.map(cat => {
                                const isSelected = category === cat.name;
                                return (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[
                                            styles.categoryItem,
                                            isSelected && styles.categoryItemActive,
                                            isSelected && { backgroundColor: cat.color + '10', borderColor: cat.color }
                                        ]}
                                        onPress={() => setCategory(cat.name)}
                                    >
                                        <View style={[
                                            styles.iconCircle,
                                            { backgroundColor: isSelected ? cat.color : '#F1F5F9' }
                                        ]}>
                                            <Ionicons
                                                name={cat.icon as any}
                                                size={22}
                                                color={isSelected ? '#fff' : '#64748B'}
                                            />
                                        </View>
                                        <Text style={[
                                            styles.categoryText,
                                            isSelected && { color: cat.color, fontWeight: '700' }
                                        ]} numberOfLines={1}>{cat.name}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>


                        {/* Note */}
                        <Text style={styles.sectionLabel}>Note</Text>
                        <TextInput
                            style={[styles.noteInput, { textAlignVertical: 'top', minHeight: 100 }]}
                            placeholder="Add a note... (optional)"
                            placeholderTextColor="#94A3B8"
                            value={note}
                            onChangeText={setNote}
                            multiline={true}
                            numberOfLines={4}
                        />

                        {/* Location Input (New) */}
                        <Text style={styles.sectionLabel}>Location</Text>
                        <View style={{ marginBottom: 20 }}>
                            <TextInput
                                style={styles.input}
                                placeholder="Where did you spend?"
                                value={location}
                                onChangeText={setLocation}
                            />
                            {/* Location Chips */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                                {LOCATION_SUGGESTIONS.map((loc) => (
                                    <TouchableOpacity
                                        key={loc}
                                        style={[
                                            styles.optionChip,
                                            location === loc && { backgroundColor: '#E0F2FE', borderColor: '#3B82F6' }
                                        ]}
                                        onPress={() => setLocation(loc)}
                                    >
                                        <Text style={[
                                            styles.optionChipText,
                                            location === loc && { color: '#3B82F6', fontWeight: '600' }
                                        ]}>{loc}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Itemized Expenses (New) */}
                        <Text style={styles.sectionLabel}>Items (Optional)</Text>
                        <View style={styles.itemsContainer}>
                            {items.map((item, index) => (
                                <View key={index} style={styles.itemRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.itemName}>{item.name}</Text>
                                        {item.unit ? <Text style={{ fontSize: 12, color: '#64748B' }}>{item.unit}</Text> : null}
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={styles.itemAmount}>{formatCurrency(Number(item.amount))}</Text>
                                        <TouchableOpacity onPress={() => handleDeleteItem(index)} style={{ marginLeft: 12 }}>
                                            <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}

                            <View style={styles.addItemRow}>
                                <TextInput
                                    style={[styles.input, { flex: 2, marginRight: 8 }]}
                                    placeholder="Item (e.g. Rice)"
                                    value={newItemName}
                                    onChangeText={setNewItemName}
                                />
                                <TextInput
                                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                                    placeholder="Unit"
                                    value={newItemUnit}
                                    onChangeText={setNewItemUnit}
                                />
                                <TextInput
                                    style={[styles.input, { width: 70, marginRight: 8 }]}
                                    placeholder="Amt"
                                    keyboardType="numeric"
                                    value={newItemAmount}
                                    onChangeText={setNewItemAmount}
                                />
                                <TouchableOpacity style={styles.addItemBtn} onPress={handleAddItem}>
                                    <Ionicons name="add" size={24} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Save as Template Option */}
                        {
                            !editId && (
                                <>
                                    <View style={styles.optionRow}>
                                        <Text style={styles.optionLabel}>Save as Template</Text>
                                        <Switch
                                            value={saveAsTemplate}
                                            onValueChange={setSaveAsTemplate}
                                            trackColor={{ false: '#E2E8F0', true: '#818CF8' }}
                                            thumbColor={saveAsTemplate ? '#4F46E5' : '#f4f3f4'}
                                        />
                                    </View>

                                    <View style={[styles.optionRow, { marginTop: 12 }]}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.optionLabel}>Exclude from Reports</Text>
                                            <Text style={{ fontSize: 12, color: '#94A3B8' }}>Won't count in analysis</Text>
                                        </View>
                                        <Switch
                                            value={isExcluded}
                                            onValueChange={setIsExcluded}
                                            trackColor={{ false: '#E2E8F0', true: '#F87171' }}
                                            thumbColor={isExcluded ? '#EF4444' : '#f4f3f4'}
                                        />
                                    </View>
                                </>
                            )
                        }

                        <View style={{ height: 120 }} />
                    </ScrollView >

                    {/* Save Button */}
                    < View style={styles.footer} >
                        <TouchableOpacity
                            style={[styles.saveBtn, type === 'income' && { backgroundColor: '#10B981', shadowColor: '#10B981' }]}
                            onPress={handleSave}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.saveBtnText}>{editId ? 'Update' : 'Save'} {type === 'expense' ? 'Expense' : 'Income'}</Text>
                        </TouchableOpacity>
                    </View >
                </KeyboardAvoidingView >
            </SafeAreaView >
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    content: {
        padding: 24,
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        padding: 4,
        marginBottom: 24,
    },
    toggleBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 12,
    },
    toggleBtnActive: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    toggleBtnActiveIncome: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    toggleText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    toggleTextActive: {
        color: '#0F172A',
    },
    inputContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 24,
    },
    currencySymbol: {
        fontSize: 40,
        fontWeight: '700',
        color: '#94A3B8',
        marginRight: 8,
    },
    amountInput: {
        fontSize: 56,
        fontWeight: '800',
        color: '#0F172A',
        minWidth: 100,
        textAlign: 'center',
    },
    scanBtn: {
        padding: 12,
        backgroundColor: '#E0E7FF',
        borderRadius: 20,
        marginLeft: 12,
    },
    quickAmounts: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 32,
    },
    quickBtn: {
        backgroundColor: '#F1F5F9',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    quickBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginBottom: 32,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
    },
    linkText: {
        fontSize: 14,
        color: '#4F46E5',
        fontWeight: '600',
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 32,
    },
    categoryItem: {
        width: '23%',
        alignItems: 'center',
        marginBottom: 16,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    categoryItemActive: {
        // dynamic bg and border
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    categoryText: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
        textAlign: 'center',
    },
    noteInput: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 20,
        fontSize: 16,
        color: '#1E293B',
        minHeight: 60,
    },
    footer: {
        padding: 24,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        backgroundColor: '#fff',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    saveBtn: {
        backgroundColor: '#4F46E5', // Indigo 600
        paddingVertical: 18,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 16,
    },
    optionLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0F172A',
    },
    optionChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: 'transparent',
        marginRight: 8,
    },
    optionChipText: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
    templatesContainer: {
        marginBottom: 20,
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#1E293B',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    sectionLabelSmall: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 8,
        marginLeft: 4,
    },
    templatesList: {
        gap: 8,
        paddingHorizontal: 4,
    },
    templateChip: {
        backgroundColor: '#E0E7FF',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginRight: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemsContainer: {
        marginBottom: 24,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    itemName: {
        fontSize: 16,
        color: '#334155',
        fontWeight: '500',
    },
    itemAmount: {
        fontSize: 16,
        color: '#0F172A',
        fontWeight: '600',
    },
    addItemRow: {
        flexDirection: 'row',
        marginTop: 12,
    },
    addItemBtn: {
        backgroundColor: '#4F46E5',
        width: 48,
        height: 52, // match input height approx
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    templateChipText: {
        color: '#4338CA',
        fontWeight: '600',
        fontSize: 13,
    },
    templateName: {
        color: '#4338CA',
        fontWeight: '600',
        fontSize: 13,
    },
    templateAmount: {
        color: '#6366F1',
        fontSize: 12,
        marginTop: 2,
    },
    templateOption: {
        marginTop: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 16,
    },
    templateLabel: {
        fontSize: 15,
        color: '#334155',
        fontWeight: '500',
    }
});
