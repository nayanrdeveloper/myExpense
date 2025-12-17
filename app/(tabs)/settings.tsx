import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Keyboard, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDailyLimit, getMonthlyBudget, getTrackingPaused, setDailyLimit as saveDailyLimit, setMonthlyBudget as saveMonthlyBudget, setTrackingPaused as saveTrackingPaused } from '../../src/db/settings';

export default function SettingsScreen() {
    const [budget, setBudget] = useState('');
    const [dailyLimit, setDailyLimit] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isTrackingPaused, setIsTrackingPaused] = useState(false);

    useFocusEffect(
        useCallback(() => {
            const saved = getMonthlyBudget();
            if (saved > 0) setBudget(saved.toString());
            const savedLimit = getDailyLimit();
            if (savedLimit > 0) setDailyLimit(savedLimit.toString());
            setIsTrackingPaused(getTrackingPaused());
        }, [])
    );

    const handleSaveBudget = () => {
        const val = Number(budget);
        if (!isNaN(val) && val >= 0) {
            saveMonthlyBudget(val);
            Keyboard.dismiss();
            Alert.alert("Success", "Monthly budget updated!");
        } else {
            Alert.alert("Invalid input", "Please enter a valid number");
        }
    };

    const handleSaveDailyLimit = () => {
        const val = Number(dailyLimit);
        if (!isNaN(val) && val >= 0) {
            saveDailyLimit(val);
            Keyboard.dismiss();
            Alert.alert("Success", "Daily limit updated!");
        } else {
            Alert.alert("Invalid input", "Please enter a valid number");
        }
    };

    const handleTogglePause = (val: boolean) => {
        setIsTrackingPaused(val);
        saveTrackingPaused(val);
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Settings</Text>
                </View>

                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>

                    {/* Pause Tracking Section */}
                    <Text style={styles.sectionHeader}>Modes</Text>
                    <View style={styles.card}>
                        <View style={styles.settingRow}>
                            <View style={styles.rowLeft}>
                                <View style={[styles.iconBox, { backgroundColor: '#FEE2E2', marginRight: 12, width: 36, height: 36 }]}>
                                    <Ionicons name="pause" size={18} color="#EF4444" />
                                </View>
                                <View>
                                    <Text style={styles.settingText}>Pause Tracking</Text>
                                    <Text style={{ fontSize: 12, color: '#94A3B8' }}>Vacation Mode (Exclude future expenses)</Text>
                                </View>
                            </View>
                            <Switch
                                value={isTrackingPaused}
                                onValueChange={handleTogglePause}
                                trackColor={{ false: '#E2E8F0', true: '#F87171' }}
                                thumbColor={isTrackingPaused ? '#EF4444' : '#f4f3f4'}
                            />
                        </View>
                    </View>

                    {/* Budget Section */}
                    <Text style={styles.sectionHeader}>Financial Goals</Text>
                    <View style={styles.card}>
                        {/* Monthly Budget */}
                        <View style={styles.cardHeader}>
                            <View style={styles.iconBox}>
                                <Ionicons name="wallet-outline" size={24} color="#4F46E5" />
                            </View>
                            <View>
                                <Text style={styles.cardTitle}>Monthly Budget</Text>
                                <Text style={styles.cardSubtitle}>Set your monthly cap</Text>
                            </View>
                        </View>

                        <View style={styles.inputRow}>
                            <Text style={styles.currencySymbol}>₹</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="0"
                                value={budget}
                                onChangeText={setBudget}
                                keyboardType="numeric"
                                onBlur={handleSaveBudget}
                            />
                        </View>

                        <View style={styles.divider} />

                        {/* Daily Limit */}
                        <View style={[styles.cardHeader, { marginTop: 20 }]}>
                            <View style={[styles.iconBox, { backgroundColor: '#DCFCE7' }]}>
                                <Ionicons name="shield-checkmark-outline" size={24} color="#10B981" />
                            </View>
                            <View>
                                <Text style={styles.cardTitle}>Daily Limit Lock</Text>
                                <Text style={styles.cardSubtitle}>Max spend per day</Text>
                            </View>
                        </View>

                        <View style={styles.inputRow}>
                            <Text style={styles.currencySymbol}>₹</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="0"
                                value={dailyLimit}
                                onChangeText={setDailyLimit}
                                keyboardType="numeric"
                                onBlur={handleSaveDailyLimit}
                            />
                        </View>

                        <TouchableOpacity style={styles.saveButton} onPress={() => { handleSaveBudget(); handleSaveDailyLimit(); }}>
                            <Text style={styles.saveButtonText}>Update Goals</Text>
                        </TouchableOpacity>
                    </View>

                    {/* App Settings */}
                    <Text style={styles.sectionHeader}>App Settings</Text>
                    <View style={styles.card}>
                        <View style={styles.settingRow}>
                            <View style={styles.rowLeft}>
                                <Ionicons name="moon-outline" size={22} color="#64748B" />
                                <Text style={styles.settingText}>Dark Mode</Text>
                            </View>
                            <Switch
                                value={isDarkMode}
                                onValueChange={setIsDarkMode}
                                trackColor={{ false: '#E2E8F0', true: '#818CF8' }}
                                thumbColor={isDarkMode ? '#4F46E5' : '#f4f3f4'}
                            />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.settingRow}>
                            <View style={styles.rowLeft}>
                                <Ionicons name="shield-checkmark-outline" size={22} color="#64748B" />
                                <Text style={styles.settingText}>Security (Coming Soon)</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                        </View>
                    </View>

                    {/* Data Actions */}
                    <Text style={styles.sectionHeader}>Data</Text>
                    <View style={styles.card}>
                        <TouchableOpacity style={styles.settingRow}>
                            <View style={styles.rowLeft}>
                                <Ionicons name="cloud-upload-outline" size={22} color="#64748B" />
                                <Text style={styles.settingText}>Backup Data</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                        </TouchableOpacity>
                        <View style={styles.divider} />
                        <TouchableOpacity style={styles.settingRow}>
                            <View style={styles.rowLeft}>
                                <Ionicons name="cloud-download-outline" size={22} color="#64748B" />
                                <Text style={styles.settingText}>Restore Data</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.version}>v1.0.0 • Offline Only</Text>

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
        padding: 24,
        paddingBottom: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
    },
    content: {
        padding: 24,
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 12,
        marginTop: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    cardSubtitle: {
        fontSize: 13,
        color: '#64748B',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: '#E2E8F0',
        paddingBottom: 8,
        marginBottom: 20,
    },
    currencySymbol: {
        fontSize: 24,
        color: '#64748B',
        fontWeight: '600',
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 24,
        fontWeight: '600',
        color: '#0F172A',
    },
    saveButton: {
        backgroundColor: '#4F46E5',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    settingText: {
        fontSize: 16,
        color: '#334155',
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 4,
    },
    version: {
        textAlign: 'center',
        marginTop: 32,
        color: '#94A3B8',
        fontSize: 12,
    }
});
